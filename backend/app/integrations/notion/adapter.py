"""Notion push adapter: sync TaskFlow tasks to a Notion database."""

from __future__ import annotations

import html
import logging
import re
import uuid
from typing import Any

from sqlalchemy import Select, cast, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.types import Integer

from app.config import settings
from app.integrations.base import IntegrationAuthError, IntegrationRequestError
from app.integrations.notion.client import NotionClient
from app.models.task import Task

logger = logging.getLogger(__name__)

# Property names expected in the user's Notion database. Document in README.
PROP_NAME = "Name"
PROP_DESCRIPTION = "Description"
PROP_DUE_DATE = "Due Date"
PROP_PRIORITY = "Priority"
PROP_STATUS = "Status"
PROP_COURSE = "Course"
PROP_SOURCE = "Source"


def _clean_html_to_text(html_content: str) -> str:
    """Convert HTML from Canvas to clean plain text for Notion.

    Strips script/link tags, converts lists to bullet points, preserves
    paragraph structure, and cleans up whitespace.
    """
    if not html_content:
        return ""

    # Remove script and link tags entirely (they're not content)
    html_content = re.sub(
        r"<script[^>]*>.*?</script>", "", html_content, flags=re.DOTALL | re.IGNORECASE
    )
    html_content = re.sub(r"<link[^>]*>", "", html_content, flags=re.IGNORECASE)

    # Convert <ul>/<li> lists to bullet points
    html_content = re.sub(r"<ul[^>]*>", "", html_content, flags=re.IGNORECASE)
    html_content = re.sub(r"</ul>", "", html_content, flags=re.IGNORECASE)
    html_content = re.sub(r"<li[^>]*>", "\n• ", html_content, flags=re.IGNORECASE)
    html_content = re.sub(r"</li>", "", html_content, flags=re.IGNORECASE)

    # Convert <p> tags to double line breaks for paragraph separation
    html_content = re.sub(r"<p[^>]*>", "\n\n", html_content, flags=re.IGNORECASE)
    html_content = re.sub(r"</p>", "", html_content, flags=re.IGNORECASE)

    # Convert <br> and <br/> to single line breaks
    html_content = re.sub(r"<br\s*/?>", "\n", html_content, flags=re.IGNORECASE)

    # Remove all remaining HTML tags
    html_content = re.sub(r"<[^>]+>", "", html_content)

    # Decode HTML entities (&nbsp;, &amp;, etc.)
    html_content = html.unescape(html_content)

    # Clean up whitespace: normalize multiple spaces/newlines, trim
    html_content = re.sub(
        r"[ \t]+", " ", html_content
    )  # Multiple spaces -> single space
    html_content = re.sub(
        r"\n\s*\n\s*\n+", "\n\n", html_content
    )  # Multiple newlines -> double
    html_content = html_content.strip()

    return html_content


def _rich_text(content: str) -> list[dict[str, Any]]:
    if not content:
        return []
    # Clean HTML if present (common in Canvas descriptions)
    cleaned = _clean_html_to_text(content)
    if not cleaned:
        return []
    return [{"type": "text", "text": {"content": cleaned[:2000]}}]


def _title(content: str, *, strikethrough: bool = False) -> list[dict[str, Any]]:
    segment: dict[str, Any] = {
        "type": "text",
        "text": {"content": (content or "Untitled")[:2000]},
    }
    if strikethrough:
        segment["annotations"] = {
            "bold": False,
            "italic": False,
            "strikethrough": True,
            "underline": False,
            "code": False,
            "color": "default",
        }
    return [segment]


def _date_iso(dt: Any) -> str | None:
    if dt is None:
        return None
    d = getattr(dt, "isoformat", None)
    if callable(d):
        return d()
    return str(dt)


def _is_completed(task: Task) -> bool:
    """True if task status is completed (handles SQLAlchemy enum or string)."""
    status = getattr(task.status, "value", task.status)
    return status == "completed"


def task_to_notion_properties(task: Task) -> dict[str, Any]:
    """Build Notion API properties dict from a Task model instance."""
    props: dict[str, Any] = {
        PROP_NAME: {"title": _title(task.title, strikethrough=_is_completed(task))},
        PROP_DESCRIPTION: {"rich_text": _rich_text(task.description or "")},
        PROP_DUE_DATE: (
            {"date": {"start": _date_iso(task.due_date)}}
            if task.due_date
            else {"date": None}
        ),
        PROP_PRIORITY: {"select": {"name": task.priority or "none"}},
        PROP_STATUS: {
            "select": {"name": getattr(task.status, "value", task.status) or "pending"}
        },
        PROP_COURSE: {"rich_text": _rich_text(task.course_or_category or "")},
        PROP_SOURCE: {"rich_text": _rich_text(task.source or "")},
    }
    return props


def _course_id_expr():
    """Extract Canvas course id from source_metadata for filtering."""
    raw = Task.source_metadata["course"]["id"]
    return cast(raw.astext, Integer)


class NotionAdapter:
    """Push TaskFlow tasks to a Notion database."""

    def __init__(self) -> None:
        if not settings.notion_api_token or not settings.notion_database_id:
            raise IntegrationAuthError(
                "Notion credentials missing. Set NOTION_API_TOKEN and NOTION_DATABASE_ID."
            )
        self._client = NotionClient(
            api_token=settings.notion_api_token,
            database_id=settings.notion_database_id,
        )

    async def authenticate(self) -> bool:
        """Verify token and database access."""
        await self._client.get_database()
        return True

    async def push(
        self,
        session: AsyncSession,
        *,
        task_ids: list[uuid.UUID] | None = None,
        course_ids: list[int] | None = None,
        limit: int = 500,
    ) -> dict[str, int]:
        """Push tasks to Notion. Create or update pages; store notion_page_id on tasks.

        Completed tasks are not kept in Notion: any existing Notion page for a
        completed task is archived (removed from the database view and calendar),
        and completed tasks are never created or updated.

        If task_ids is provided, only those tasks are considered (excluding completed).
        Otherwise, if course_ids is provided, only Canvas tasks from those courses
        with status pending or archived are synced.
        Otherwise all non-completed tasks (up to limit) are synced.
        """
        # 1. Archive Notion pages for tasks that are now completed (so they disappear from Notion/calendar).
        archive_stmt = select(Task).where(
            Task.notion_page_id.is_not(None),
            Task.status == "completed",
        )
        archive_result = await session.execute(archive_stmt)
        to_archive = list(archive_result.scalars().all())
        archived = 0
        for task in to_archive:
            try:
                await self._client.archive_page(task.notion_page_id)
                task.notion_page_id = None
                archived += 1
            except IntegrationAuthError:
                raise
            except IntegrationRequestError as exc:
                msg = str(exc).lower()
                # Page may already be archived (e.g. in Notion UI); clear our ref and continue.
                if "archived" in msg and ("can't edit" in msg or "cannot edit" in msg):
                    task.notion_page_id = None
                    archived += 1
                else:
                    raise
            except Exception:
                pass  # count as failed for this page; continue with others
        if archived:
            await session.commit()

        # 2. Build list of non-completed tasks to push (create or update).
        non_completed = Task.status.in_(["pending", "archived"])
        if task_ids is not None:
            stmt = select(Task).where(Task.id.in_(task_ids)).where(non_completed)
        elif course_ids:
            stmt = (
                select(Task)
                .where(Task.source == "canvas")
                .where(_course_id_expr().in_(course_ids))
                .where(non_completed)
                .order_by(Task.due_date.asc().nullslast(), Task.created_at.desc())
                .limit(limit)
            )
        else:
            stmt = (
                select(Task)
                .where(non_completed)
                .order_by(Task.due_date.asc().nullslast(), Task.created_at.desc())
                .limit(limit)
            )
        result = await session.execute(stmt)
        tasks = list(result.scalars().all())

        created = 0
        updated = 0
        failed = 0

        for task in tasks:
            try:
                props = task_to_notion_properties(task)
                if task.notion_page_id:
                    try:
                        await self._client.update_page(task.notion_page_id, props)
                        updated += 1
                    except IntegrationRequestError as exc:
                        msg = str(exc).lower()
                        if "archived" in msg and (
                            "can't edit" in msg or "cannot edit" in msg
                        ):
                            await self._client.unarchive_page(task.notion_page_id)
                            await self._client.update_page(task.notion_page_id, props)
                            updated += 1
                        else:
                            raise
                else:
                    page = await self._client.create_page(props)
                    task.notion_page_id = page["id"]
                    created += 1
            except (IntegrationAuthError, IntegrationRequestError):
                raise
            except Exception:
                failed += 1

        if created or updated:
            await session.commit()

        return {
            "created": created,
            "updated": updated,
            "archived": archived,
            "failed": failed,
            "total": len(tasks),
        }

    async def pull_status_updates(
        self, session: AsyncSession, task_ids: list[uuid.UUID] | None = None
    ) -> dict[str, int]:
        """Pull status updates from Notion pages back to TaskFlow tasks.

        Reads Status property from Notion pages and updates corresponding
        TaskFlow tasks. Only updates tasks that have notion_page_id set.

        Args:
            session: Database session
            task_ids: Optional list of task IDs to sync. If None, syncs all
                     tasks with notion_page_id set.

        Returns:
            Stats dict: {updated: int, skipped: int, failed: int, total: int}
        """
        # Query tasks that have notion_page_id
        stmt = select(Task).where(Task.notion_page_id.is_not(None))
        if task_ids:
            stmt = stmt.where(Task.id.in_(task_ids))

        result = await session.execute(stmt)
        tasks = list(result.scalars().all())

        if not tasks:
            return {"updated": 0, "skipped": 0, "failed": 0, "total": 0}

        updated = 0
        skipped = 0
        failed = 0

        for task in tasks:
            if not task.notion_page_id:
                skipped += 1
                continue

            try:
                # Fetch page from Notion
                # Retry once on transient errors (500/502/503)
                try:
                    page = await self._client.get_page(task.notion_page_id)
                except IntegrationRequestError as exc:
                    # Retry once for transient server errors
                    error_str = str(exc).lower()
                    if any(code in error_str for code in ["500", "502", "503"]):
                        import asyncio

                        logger.warning(
                            f"Notion API transient error for page {task.notion_page_id}, retrying..."
                        )
                        await asyncio.sleep(1)  # Brief delay before retry
                        try:
                            page = await self._client.get_page(task.notion_page_id)
                        except Exception:
                            # Retry also failed, mark as failed and continue
                            failed += 1
                            continue
                    else:
                        # Non-transient error, mark as failed and continue
                        failed += 1
                        continue

                # Extract Status property
                properties = page.get("properties", {})
                status_prop = properties.get(PROP_STATUS, {})

                # Status is a select property: {"select": {"name": "completed"}}
                notion_status = None
                if status_prop.get("type") == "select":
                    select_obj = status_prop.get("select")
                    if select_obj and "name" in select_obj:
                        notion_status = select_obj["name"].lower()

                # Map Notion status to TaskFlow status
                # Notion: pending, completed, archived
                # TaskFlow: pending, completed, archived
                if notion_status in ("pending", "completed", "archived"):
                    # Only update if status changed
                    if task.status != notion_status:
                        task.status = notion_status
                        updated += 1
                    else:
                        skipped += 1
                else:
                    skipped += 1

            except IntegrationAuthError:
                # Auth errors should stop the whole operation
                raise
            except Exception:
                # Other errors (including IntegrationRequestError after retry) are per-task failures
                failed += 1

        if updated > 0:
            await session.commit()

        return {
            "updated": updated,
            "skipped": skipped,
            "failed": failed,
            "total": len(tasks),
        }

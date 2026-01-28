"""Canvas LMS adapter."""

from __future__ import annotations

import logging

from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.integrations.base import (
    IntegrationAuthError,
    IntegrationBase,
    IntegrationRequestError,
)
from app.integrations.canvas.client import CanvasClient
from app.integrations.canvas.schemas import CanvasCourseListItem
from app.schemas.task import TaskCreate
from app.services.sync_service import upsert_tasks

logger = logging.getLogger(__name__)


class CanvasAdapter(IntegrationBase):
    """Canvas integration adapter (API token auth)."""

    name = "canvas"

    def __init__(self) -> None:
        if not settings.canvas_api_url or not settings.canvas_api_token:
            raise IntegrationAuthError(
                "Canvas credentials missing. Set CANVAS_API_URL and CANVAS_API_TOKEN."
            )
        self._client = CanvasClient(
            base_url=settings.canvas_api_url, api_token=settings.canvas_api_token
        )

    async def authenticate(self) -> bool:
        """Verify Canvas token works using a lightweight /courses call.

        Some Canvas setups may not allow /users/self for certain tokens, but
        /courses still works. Using /courses keeps auth consistent with the
        curl command you're already using.
        """
        await self._client.list_courses(per_page=1)
        return True

    async def list_courses(self) -> list[CanvasCourseListItem]:
        """List active Canvas courses for UI toggles."""
        courses = await self._client.list_courses()
        return [CanvasCourseListItem(id=c.id, name=c.name) for c in courses]

    async def fetch_tasks(
        self, course_ids: list[int] | None = None
    ) -> list[TaskCreate]:
        """Fetch Canvas courses + assignments and normalize into TaskCreate.

        If course_ids is provided, only those courses are fetched. Otherwise all
        active courses are used.
        """
        if course_ids:
            courses = []
            for cid in course_ids:
                course = await self._client.get_course(cid)
                if course is not None:
                    courses.append(course)
        else:
            courses = await self._client.list_courses()

        tasks: list[TaskCreate] = []
        for course in courses:
            try:
                assignments = await self._client.list_assignments(
                    course.id, include_submission=True
                )
            except IntegrationAuthError as exc:
                logger.warning(
                    "Canvas auth error listing assignments for course_id=%s: %s",
                    course.id,
                    exc,
                )
                continue
            except IntegrationRequestError as exc:
                logger.warning(
                    "Canvas request error listing assignments for course_id=%s: %s",
                    course.id,
                    exc,
                )
                continue
            for assignment in assignments:
                sub = assignment.submission
                status = (
                    "completed"
                    if sub is not None and sub.get("submitted_at") is not None
                    else "pending"
                )
                assignment_data = assignment.model_dump(mode="json")
                assignment_data["course"] = {"id": course.id, "name": course.name}

                task = TaskCreate.model_validate(
                    {
                        "external_id": str(assignment.id),
                        "source": "canvas",
                        "source_metadata": assignment_data,
                        "title": assignment.name,
                        "description": assignment.description,
                        "due_date": assignment.due_at,
                        "priority": "none",
                        "status": status,
                        "course_or_category": course.name,
                    }
                )
                tasks.append(task)

        return tasks

    async def sync(
        self, session: AsyncSession, course_ids: list[int] | None = None
    ) -> dict[str, int]:
        """Fetch tasks from Canvas and upsert into database.

        If course_ids is provided, only those courses are synced.
        """
        await self.authenticate()
        tasks = await self.fetch_tasks(course_ids=course_ids)
        return await upsert_tasks(session, tasks)

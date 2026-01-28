"""Canvas LMS adapter."""

from __future__ import annotations

from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.integrations.base import IntegrationAuthError, IntegrationBase
from app.integrations.canvas.client import CanvasClient
from app.schemas.task import TaskCreate
from app.services.sync_service import upsert_tasks


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

    async def fetch_tasks(self) -> list[TaskCreate]:
        """Fetch Canvas courses + assignments and normalize into TaskCreate."""
        courses = await self._client.list_courses()

        tasks: list[TaskCreate] = []
        for course in courses:
            try:
                assignments = await self._client.list_assignments(course.id)
            except IntegrationAuthError:
                # Some courses may be restricted; skip those rather than failing the whole sync.
                continue
            for assignment in assignments:
                # Attach minimal course context for normalization/UI grouping.
                # Use mode="json" so datetimes become ISO strings and are JSON-serializable.
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
                        "status": "pending",
                        "course_or_category": course.name,
                    }
                )
                tasks.append(task)

        return tasks

    async def sync(self, session: AsyncSession) -> dict[str, int]:
        """Fetch tasks from Canvas and upsert into database."""
        await self.authenticate()
        tasks = await self.fetch_tasks()
        return await upsert_tasks(session, tasks)

"""Canvas API client (async)."""

from __future__ import annotations

from typing import Any

import httpx

from app.integrations.base import IntegrationAuthError, IntegrationRequestError
from app.integrations.canvas.schemas import CanvasAssignment, CanvasCourse


def _normalize_base_url(base_url: str) -> str:
    url = base_url.strip().rstrip("/")
    # Accept either https://school.instructure.com or https://school.instructure.com/api/v1
    if url.endswith("/api/v1"):
        url = url[: -len("/api/v1")]
    return url


class CanvasClient:
    """Small async client for Canvas REST API."""

    def __init__(self, *, base_url: str, api_token: str) -> None:
        self._base_url = _normalize_base_url(base_url)
        self._api_token = api_token

    def _headers(self) -> dict[str, str]:
        return {"Authorization": f"Bearer {self._api_token}"}

    async def _get(self, path: str, *, params: dict[str, Any] | None = None) -> Any:
        url = f"{self._base_url}/api/v1{path}"
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                resp = await client.get(url, headers=self._headers(), params=params)
                resp.raise_for_status()
                return resp.json()
        except httpx.HTTPStatusError as exc:
            status_code = exc.response.status_code
            if status_code in (401, 403):
                raise IntegrationAuthError("Canvas authentication failed") from exc
            raise IntegrationRequestError(
                f"Canvas request failed ({status_code})"
            ) from exc
        except httpx.HTTPError as exc:
            raise IntegrationRequestError(
                "Canvas request failed (network error)"
            ) from exc

    async def get_user(self) -> dict[str, Any]:
        """Validate token by fetching the current user."""
        return await self._get("/users/self")

    async def list_courses(
        self, *, per_page: int = 50, enrollment_state: str = "active"
    ) -> list[CanvasCourse]:
        """List courses for the authenticated user.

        Args:
            per_page: Number of results per page.
            enrollment_state: Filter by enrollment state. Options:
                - "active" (default): Only current/ongoing courses
                - "completed": Only finished courses
                - "all": All courses regardless of state
        """
        params: dict[str, Any] = {"per_page": per_page}
        if enrollment_state != "all":
            params["enrollment_state"] = enrollment_state
        raw = await self._get("/courses", params=params)
        return [CanvasCourse.model_validate(item) for item in raw]

    async def get_course(self, course_id: int) -> CanvasCourse | None:
        """Fetch a single course by ID. Returns None if not found or inaccessible."""
        try:
            raw = await self._get(f"/courses/{course_id}")
            return CanvasCourse.model_validate(raw)
        except (IntegrationAuthError, IntegrationRequestError):
            return None

    async def list_assignments(
        self,
        course_id: int,
        *,
        per_page: int = 50,
        include_submission: bool = False,
    ) -> list[CanvasAssignment]:
        """List assignments for a course.

        When include_submission=True, adds include[]=submission so each assignment
        includes the current user's submission (submitted_at → completed).
        """
        params: dict[str, Any] = {"per_page": per_page}
        if include_submission:
            params["include[]"] = "submission"
        raw = await self._get(f"/courses/{course_id}/assignments", params=params)
        return [CanvasAssignment.model_validate(item) for item in raw]

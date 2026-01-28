"""Notion API client (async)."""

from __future__ import annotations

from typing import Any

import httpx

from app.integrations.base import IntegrationAuthError, IntegrationRequestError

NOTION_API_BASE = "https://api.notion.com"
NOTION_VERSION = "2022-06-28"


class NotionClient:
    """Async HTTP client for Notion REST API."""

    def __init__(self, *, api_token: str, database_id: str) -> None:
        self._api_token = api_token
        self._database_id = database_id.strip()

    def _headers(self) -> dict[str, str]:
        return {
            "Authorization": f"Bearer {self._api_token}",
            "Content-Type": "application/json",
            "Notion-Version": NOTION_VERSION,
        }

    async def _request(
        self,
        method: str,
        path: str,
        *,
        json: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        url = f"{NOTION_API_BASE}{path}"
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                resp = await client.request(
                    method, url, headers=self._headers(), json=json
                )
                resp.raise_for_status()
                return resp.json() if resp.content else {}
        except httpx.HTTPStatusError as exc:
            status_code = exc.response.status_code
            if status_code in (401, 403):
                raise IntegrationAuthError("Notion authentication failed") from exc
            # Surface Notion's error details (very helpful for 400s like
            # “property does not exist”, “invalid select option”, etc.).
            detail: str | None = None
            try:
                payload = exc.response.json()
                if isinstance(payload, dict):
                    detail = payload.get("message") or payload.get("error")
            except Exception:
                detail = None

            if not detail:
                try:
                    detail = exc.response.text
                except Exception:
                    detail = None

            msg = (
                f"Notion request failed ({status_code})"
                + (f": {detail}" if detail else "")
            )
            raise IntegrationRequestError(msg) from exc
        except httpx.HTTPError as exc:
            raise IntegrationRequestError(
                "Notion request failed (network error)"
            ) from exc

    async def get_database(self) -> dict[str, Any]:
        """Fetch database (validates token + database_id)."""
        return await self._request("GET", f"/v1/databases/{self._database_id}")

    async def create_page(self, properties: dict[str, Any]) -> dict[str, Any]:
        """Create a page in the configured database."""
        payload = {
            "parent": {"database_id": self._database_id},
            "properties": properties,
        }
        return await self._request("POST", "/v1/pages", json=payload)

    async def update_page(
        self, page_id: str, properties: dict[str, Any]
    ) -> dict[str, Any]:
        """Update a page's properties."""
        return await self._request(
            "PATCH", f"/v1/pages/{page_id.strip()}", json={"properties": properties}
        )

    async def unarchive_page(self, page_id: str) -> dict[str, Any]:
        """Unarchive a page (re-enable editing)."""
        return await self._request(
            "PATCH",
            f"/v1/pages/{page_id.strip()}",
            json={"archived": False},
        )

    async def archive_page(self, page_id: str) -> dict[str, Any]:
        """Archive (soft-delete) a page."""
        return await self._request(
            "PATCH",
            f"/v1/pages/{page_id.strip()}",
            json={"archived": True},
        )

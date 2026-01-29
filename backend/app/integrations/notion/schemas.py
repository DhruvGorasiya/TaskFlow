"""Notion-specific schemas."""

from __future__ import annotations

from pydantic import BaseModel


class NotionSyncRequest(BaseModel):
    """Optional body for POST /integrations/notion/sync."""

    task_ids: list[str] | None = None
    course_ids: list[int] | None = None


class NotionSyncResponse(BaseModel):
    """Response for Notion sync."""

    created: int
    updated: int
    failed: int
    total: int


class NotionPullRequest(BaseModel):
    """Optional body for POST /integrations/notion/pull."""

    task_ids: list[str] | None = None


class NotionPullResponse(BaseModel):
    """Response for Notion pull (status sync from Notion to TaskFlow)."""

    updated: int
    skipped: int
    failed: int
    total: int

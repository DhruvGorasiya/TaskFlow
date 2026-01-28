"""Schemas for Task CRUD operations."""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field

TaskPriorityLiteral = Literal["high", "medium", "low", "none"]
TaskStatusLiteral = Literal["pending", "completed", "archived"]
TaskSourceLiteral = Literal["canvas", "gmail", "calendar"]


class TaskBase(BaseModel):
    """Shared fields for task creation and updates."""

    external_id: str = Field(..., min_length=1, max_length=255)
    source: TaskSourceLiteral
    source_metadata: dict[str, Any] = Field(default_factory=dict)

    title: str = Field(..., min_length=1, max_length=500)
    description: str | None = None
    due_date: datetime | None = None

    priority: TaskPriorityLiteral = "none"
    status: TaskStatusLiteral = "pending"
    course_or_category: str | None = Field(default=None, max_length=255)


class TaskCreate(TaskBase):
    """Request model to create a task."""


class TaskUpdate(BaseModel):
    """Request model to update a task (partial)."""

    model_config = ConfigDict(extra="forbid")

    title: str | None = Field(default=None, min_length=1, max_length=500)
    description: str | None = None
    due_date: datetime | None = None
    priority: TaskPriorityLiteral | None = None
    status: TaskStatusLiteral | None = None
    course_or_category: str | None = Field(default=None, max_length=255)


class TaskRead(TaskBase):
    """Response model for task reads."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    created_at: datetime
    updated_at: datetime
    synced_at: datetime


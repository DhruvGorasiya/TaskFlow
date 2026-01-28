"""Task model for normalized tasks across integrations."""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any

from sqlalchemy import DateTime, Enum, Index, String, Text, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


TaskPriority = Enum("high", "medium", "low", "none", name="task_priority")
TaskStatus = Enum("pending", "completed", "archived", name="task_status")
TaskSource = Enum("canvas", "gmail", "calendar", name="task_source")


class Task(Base):
    """Normalized Task stored in TaskFlow."""

    __tablename__ = "tasks"
    __table_args__ = (
        UniqueConstraint("source", "external_id", name="uq_tasks_source_external_id"),
        Index("ix_tasks_due_date", "due_date"),
        Index("ix_tasks_source", "source"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    external_id: Mapped[str] = mapped_column(String(255), nullable=False)
    source: Mapped[str] = mapped_column(TaskSource, nullable=False)
    source_metadata: Mapped[dict[str, Any]] = mapped_column(
        JSONB, nullable=False, default=dict
    )

    title: Mapped[str] = mapped_column(String(500), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    due_date: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    priority: Mapped[str] = mapped_column(TaskPriority, nullable=False, default="none")
    status: Mapped[str] = mapped_column(TaskStatus, nullable=False, default="pending")

    course_or_category: Mapped[str | None] = mapped_column(String(255), nullable=True)

    notion_page_id: Mapped[str | None] = mapped_column(String(36), nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )
    synced_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )

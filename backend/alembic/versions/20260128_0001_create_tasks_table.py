"""Create tasks table.

Revision ID: 20260128_0001
Revises: 
Create Date: 2026-01-28
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql


revision = "20260128_0001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Important: create enums with checkfirst=True, and use create_type=False in
    # table columns to prevent duplicate CREATE TYPE when the type already exists.
    bind = op.get_bind()

    task_source_create = postgresql.ENUM("canvas", "gmail", "calendar", name="task_source")
    task_priority_create = postgresql.ENUM("high", "medium", "low", "none", name="task_priority")
    task_status_create = postgresql.ENUM("pending", "completed", "archived", name="task_status")

    task_source_create.create(bind, checkfirst=True)
    task_priority_create.create(bind, checkfirst=True)
    task_status_create.create(bind, checkfirst=True)

    task_source = postgresql.ENUM(name="task_source", create_type=False)
    task_priority = postgresql.ENUM(name="task_priority", create_type=False)
    task_status = postgresql.ENUM(name="task_status", create_type=False)

    op.create_table(
        "tasks",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("external_id", sa.String(length=255), nullable=False),
        sa.Column("source", task_source, nullable=False),
        sa.Column("source_metadata", postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default=sa.text("'{}'::jsonb")),
        sa.Column("title", sa.String(length=500), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("due_date", sa.DateTime(timezone=True), nullable=True),
        sa.Column("priority", task_priority, nullable=False, server_default=sa.text("'none'")),
        sa.Column("status", task_status, nullable=False, server_default=sa.text("'pending'")),
        sa.Column("course_or_category", sa.String(length=255), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("synced_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.UniqueConstraint("source", "external_id", name="uq_tasks_source_external_id"),
    )

    op.create_index("ix_tasks_due_date", "tasks", ["due_date"])
    op.create_index("ix_tasks_source", "tasks", ["source"])


def downgrade() -> None:
    op.drop_index("ix_tasks_source", table_name="tasks")
    op.drop_index("ix_tasks_due_date", table_name="tasks")
    op.drop_table("tasks")

    bind = op.get_bind()
    postgresql.ENUM(name="task_status").drop(bind, checkfirst=True)
    postgresql.ENUM(name="task_priority").drop(bind, checkfirst=True)
    postgresql.ENUM(name="task_source").drop(bind, checkfirst=True)


"""Add notion_page_id to tasks.

Revision ID: 20260128_0002
Revises: 20260128_0001
Create Date: 2026-01-28

"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op


revision = "20260128_0002"
down_revision = "20260128_0001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "tasks",
        sa.Column("notion_page_id", sa.String(length=36), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("tasks", "notion_page_id")

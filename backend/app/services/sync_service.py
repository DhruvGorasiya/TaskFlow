"""Sync orchestration and upsert logic."""

from __future__ import annotations

import uuid
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.task import Task
from app.schemas.task import TaskCreate


async def upsert_tasks(
    session: AsyncSession, tasks: list[TaskCreate]
) -> dict[str, int]:
    """Upsert tasks by `(source, external_id)` and return sync stats.

    Notes:
    - Provider-owned fields are overwritten on sync: title, description, due_date,
      course_or_category, source_metadata, status (from provider, e.g. Canvas submission).
    - User-owned fields preserved on sync: priority.
    """
    if not tasks:
        return {"created": 0, "updated": 0, "total": 0}

    # Defensive: de-duplicate incoming tasks by (source, external_id).
    # If duplicates exist, we keep the *last* occurrence so the most recent
    # normalized payload wins and our stats/total remain meaningful.
    unique: dict[tuple[str, str], TaskCreate] = {}
    for t in tasks:
        key = (t.source, t.external_id)
        if key in unique:
            # Move to end to reflect "last wins" deterministically.
            del unique[key]
        unique[key] = t
    tasks = list(unique.values())

    now = datetime.now(tz=timezone.utc)

    # Best-effort created vs updated stats: pre-check which keys already exist.
    # This keeps our returned stats meaningful without needing triggers/CTEs.
    existing_count = 0
    by_source: dict[str, list[str]] = {}
    for t in tasks:
        by_source.setdefault(t.source, []).append(t.external_id)

    for source, external_ids in by_source.items():
        stmt_existing = select(Task.external_id).where(
            Task.source == source,
            Task.external_id.in_(external_ids),
        )
        res = await session.execute(stmt_existing)
        existing_count += len(res.scalars().all())

    rows = [
        {
            "id": uuid.uuid4(),
            "external_id": t.external_id,
            "source": t.source,
            "source_metadata": t.source_metadata,
            "title": t.title,
            "description": t.description,
            "due_date": t.due_date,
            "course_or_category": t.course_or_category,
            "synced_at": now,
            # For newly created rows only:
            "status": t.status,
            "priority": t.priority,
        }
        for t in tasks
    ]

    stmt = insert(Task).values(rows)

    # Only overwrite provider-owned fields on conflict (including status from Canvas).
    update_cols = {
        "source_metadata": stmt.excluded.source_metadata,
        "title": stmt.excluded.title,
        "description": stmt.excluded.description,
        "due_date": stmt.excluded.due_date,
        "course_or_category": stmt.excluded.course_or_category,
        "synced_at": stmt.excluded.synced_at,
        "status": stmt.excluded.status,
    }

    stmt = stmt.on_conflict_do_update(
        constraint="uq_tasks_source_external_id",
        set_=update_cols,
    ).returning(Task.id)

    result = await session.execute(stmt)
    returned_ids = list(result.scalars().all())
    await session.commit()

    return {
        "created": max(len(tasks) - existing_count, 0),
        "updated": existing_count,
        "total": len(tasks),
    }

"""APScheduler-based background sync jobs."""

from __future__ import annotations

import logging
from typing import Optional

from apscheduler.schedulers.asyncio import (  # type: ignore[import-not-found]
    AsyncIOScheduler,
)
from apscheduler.triggers.interval import (  # type: ignore[import-not-found]
    IntervalTrigger,
)

from app.config import settings
from app.database import AsyncSessionLocal
from app.integrations.base import IntegrationAuthError, IntegrationRequestError
from app.integrations.canvas.adapter import CanvasAdapter

logger = logging.getLogger(__name__)

_scheduler: Optional[AsyncIOScheduler] = None


async def run_canvas_sync_once() -> None:
    """Run a single Canvas sync cycle.

    This is used both by the scheduler and by tests.
    """
    try:
        async with AsyncSessionLocal() as session:
            adapter = CanvasAdapter()
            stats = await adapter.sync(session)
            logger.info("Canvas sync completed: %s", stats)
    except IntegrationAuthError as exc:
        logger.error("Canvas auth failed during scheduled sync: %s", exc)
    except IntegrationRequestError as exc:
        logger.error("Canvas request failed during scheduled sync: %s", exc)
    except Exception as exc:  # pragma: no cover - safety net
        logger.exception("Unexpected error during scheduled Canvas sync: %s", exc)


def start_scheduler() -> AsyncIOScheduler:
    """Start the AsyncIO scheduler if enabled and not already running."""
    global _scheduler

    if not settings.enable_scheduler:
        logger.info("Scheduler is disabled by settings.ENABLE_SCHEDULER.")
        return _scheduler if _scheduler is not None else AsyncIOScheduler()

    if _scheduler is not None and _scheduler.running:
        return _scheduler

    scheduler = AsyncIOScheduler()
    scheduler.add_job(
        run_canvas_sync_once,
        IntervalTrigger(minutes=settings.sync_interval_minutes),
        id="canvas_sync",
        replace_existing=True,
    )
    scheduler.start()

    _scheduler = scheduler
    logger.info(
        "Started APScheduler with Canvas sync every %s minute(s).",
        settings.sync_interval_minutes,
    )
    return scheduler


def shutdown_scheduler() -> None:
    """Shutdown the scheduler if it is running."""
    global _scheduler
    if _scheduler is not None and _scheduler.running:
        _scheduler.shutdown(wait=False)
        logger.info("APScheduler shut down.")
    _scheduler = None

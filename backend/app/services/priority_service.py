"""AI-powered task prioritization service.

Uses date-based rules as baseline, with OpenAI analyzing task content
to adjust priority based on urgency signals.
"""

from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone

from openai import AsyncOpenAI
from openai import RateLimitError

from app.config import settings
from app.models.task import Task

logger = logging.getLogger(__name__)

# Date-based priority thresholds (as per plan)
HIGH_THRESHOLD_DAYS = 7  # < 7 days = high
MEDIUM_THRESHOLD_DAYS = 14  # 7-14 days = medium, > 14 days = low

# Deadline change threshold for "significant" change (3 days)
SIGNIFICANT_DEADLINE_CHANGE_DAYS = 3


def calculate_priority_baseline(due_date: datetime | None, status: str) -> str | None:
    """Calculate baseline priority based on deadline distance.

    Returns:
        - "high" if due_date < 7 days away
        - "medium" if due_date is 7-14 days away
        - "low" if due_date > 14 days away
        - None if task is completed/archived or has no due_date
    """
    if status in ("completed", "archived"):
        return None

    if due_date is None:
        return None

    now = datetime.now(tz=timezone.utc)
    # Ensure due_date is timezone-aware
    if due_date.tzinfo is None:
        due_date = due_date.replace(tzinfo=timezone.utc)

    days_until_due = (due_date - now).total_seconds() / 86400  # Convert to days

    if days_until_due < HIGH_THRESHOLD_DAYS:
        return "high"
    elif days_until_due < MEDIUM_THRESHOLD_DAYS:
        return "medium"
    else:
        return "low"


async def analyze_with_ai(
    title: str,
    description: str | None,
    baseline: str,
    due_date: datetime | None,
) -> str:
    """Use OpenAI to analyze task content and adjust priority.

    Falls back to baseline if API fails or key is missing.
    """
    if not settings.openai_api_key:
        logger.debug("OpenAI API key not configured, using baseline priority")
        return baseline

    try:
        client = AsyncOpenAI(api_key=settings.openai_api_key)

        # Calculate days until deadline for context
        days_text = "N/A"
        if due_date:
            now = datetime.now(tz=timezone.utc)
            if due_date.tzinfo is None:
                due_date = due_date.replace(tzinfo=timezone.utc)
            days = (due_date - now).total_seconds() / 86400
            days_text = f"{int(days)} days" if days >= 0 else "overdue"

        # Build prompt
        desc_text = description[:500] if description else "No description"
        prompt = f"""You are a task prioritization assistant. Analyze this task and return ONLY one word: "high", "medium", or "low".

Task title: {title}
Task description: {desc_text}
Baseline priority (based on deadline): {baseline}
Days until deadline: {days_text}

Consider:
- Urgency signals (e.g., "final exam", "required", "critical" → higher priority)
- Low-urgency signals (e.g., "optional", "reading", "review" → lower priority)
- The baseline is already date-based, so adjust only if content suggests different urgency

Return ONLY the priority word (high/medium/low), nothing else."""

        response = await client.chat.completions.create(
            model="gpt-4o-mini",  # Cost-effective model
            messages=[
                {
                    "role": "system",
                    "content": "You are a task prioritization assistant. Return only one word: high, medium, or low.",
                },
                {"role": "user", "content": prompt},
            ],
            max_tokens=10,
            temperature=0.3,  # Lower temperature for more consistent results
            timeout=10.0,  # 10 second timeout
        )

        result = response.choices[0].message.content.strip().lower()
        if result in ("high", "medium", "low"):
            logger.debug(f"AI adjusted priority from {baseline} to {result} for task: {title[:50]}")
            return result
        else:
            logger.warning(
                f"AI returned invalid priority '{result}', falling back to baseline {baseline}"
            )
            return baseline

    except RateLimitError as exc:
        # Handle quota/rate limit errors specifically
        error_msg = str(exc)
        if "insufficient_quota" in error_msg or "quota" in error_msg.lower():
            logger.warning(
                "OpenAI API quota exceeded, using baseline priority. "
                "Check your OpenAI billing/plan. This will be logged once per sync."
            )
        else:
            logger.warning(
                f"OpenAI API rate limit hit, using baseline priority: {exc}"
            )
        return baseline
    except Exception as exc:
        logger.warning(
            f"OpenAI API call failed, using baseline priority: {exc}",
            exc_info=False,  # Don't log full traceback for expected API failures
        )
        return baseline


def should_recalculate_priority(task: Task, new_due_date: datetime | None) -> bool:
    """Determine if priority should be recalculated for a task.

    Returns True if:
    - Task priority is "none", OR
    - Deadline changed significantly (>3 days difference), OR
    - Task had no due_date and now has one
    """
    # Always recalculate if priority is "none"
    if task.priority == "none":
        return True

    # If task has no due_date, skip (can't prioritize)
    if new_due_date is None:
        return False

    # If task previously had no due_date, recalculate
    if task.due_date is None:
        return True

    # Check if deadline changed significantly
    # Ensure both are timezone-aware for comparison
    old_due = task.due_date
    if old_due.tzinfo is None:
        old_due = old_due.replace(tzinfo=timezone.utc)
    if new_due_date.tzinfo is None:
        new_due_date = new_due_date.replace(tzinfo=timezone.utc)

    days_diff = abs((new_due_date - old_due).total_seconds() / 86400)
    if days_diff > SIGNIFICANT_DEADLINE_CHANGE_DAYS:
        return True

    return False


async def prioritize_task(task: Task, use_ai: bool = True) -> str | None:
    """Main entry point: calculate priority for a task.

    Args:
        task: Task model instance
        use_ai: Whether to use OpenAI for content analysis (default True)

    Returns:
        Priority string ("high", "medium", "low") or None if should skip
    """
    # Skip if task is completed/archived
    if task.status in ("completed", "archived"):
        return None

    # Skip if no due_date
    if task.due_date is None:
        return None

    # Calculate baseline priority
    baseline = calculate_priority_baseline(task.due_date, task.status)
    if baseline is None:
        return None

    # Use AI if enabled and available
    if use_ai:
        return await analyze_with_ai(
            task.title, task.description, baseline, task.due_date
        )
    else:
        return baseline

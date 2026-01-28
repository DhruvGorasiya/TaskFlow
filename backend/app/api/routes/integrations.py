"""Integration-related API routes (Canvas sync trigger, etc.)."""

from __future__ import annotations

from fastapi import APIRouter, HTTPException, status

router = APIRouter(prefix="/integrations", tags=["integrations"])


@router.post(
    "/canvas/sync",
    status_code=status.HTTP_202_ACCEPTED,
)
async def trigger_canvas_sync() -> dict[str, str]:
    """Trigger a manual Canvas sync.

    Note:
    - The actual sync implementation will be wired in Step 4 (Canvas integration).
    - For now this endpoint is a placeholder that confirms the API surface.
    """
    raise HTTPException(
        status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
        detail="Canvas sync is not yet implemented.",
    )


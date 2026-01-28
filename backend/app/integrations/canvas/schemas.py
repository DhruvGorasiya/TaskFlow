"""Canvas-specific schemas.

We keep these permissive (extra allowed) because Canvas responses are large and
we only need a subset for normalization.
"""

from __future__ import annotations

from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict


class CanvasCourse(BaseModel):
    """Subset of Canvas course fields used by TaskFlow."""

    model_config = ConfigDict(extra="allow")

    id: int
    name: str | None = None


class CanvasAssignment(BaseModel):
    """Subset of Canvas assignment fields used by TaskFlow."""

    model_config = ConfigDict(extra="allow")

    id: int
    name: str
    description: str | None = None
    due_at: datetime | None = None

    # Allow attaching course context during normalization.
    course: dict[str, Any] | None = None


"""Integration base class and shared exceptions."""

from __future__ import annotations

from abc import ABC, abstractmethod

from sqlalchemy.ext.asyncio import AsyncSession

from app.schemas.task import TaskCreate


class IntegrationError(RuntimeError):
    """Base error for integration failures."""


class IntegrationAuthError(IntegrationError):
    """Raised when integration authentication fails."""


class IntegrationRequestError(IntegrationError):
    """Raised when integration API requests fail."""


class IntegrationBase(ABC):
    """Base class all integrations must implement."""

    name: str  # e.g., "canvas", "gmail"

    @abstractmethod
    async def authenticate(self) -> bool:
        """Verify credentials are valid."""

    @abstractmethod
    async def fetch_tasks(self) -> list[TaskCreate]:
        """Fetch and normalize tasks from the external service."""

    @abstractmethod
    async def sync(self, session: AsyncSession) -> dict[str, int]:
        """Full sync: fetch tasks and update database. Return sync stats."""


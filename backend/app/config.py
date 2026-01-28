"""Application configuration loaded from environment variables.

Notes:
- We support loading from a local, non-committed env file named `env.local.txt`
  (preferred in this repo) or from `.env` if you use that locally.
- Environment variables always take precedence over values from files.
"""

from __future__ import annotations

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Runtime configuration for the TaskFlow backend."""

    model_config = SettingsConfigDict(
        env_file=("env.local.txt", ".env"),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # Local-dev default matches `backend/docker-compose.yml`.
    # Override via `DATABASE_URL` env var in production.
    database_url: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/taskflow"

    # Optional until you enable Canvas sync endpoints.
    canvas_api_url: str | None = None
    canvas_api_token: str | None = None

    enable_scheduler: bool = False
    sync_interval_minutes: int = 15


settings = Settings()  # type: ignore[call-arg]

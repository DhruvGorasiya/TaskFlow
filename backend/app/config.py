"""Application configuration loaded from environment variables."""

from __future__ import annotations

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Runtime configuration for the TaskFlow backend."""

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    database_url: str
    canvas_api_url: str
    canvas_api_token: str

    enable_scheduler: bool = False
    sync_interval_minutes: int = 15


settings = Settings()  # type: ignore[call-arg]


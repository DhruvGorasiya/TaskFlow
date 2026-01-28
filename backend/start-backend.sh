#!/usr/bin/env bash

set -euo pipefail

# Simple helper script to start the TaskFlow backend.
# Assumes:
# - Docker Desktop is running
# - Python dependencies are installed in the current environment
# - You run this script from the repo root OR from the backend directory

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "==> Starting PostgreSQL via Docker Compose (if not already running)..."
docker compose -f docker-compose.yml up -d

echo "==> Running Alembic migrations..."
alembic -c alembic.ini upgrade head

echo "==> Starting FastAPI with uvicorn on http://localhost:8000 ..."
exec uvicorn app.main:app --reload


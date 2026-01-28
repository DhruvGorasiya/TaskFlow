# TaskFlow Backend (FastAPI + PostgreSQL)

This directory contains the **TaskFlow** backend: a FastAPI app that aggregates tasks from external services (currently Canvas LMS) into a unified PostgreSQL-backed model.

## 1. Tech stack

- **Language**: Python 3.11+ (you are currently on 3.12, which works)
- **Web framework**: FastAPI
- **Database**: PostgreSQL (via Docker or local install)
- **ORM**: SQLAlchemy 2.x (asyncio)
- **Migrations**: Alembic
- **HTTP client**: httpx (async)
- **Scheduler**: APScheduler (optional)

## 2. Project layout (backend)

```text
backend/
  app/
    main.py                # FastAPI app entry point
    config.py              # Settings (Pydantic Settings)
    database.py            # Async engine + session
    models/
      task.py              # Task SQLAlchemy model
    schemas/
      task.py              # Pydantic models (TaskCreate/Read/Update)
    api/
      dependencies.py      # Shared FastAPI dependencies (DB session)
      routes/
        tasks.py           # Task CRUD API
        integrations.py    # Canvas sync endpoint
    services/
      task_service.py      # Task CRUD business logic
      sync_service.py      # Upsert logic for external tasks
    integrations/
      base.py              # IntegrationBase interface
      canvas/
        client.py          # Canvas API client (courses/assignments)
        adapter.py         # CanvasAdapter implementing IntegrationBase
        schemas.py         # Canvas-specific Pydantic models
    jobs/
      sync_scheduler.py    # APScheduler job wiring (optional)

  alembic/
    env.py                 # Alembic async env
    versions/
      20260128_0001_create_tasks_table.py

  tests/
    test_tasks_api.py      # Async integration test for Task API
    test_canvas_client.py  # Canvas client smoke + error tests

  requirements.txt
  docker-compose.yml       # Local Postgres (Docker) helper
  env.example.txt          # Example env file (copy for local use)
```

## 3. Environment configuration

### 3.1 Local env file (recommended)

Create `backend/env.local.txt` (already generated for you) and fill:

```text
DATABASE_URL=postgresql+asyncpg://postgres:postgres@localhost:5432/taskflow

CANVAS_API_URL=https://northeastern.instructure.com
CANVAS_API_TOKEN=YOUR_CANVAS_API_TOKEN_HERE

# Optional scheduler
ENABLE_SCHEDULER=false
SYNC_INTERVAL_MINUTES=15
```

Notes:

- `env.local.txt` is **ignored by git** and loaded by `app/config.py`.
- `CANVAS_API_URL` must be the **base URL** (no `/api/v1` suffix).

### 3.2 Settings reference

`app/config.py` exposes:

- `database_url: str`
- `canvas_api_url: str | None`
- `canvas_api_token: str | None`
- `enable_scheduler: bool` (default `False`)
- `sync_interval_minutes: int` (default `15`)

## 4. Running PostgreSQL locally (Docker)

From the repo root (`TaskFlow/`):

```bash
docker compose -f backend/docker-compose.yml up -d
```

This will:

- Run Postgres 15 in a container named `taskflow-postgres`
- Expose it on `localhost:5432`
- Create database `taskflow` with user/password `postgres/postgres`

To check:

```bash
docker ps
# should show taskflow-postgres
```

## 5. Python environment & dependencies

From `backend/`:

```bash
python -m venv .venv
source .venv/bin/activate  # On macOS/Linux
# .venv\Scripts\activate   # On Windows PowerShell

python -m pip install --upgrade pip
python -m pip install -r requirements.txt
```

Verify imports:

```bash
python -c "from app.main import app; print(app.title)"
python -c "from app.config import settings; print(settings.database_url)"
```

## 6. Database migrations (Alembic)

Alembic is configured to use the async `DATABASE_URL` from settings.

From `backend/`:

```bash
alembic -c alembic.ini upgrade head
```

This will:

- Create the `tasks` table
- Create Postgres enums:
  - `task_source` (`canvas`, `gmail`, `calendar`)
  - `task_priority` (`high`, `medium`, `low`, `none`)
  - `task_status` (`pending`, `completed`, `archived`)

You can verify:

```bash
python - << 'PY'
import asyncio
from sqlalchemy import text
from app.database import AsyncSessionLocal

async def main() -> None:
    async with AsyncSessionLocal() as s:
        n = (await s.execute(text("SELECT COUNT(*) FROM tasks"))).scalar()
        print("tasks_count", n)

asyncio.run(main())
PY
```

## 7. Running the API

From `backend/`:

```bash
uvicorn app.main:app --reload
```

Endpoints:

- Health: `GET /health`
- Task API:
  - `GET /api/tasks`
  - `GET /api/tasks/{id}`
  - `POST /api/tasks`
  - `PATCH /api/tasks/{id}`
  - `DELETE /api/tasks/{id}`
- Canvas sync:
  - `POST /api/integrations/canvas/sync`

Interactive docs:

- Swagger UI: `http://localhost:8000/docs`
- ReDoc: `http://localhost:8000/redoc`

## 8. Canvas sync

### Manual sync (API)

With the server running:

```bash
curl -X POST http://localhost:8000/api/integrations/canvas/sync
```

You should see a JSON response like:

```json
{"created": 111, "updated": 0, "total": 111}
```

This:

- Calls Canvas `/courses` and `/courses/{id}/assignments`
- Normalizes assignments into the unified Task model
- Upserts tasks by `(source, external_id)`

### Background scheduler (optional)

To enable periodic sync:

- In `env.local.txt`:

```text
ENABLE_SCHEDULER=true
SYNC_INTERVAL_MINUTES=15
```

On app startup:

- `app/jobs/sync_scheduler.py` starts an `AsyncIOScheduler`
- A job runs `CanvasAdapter().sync(session)` every `SYNC_INTERVAL_MINUTES`

Disable by setting `ENABLE_SCHEDULER=false`.

## 9. Running tests

From `backend/`:

```bash
pytest -q
```

What’s covered:

- `test_tasks_api.py`
  - Async end-to-end Task CRUD flow via ASGI client + real DB
- `test_canvas_client.py`
  - Smoke test hitting real Canvas `/courses` (requires valid token)
  - Error-handling test that mocks `httpx` and asserts `IntegrationAuthError`

## 10. Notes

- This backend intentionally has **no user auth** yet (personal/local use).
- Task uniqueness is enforced by:

```text
UNIQUE (source, external_id)
```

- Canvas data is preserved in `tasks.source_metadata` (JSONB) for debugging and richer UI features later.


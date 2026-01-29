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
- `notion_api_token: str | None`
- `notion_database_id: str | None`
- `openai_api_key: str | None` - Optional: for AI-powered task prioritization
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
  - `POST /api/tasks/prioritize` - AI-powered task prioritization
- Integrations:
  - `GET /api/integrations/canvas/courses`
  - `POST /api/integrations/canvas/sync`
  - `POST /api/integrations/notion/sync`

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

## 9. Notion push

TaskFlow can **push** tasks to a Notion database so they appear as pages there. This is the opposite of Canvas (which **pulls** assignments into TaskFlow).

### Setup

1. Create a [Notion integration](https://www.notion.so/my-integrations) and copy the **Internal Integration Token**.
2. Create a new **database** in Notion (full-page or inside a page).
3. Add these properties (names and types must match exactly):

   | Property    | Type      | Notes                                                |
   |------------|-----------|------------------------------------------------------|
   | Name       | Title     | Default title                                       |
   | Description| Rich text |                                                      |
   | Due Date   | Date      |                                                      |
   | Priority   | Select    | Options: `high`, `medium`, `low`, `none`            |
   | Status     | Select    | Options: `pending`, `completed`, `archived`         |
   | Course     | Rich text | e.g. Canvas course name                             |
   | Source     | Rich text | e.g. `canvas`                                       |

4. Share the database with your integration (⋯ → Connections → Add connection).
5. Copy the database ID from the URL: `https://notion.so/...?v=...` or from the “Copy link” → the part after the workspace and before any `?`.
6. Set in `env.local.txt`:

   ```text
   NOTION_API_TOKEN=secret_...
   NOTION_DATABASE_ID=abc123...
   ```

### Sync API

```bash
# Push all tasks (up to 500)
curl -X POST http://localhost:8000/api/integrations/notion/sync

# Push tasks for selected Canvas courses (pending and archived only; completed are not in Notion)
curl -X POST http://localhost:8000/api/integrations/notion/sync \
  -H "Content-Type: application/json" \
  -d '{"course_ids": [1, 2, 3]}'

# Push specific tasks only
curl -X POST http://localhost:8000/api/integrations/notion/sync \
  -H "Content-Type: application/json" \
  -d '{"task_ids": ["uuid-1", "uuid-2"]}'
```

Response:

```json
{"created": 5, "updated": 2, "archived": 1, "failed": 0, "total": 7}
```

- **Completed tasks are not kept in Notion.** Any existing Notion page for a completed task is archived (removed from the database and Notion Calendar).
- Only **pending** and **archived** tasks are pushed: new pages are created or existing pages updated.
- All TaskFlow fields (title, description, due date, priority, status, course/source) are synced to the matching Notion properties.

Notes:

- If `task_ids` is provided, it takes precedence over `course_ids`.
- When `course_ids` is provided, only Canvas tasks with status `pending` or `archived` are pushed (completed tasks are not in Notion).

### Notion Calendar

TaskFlow pushes only non-completed tasks to one Notion database (`NOTION_DATABASE_ID`). To see those tasks in **Notion Calendar** (calendar.notion.so or the desktop app), connect Notion Calendar to that same database in its settings. Tasks appear on the calendar by **Due Date**. Completed tasks are not in the database, so they do not appear in Notion Calendar

## 10. AI-Powered Task Prioritization

TaskFlow can automatically prioritize tasks using a hybrid approach: date-based rules as baseline, with OpenAI analyzing task content to adjust priority based on urgency signals.

### Setup

1. Get an OpenAI API key from [platform.openai.com](https://platform.openai.com/api-keys).
2. Add to `env.local.txt`:

   ```text
   OPENAI_API_KEY=sk-...
   ```

### How It Works

**Baseline Priority (date-based):**
- **High**: Due date < 7 days away
- **Medium**: Due date 7-14 days away
- **Low**: Due date > 14 days away

**AI Adjustment:**
- OpenAI analyzes task title and description to detect urgency signals
- Examples: "final exam" → may boost to high even if >1 week away
- "optional reading" → may reduce to low even if deadline is near

**Smart Recalculation:**
- Priority is recalculated if:
  - Task priority is `none`, OR
  - Deadline changed significantly (>3 days), OR
  - Task previously had no due_date and now has one
- User-set priorities (`priority != "none"`) are preserved unless deadline changed significantly

### Automatic Prioritization

Tasks are automatically prioritized during Canvas sync. The sync response includes prioritization stats:

```json
{
  "created": 10,
  "updated": 5,
  "total": 15,
  "prioritized": 12,
  "skipped": 3,
  "ai_used": 8
}
```

### Manual Prioritization API

```bash
# Prioritize all pending tasks
curl -X POST http://localhost:8000/api/tasks/prioritize

# Prioritize specific tasks
curl -X POST http://localhost:8000/api/tasks/prioritize \
  -H "Content-Type: application/json" \
  -d '{"task_ids": ["uuid-1", "uuid-2"]}'

# Prioritize Canvas tasks from specific courses
curl -X POST http://localhost:8000/api/tasks/prioritize \
  -H "Content-Type: application/json" \
  -d '{"course_ids": [1, 2, 3]}'
```

Response:

```json
{
  "prioritized": 15,
  "skipped": 5,
  "ai_used": 10
}
```

### Notes

- If `OPENAI_API_KEY` is not set, prioritization falls back to date-based rules only
- OpenAI API failures/timeouts fall back to baseline priority (logged as warnings)
- Uses `gpt-4o-mini` model for cost efficiency
- Only pending tasks are prioritized (completed/archived are skipped)
- Tasks without `due_date` are skipped

## 10. Running tests

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

## 11. Notes

- This backend intentionally has **no user auth** yet (personal/local use).
- Task uniqueness is enforced by:

```text
UNIQUE (source, external_id)
```

- Canvas data is preserved in `tasks.source_metadata` (JSONB) for debugging and richer UI features later.


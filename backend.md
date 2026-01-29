# TaskFlow Backend — Developer & AI Agent Reference

This document describes **everything implemented** in the TaskFlow backend: structure, APIs, data model, integrations, configuration, and how to run it. Use it to onboard quickly or to hand off to another developer or AI agent.

---

## 1. Overview

**TaskFlow** is a **personal task aggregator**. The backend:

- Exposes a **unified Task API** (CRUD) backed by **PostgreSQL**.
- Integrates with **Canvas LMS**: fetch courses, sync assignments as tasks, and reflect **completion status** from Canvas submissions.
- Integrates with **Notion**: **push** tasks to a Notion database and **pull** status updates (e.g. completed in Notion) back into TaskFlow.
- Supports **course-based filtering** (list tasks by selected Canvas courses) and **date filtering** (`due_from` / `due_to`).
- Optionally runs a **background scheduler** to sync Canvas on an interval.

**Scope (current):** Single-user, no auth. Personal use only.

---

## 2. Tech Stack

| Layer | Technology |
|-------|------------|
| Language | Python 3.11+ |
| Web framework | FastAPI |
| Database | PostgreSQL 15 |
| ORM | SQLAlchemy 2.x (asyncio) |
| DB driver | asyncpg |
| Migrations | Alembic |
| HTTP client | httpx (async) |
| Config | pydantic-settings |
| Scheduler | APScheduler (optional) |
| Tests | pytest, pytest-asyncio |

---

## 3. Project Structure

```
backend/
├── app/
│   ├── __init__.py
│   ├── main.py              # FastAPI app, CORS, health, router mount, optional scheduler
│   ├── config.py            # Settings from env (database, Canvas, scheduler, CORS)
│   ├── database.py          # Async engine, session factory, get_db_session
│   ├── api/
│   │   ├── __init__.py
│   │   ├── dependencies.py  # DbSession dependency
│   │   └── routes/
│   │       ├── __init__.py  # api_router, includes tasks + integrations
│   │       ├── tasks.py     # Task CRUD + list filters (source, status, due_from/to, course_ids)
│   │       └── integrations.py  # Canvas: courses, sync; Notion: sync (push), pull (status)
│   ├── models/
│   │   ├── __init__.py
│   │   └── task.py          # Task SQLAlchemy model (UUID, enums, JSONB, indexes)
│   ├── schemas/
│   │   ├── __init__.py
│   │   └── task.py          # TaskCreate, TaskUpdate, TaskRead (Pydantic)
│   ├── services/
│   │   ├── __init__.py
│   │   ├── task_service.py  # CRUD + list_tasks with filters (incl. course_ids)
│   │   ├── sync_service.py  # upsert_tasks by (source, external_id), sync stats
│   │   └── priority_service.py  # AI-powered task prioritization (date rules + OpenAI)
│   ├── integrations/
│   │   ├── __init__.py
│   │   ├── base.py          # IntegrationBase ABC, IntegrationError / Auth / Request
│   │   ├── canvas/
│   │   │   ├── __init__.py
│   │   │   ├── client.py    # Canvas API client (courses, assignments, include submission)
│   │   │   ├── adapter.py   # CanvasAdapter: auth, list_courses, fetch_tasks, sync
│   │   │   └── schemas.py   # CanvasCourse, CanvasCourseListItem, CanvasSyncRequest, CanvasAssignment
│   │   └── notion/
│   │       ├── __init__.py
│   │       ├── client.py    # Notion API client (get_database, get_page, create/update/archive/unarchive_page, query_database)
│   │       ├── adapter.py   # NotionAdapter: push tasks to Notion, pull_status_updates from Notion
│   │       └── schemas.py   # NotionSyncRequest/Response, NotionPullRequest/Response
│   └── jobs/
│       ├── __init__.py
│       └── sync_scheduler.py  # APScheduler: run_canvas_sync_once, start/stop
├── alembic/
│   ├── env.py               # Async Alembic env, uses settings.database_url
│   ├── script.py.mako
│   └── versions/
│       ├── 20260128_0001_create_tasks_table.py  # tasks table, enums, indexes, unique constraint
│       └── 20260128_0002_add_notion_page_id_to_tasks.py  # notion_page_id column
├── tests/                   # pytest tests (when present)
├── alembic.ini
├── docker-compose.yml       # Postgres 15, taskflow DB, persistent volume
├── env.example.txt          # Example env vars (copy to env.local.txt)
├── requirements.txt
├── start-backend.sh         # Docker up → alembic upgrade → uvicorn
└── README.md                # Setup & run instructions
```

---

## 4. Configuration

### 4.1 Environment

- **Preferred local file:** `backend/env.local.txt` (git-ignored).  
- **Fallback:** `backend/.env`.  
- **Example:** `backend/env.example.txt`. Copy to `env.local.txt` and fill values.

Config is loaded via **pydantic-settings** in `app/config.py`. Env vars override file values.

### 4.2 Settings (`app.config.Settings`)

| Variable | Type | Default | Description |
|----------|------|---------|-------------|
| `database_url` | `str` | `postgresql+asyncpg://postgres:postgres@localhost:5432/taskflow` | Async SQLAlchemy URL |
| `canvas_api_url` | `str \| None` | `None` | Canvas base URL (no `/api/v1`). Required for Canvas. |
| `canvas_api_token` | `str \| None` | `None` | Canvas API token. Required for Canvas. |
| `notion_api_token` | `str \| None` | `None` | Notion integration token. Required for Notion push. |
| `notion_database_id` | `str \| None` | `None` | Notion database ID. Required for Notion push. |
| `openai_api_key` | `str \| None` | `None` | OpenAI API key. Optional: enables AI-powered task prioritization. |
| `enable_scheduler` | `bool` | `False` | If `True`, start APScheduler on app startup |
| `sync_interval_minutes` | `int` | `15` | Canvas sync interval when scheduler enabled |
| `cors_origins` | `str \| None` | `None` | Comma-separated allowed origins. If unset, `http://localhost:3000` and `http://127.0.0.1:3000` |

---

## 5. Database

### 5.1 Engine & Sessions

- **`app.database`**: `create_async_engine` with `pool_pre_ping=True`, `async_sessionmaker` → `AsyncSessionLocal`.
- **`get_db_session`**: Async generator yielding a session; used as FastAPI dependency `DbSession`.

### 5.2 Task Model (`app.models.task`)

- **Table:** `tasks`
- **Primary key:** `id` (UUID).
- **Uniqueness:** `UNIQUE (source, external_id)` → `uq_tasks_source_external_id`.
- **Indexes:** `ix_tasks_due_date`, `ix_tasks_source`.

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID | PK, default `uuid.uuid4` |
| `external_id` | VARCHAR(255) | Provider’s ID (e.g. Canvas assignment id) |
| `source` | ENUM | `canvas` \| `gmail` \| `calendar` |
| `source_metadata` | JSONB | Provider-specific payload (e.g. assignment + course). Default `{}`. |
| `title` | VARCHAR(500) | |
| `description` | TEXT | nullable |
| `due_date` | TIMESTAMPTZ | nullable |
| `priority` | ENUM | `high` \| `medium` \| `low` \| `none`; default `none` |
| `status` | ENUM | `pending` \| `completed` \| `archived`; default `pending` |
| `course_or_category` | VARCHAR(255) | nullable; e.g. Canvas course name |
| `notion_page_id` | VARCHAR(36) | nullable; Notion page ID when pushed |
| `created_at` | TIMESTAMPTZ | `now()` |
| `updated_at` | TIMESTAMPTZ | `now()`, updated on change |
| `synced_at` | TIMESTAMPTZ | `now()`; updated on sync upsert |

**Canvas tasks:** `source_metadata` includes `course: { id, name }`. Course id is used for `course_ids` filtering.

### 5.3 Migrations (Alembic)

- **Config:** `alembic.ini`; env uses `app.config.settings.database_url` and `app.database.Base`.
- **Initial migration:** `20260128_0001_create_tasks_table` creates enums (`task_source`, `task_priority`, `task_status`) with `checkfirst=True`, then `tasks` table and indexes.
- **`20260128_0002_add_notion_page_id_to_tasks`:** Adds `notion_page_id` column.
- **Run:** `alembic -c alembic.ini upgrade head` (from `backend/`).

---

## 6. API

### 6.1 Mount & Conventions

- **Prefix:** `/api`.
- **Health:** `GET /health` → `{"status": "ok"}` (no prefix).
- **CORS:** Configured via `config.cors_origins` or defaults for `localhost:3000` / `127.0.0.1:3000`.

### 6.2 Task Routes (`/api/tasks`)

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/tasks` | List tasks with optional filters and pagination |
| `GET` | `/api/tasks/{task_id}` | Get one task by UUID |
| `POST` | `/api/tasks` | Create task (body: `TaskCreate`) |
| `PATCH` | `/api/tasks/{task_id}` | Update task (body: `TaskUpdate`, partial) |
| `DELETE` | `/api/tasks/{task_id}` | Delete task |
| `POST` | `/api/tasks/prioritize` | Prioritize tasks using AI. Optional body: `{ "task_ids": [...] }`, `{ "course_ids": [...] }`, or no body (prioritize all pending tasks). Returns `{ prioritized, skipped, ai_used }`. 200 OK. |

**List query parameters:**

| Param | Type | Description |
|-------|------|-------------|
| `source` | `str` | Filter by source, e.g. `canvas` |
| `status` | `str` | `pending` \| `completed` \| `archived` |
| `due_from` | `datetime` (ISO) | Tasks with `due_date >= due_from` |
| `due_to` | `datetime` (ISO) | Tasks with `due_date <= due_to` |
| `course_ids` | `list[int]` | Restrict to Canvas tasks whose `source_metadata.course.id` is in this list (e.g. `?course_ids=1&course_ids=2`) |
| `limit` | `int` | Default 200, max 500 |
| `offset` | `int` | Default 0 |

**Ordering:** `due_date` ASC nulls last, then `created_at` DESC.

### 6.3 Integration Routes (`/api/integrations`)

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/integrations/canvas/courses` | List active Canvas courses for UI toggles. Returns `[{ id, name }]`. 401 if auth fails, 502 on request errors. |
| `POST` | `/api/integrations/canvas/sync` | Trigger Canvas sync. Optional body: `{ "course_ids": [1, 2, 3] }`. If present, only those courses are synced; otherwise all active courses. Returns `{ created, updated, total, prioritized, skipped, ai_used }`. 200 OK. 401 auth error, 502 request error. |
| `POST` | `/api/integrations/notion/sync` | Push tasks to Notion. Only **pending** and **archived** tasks are pushed; completed tasks are not kept in Notion (existing Notion pages for completed tasks are archived). Optional body: `{ "task_ids": ["uuid", ...] }` (takes precedence), or `{ "course_ids": [1, 2, 3] }` (Canvas only). If no body provided, pushes all non-completed (up to 500). Returns `{ created, updated, archived, failed, total }`. 200 OK. 401/502 on auth/request errors. |
| `POST` | `/api/integrations/notion/pull` | Pull status updates from Notion into TaskFlow. When Status is changed in Notion (e.g. completed), this syncs it back. Optional body: `{ "task_ids": ["uuid", ...] }`; if omitted, syncs all tasks with `notion_page_id`. Returns `{ updated, skipped, failed, total }`. 200 OK. 401/502 on auth/request errors. |

### 6.4 Dependencies

- **`DbSession`**: Injects `AsyncSession` from `get_db_session` into route handlers.

---

## 7. Services

### 7.1 Task Service (`app.services.task_service`)

- **`list_tasks`:** Applies filters (`source`, `status`, `due_from`, `due_to`, `course_ids`), orders, paginates. When `course_ids` is set, filters Canvas tasks by `source_metadata->course->id` (JSONB) in that list.
- **`get_task`:** By UUID; 404 if missing.
- **`create_task`:** Inserts from `TaskCreate`.
- **`update_task`:** Partial update from `TaskUpdate`; 404 if missing.
- **`delete_task`:** Delete by UUID; 404 if missing.

### 7.2 Sync Service (`app.services.sync_service`)

- **`upsert_tasks(session, tasks: list[TaskCreate])`:** Upserts by `(source, external_id)` using PostgreSQL `INSERT ... ON CONFLICT (uq_tasks_source_external_id) DO UPDATE`.
- **On conflict**, overwrites: `source_metadata`, `title`, `description`, `due_date`, `course_or_category`, `synced_at`, **`status`** (from provider, e.g. Canvas submission). **`priority`** is **not** overwritten (user-owned).
- **After upsert**, automatically prioritizes tasks that were created/updated using `priority_service.prioritize_task()`.
- **Returns:** `{ created, updated, total, prioritized, skipped, ai_used }` (best-effort from pre-check of existing `(source, external_id)`).
- New rows use `uuid.uuid4()` for `id`.

### 7.3 Priority Service (`app.services.priority_service`)

- **`calculate_priority_baseline(due_date, status)`:** Date-based priority rules: `< 7 days` → `high`, `7-14 days` → `medium`, `> 14 days` → `low`. Returns `None` if task is completed/archived or has no due_date.
- **`analyze_with_ai(title, description, baseline, due_date)`:** Calls OpenAI API (`gpt-4o-mini`) to analyze task content and adjust priority. Falls back to baseline on API failure or missing key.
- **`should_recalculate_priority(task, new_due_date)`:** Returns `True` if priority is `none`, deadline changed significantly (>3 days), or task gained a due_date.
- **`prioritize_task(task, use_ai=True)`:** Main entry point: checks recalculation logic, computes baseline, optionally calls AI, returns priority or `None` (skip).

---

## 8. Integrations

### 8.1 Base (`app.integrations.base`)

- **`IntegrationBase`** (ABC): `name`, `authenticate()`, `fetch_tasks()`, `sync(session)`.
- **Exceptions:** `IntegrationError`, `IntegrationAuthError`, `IntegrationRequestError`. Used by routes and scheduler.

### 8.2 Canvas Client (`app.integrations.canvas.client`)

- **`CanvasClient`:** Async HTTP client for Canvas REST API. Base URL normalized (optional `/api/v1` stripped).
- **Auth:** `Authorization: Bearer {token}`.
- **Endpoints used:**
  - `GET /users/self` — available but not required for sync.
  - `GET /courses` — list courses; `enrollment_state` (default `active`), `per_page`.
  - `GET /courses/{id}` — single course; returns `None` on error.
  - `GET /courses/{id}/assignments` — list assignments; optional `include[]=submission` to embed current user’s submission per assignment.

**Completion status:** When `include_submission=True`, each assignment can include a `submission` object. If `submission.submitted_at` is present, the task is treated as **completed**; otherwise **pending**.

### 8.3 Canvas Adapter (`app.integrations.canvas.adapter`)

- **`CanvasAdapter`** implements `IntegrationBase` for Canvas.
- **Auth:** Requires `CANVAS_API_URL` and `CANVAS_API_TOKEN`. `authenticate()` calls `list_courses(per_page=1)`.
- **`list_courses()`:** Returns `[CanvasCourseListItem(id, name)]` for UI toggles (active courses only).
- **`fetch_tasks(course_ids=None)`:**
  - If `course_ids`: fetches each course by id via `get_course`, then assignments for that course.
  - Else: fetches all active courses, then assignments per course.
  - Uses **`list_assignments(course_id, include_submission=True)`** so each assignment carries submission info.
  - Builds `TaskCreate` per assignment; sets `status` from `submission.submitted_at` (completed vs pending), stores `source_metadata` with `course: { id, name }` and assignment payload (`model_dump(mode="json")` for JSON-safe datetimes).
- **`sync(session, course_ids=None)`:** Calls `authenticate()`, `fetch_tasks(course_ids=course_ids)`, then `upsert_tasks(session, tasks)`.

### 8.4 Canvas Schemas (`app.integrations.canvas.schemas`)

- **`CanvasCourse`:** `id`, `name` (plus extra allowed).
- **`CanvasCourseListItem`:** `id`, `name` for API responses.
- **`CanvasSyncRequest`:** Optional `course_ids: list[int] | None` for `POST /canvas/sync` body.
- **`CanvasAssignment`:** `id`, `name`, `description`, `due_at`, `course`, `submission` (optional; when `include[]=submission`).

### 8.5 Notion (push to Notion, pull status from Notion)

- **Direction:** TaskFlow **pushes** tasks to a Notion database (destination) and can **pull** status changes from Notion back into TaskFlow.
- **Config:** `NOTION_API_TOKEN`, `NOTION_DATABASE_ID`. Database must have properties: **Name** (title), **Description** (rich_text), **Due Date** (date), **Priority** (select: high|medium|low|none), **Status** (select: pending|completed|archived), **Course** (rich_text), **Source** (rich_text).
- **`NotionClient`** (`app.integrations.notion.client`): `get_database`, `get_page`, `query_database`, `create_page`, `update_page`, `archive_page`, `unarchive_page`. Uses Notion API `2022-06-28`.
- **`NotionAdapter`** (`app.integrations.notion.adapter`): `authenticate()`, `push(session, task_ids=None, course_ids=None, limit=500)` — only **pending** and **archived** tasks are pushed; **completed** tasks are not kept in Notion (any existing Notion page for a completed task is archived so it disappears from the database and calendar). Creates pages for tasks without `notion_page_id`, updates otherwise (and unarchives pages if Notion returns “archived” on update); stores `notion_page_id` on tasks. Returns `{ created, updated, archived, failed, total }`. `pull_status_updates(session, task_ids=None)` — reads Status from Notion pages and updates TaskFlow tasks; optional `task_ids` or all tasks with `notion_page_id`; returns `{ updated, skipped, failed, total }`.
- **Notion schemas** (`app.integrations.notion.schemas`): `NotionSyncRequest` (task_ids, course_ids), `NotionSyncResponse` (created, updated, archived, failed, total); `NotionPullRequest` (task_ids), `NotionPullResponse` (updated, skipped, failed, total).
- **`Task`** model has nullable `notion_page_id`; **`TaskRead`** exposes it. Push converts HTML in descriptions to plain text for Notion (e.g. Canvas assignment HTML).
- **Completed tasks:** Completed tasks are **not** stored in Notion. When pushing, any task with status **completed** that already has a Notion page has that page archived (removed from the database and from Notion Calendar). Only pending and archived tasks are created or updated in Notion.
- **Notion Calendar:** TaskFlow pushes only non-completed tasks to a single Notion database (`NOTION_DATABASE_ID`). To see those tasks in **Notion Calendar**, connect Notion Calendar to that same database in its settings. Tasks appear on the calendar by **Due Date**. Completed tasks are not in the database, so they do not appear in Notion Calendar.

---

## 9. Background Scheduler (`app.jobs.sync_scheduler`)

- **`run_canvas_sync_once()`:** Runs one Canvas sync using `CanvasAdapter().sync(session)` (all active courses; no `course_ids`). Catches `IntegrationAuthError` / `IntegrationRequestError` and logs; does not crash the app.
- **`start_scheduler()`:** If `enable_scheduler` is `True`, starts `AsyncIOScheduler` with an interval job (`sync_interval_minutes`) for `run_canvas_sync_once`.
- **`shutdown_scheduler()`:** Stops the scheduler on app shutdown.

Startup/shutdown hooks are registered in `app.main` only when `enable_scheduler` is `True`.

---

## 10. Running the Backend

### 10.1 PostgreSQL (Docker)

From project root or `backend/`:

```bash
docker compose -f backend/docker-compose.yml up -d
```

- Image: `postgres:15`, container `taskflow-postgres`, port `5432`.
- DB `taskflow`, user `postgres`, password `postgres`.
- Volume `taskflow_pg_data` for persistence.

### 10.2 Env Setup

1. Copy `backend/env.example.txt` to `backend/env.local.txt`.
2. Set `DATABASE_URL` if different from default.
3. Set `CANVAS_API_URL` and `CANVAS_API_TOKEN` for Canvas.
4. Optional: `NOTION_API_TOKEN` and `NOTION_DATABASE_ID` for Notion push and pull.

### 10.3 Migrations

From `backend/`:

```bash
alembic -c alembic.ini upgrade head
```

### 10.4 API Server

From `backend/`:

```bash
uvicorn app.main:app --reload
```

- API: `http://localhost:8000`
- Docs: `http://localhost:8000/docs`, `http://localhost:8000/redoc`

### 10.5 One-Command Startup

From `backend/`:

```bash
./start-backend.sh
```

This will:

1. `docker compose up -d` (Postgres).
2. `alembic upgrade head`.
3. `uvicorn app.main:app --reload`.

---

## 11. Testing

- **Framework:** pytest, pytest-asyncio.
- **Location:** `backend/tests/` (e.g. `test_tasks_api.py`, `test_canvas_client.py` when present).
- **Task API:** Async integration tests using ASGI transport + real DB; CRUD and list behavior.
- **Canvas client:** Smoke test against live Canvas API (requires valid token) and error-handling tests with mocked httpx.

Run from `backend/`:

```bash
pytest -q
```

---

## 12. Design Notes

- **No auth:** Backend is single-user, no auth. Frontend uses CORS for same-origin or configured origins.
- **Task identity:** `(source, external_id)` uniquely identifies a task; sync upserts on that.
- **Provider vs user fields:** On sync, provider-owned fields (including `status` from Canvas) are overwritten; `priority` is kept.
- **Canvas completion:** Driven by `include[]=submission` and `submitted_at`. No per-assignment submission API or `/users/self` required for sync.
- **Course filtering:** `course_ids` on `GET /api/tasks` filters Canvas tasks by `source_metadata.course.id`. Used by the Agenda UI for “selected courses” views.
- **Date filtering:** `due_from` / `due_to` support agenda “from date onwards” and other range queries. Send ISO datetimes; backend uses `DateTime(timezone=True)`.
- **AI prioritization:** Tasks are automatically prioritized during sync using date-based rules + OpenAI content analysis. Manual prioritization via `POST /api/tasks/prioritize`. Falls back to baseline if OpenAI API fails or key is missing.
- **Notion pull:** `POST /api/integrations/notion/pull` reads the Status property from Notion pages and updates the corresponding TaskFlow tasks. Use after marking tasks completed/archived in Notion so TaskFlow stays in sync.

---

## 13. Quick Reference: Key Files

| Purpose | File |
|--------|------|
| App entry, CORS, scheduler hooks | `app/main.py` |
| Config | `app/config.py` |
| DB engine & session | `app/database.py` |
| Task model | `app/models/task.py` |
| Task schemas | `app/schemas/task.py` |
| Task CRUD API | `app/api/routes/tasks.py` |
| Canvas & Notion integrations API | `app/api/routes/integrations.py` |
| Task business logic | `app/services/task_service.py` |
| Sync upsert | `app/services/sync_service.py` |
| AI prioritization | `app/services/priority_service.py` |
| Integration contract | `app/integrations/base.py` |
| Canvas API client | `app/integrations/canvas/client.py` |
| Canvas sync logic | `app/integrations/canvas/adapter.py` |
| Canvas DTOs | `app/integrations/canvas/schemas.py` |
| Notion client | `app/integrations/notion/client.py` |
| Notion push & pull logic | `app/integrations/notion/adapter.py` |
| Notion DTOs | `app/integrations/notion/schemas.py` |
| Scheduled sync | `app/jobs/sync_scheduler.py` |
| Migrations | `alembic/versions/` |
| Run script | `backend/start-backend.sh` |

---

*This document reflects the state of the TaskFlow backend as implemented. For setup details and day-to-day usage, see `backend/README.md`.*

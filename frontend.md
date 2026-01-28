# TaskFlow Frontend — Developer & AI Agent Reference

This document describes **everything implemented** in the TaskFlow frontend: structure, routing, components, hooks, API client, utilities, and styling. Use it to onboard quickly or to hand off to another developer or AI agent.

---

## 1. Overview

The **TaskFlow** frontend is a **Next.js** app that consumes the TaskFlow backend API. It provides:

- **Dashboard (/tasks):** Unified task list with filters (source, status, course/category), grouped into **Today**, **This Week**, **Later**, and **No Due Date**. Checkbox toggles for completion.
- **Agenda (/agenda):** Canvas-style agenda view. User selects **Canvas courses** (checkboxes) and a **start date**; tasks **from that date onwards** are fetched and grouped by day. Completed tasks show with strikethrough. Optional **Sync selected** and **Refresh**.
- **Settings (/settings):** Manual **Canvas sync** trigger; displays sync result (created/updated/total).

**Scope:** Single-user, no auth. Dark-themed UI (slate/sky). Responsive layout with sidebar + main content.

---

## 2. Tech Stack

| Layer | Technology |
|-------|------------|
| Framework | Next.js 16 (App Router) |
| Language | TypeScript |
| UI | React 19 |
| Styling | Tailwind CSS 4 |
| Icons | lucide-react |
| Fonts | Geist Sans, Geist Mono (Google Fonts) |

---

## 3. Project Structure

```
frontend/
├── app/                    # App Router entry (re-exports from src/app)
│   ├── layout.tsx          # → src/app/layout
│   ├── page.tsx            # → src/app/page (redirect / → /tasks)
│   ├── tasks/page.tsx      # → src/app/tasks/page
│   ├── agenda/page.tsx     # → src/app/agenda/page
│   ├── settings/page.tsx   # → src/app/settings/page
│   ├── globals.css
│   └── favicon.ico
├── src/
│   ├── app/                # Actual App Router impl
│   │   ├── layout.tsx      # Root layout: Sidebar + Header + main
│   │   ├── page.tsx        # redirect("/tasks")
│   │   ├── globals.css     # Tailwind, CSS variables, body styles
│   │   ├── tasks/page.tsx  # Renders <TasksDashboard />
│   │   ├── agenda/page.tsx # Renders <AgendaView />
│   │   └── settings/page.tsx # Client: Canvas sync UI
│   ├── components/
│   │   ├── layout/
│   │   │   ├── Sidebar.tsx    # Nav: Dashboard, Agenda, Settings
│   │   │   └── Header.tsx     # Page title (Dashboard / Agenda / Settings)
│   │   ├── tasks/
│   │   │   ├── TasksDashboard.tsx # Filters, TaskList grid (Today/Week/Later/No Due)
│   │   │   ├── TaskList.tsx       # Section with title + TaskCard list
│   │   │   ├── TaskCard.tsx       # Checkbox, title, course, DueDateBadge, priority, source Badge
│   │   │   ├── TaskFilters.tsx    # Source / Status / Course selects + Refresh
│   │   │   └── DueDateBadge.tsx   # Relative due (e.g. "Due tomorrow") + colors
│   │   ├── agenda/
│   │   │   └── AgendaView.tsx     # Course toggles, date picker, Sync, day‑grouped list
│   │   └── ui/
│   │       ├── Button.tsx   # primary | secondary | ghost | danger
│   │       ├── Badge.tsx    # default | canvas | gmail | calendar | muted
│   │       └── Card.tsx     # Wrapper div with border/bg
│   ├── hooks/
│   │   ├── useTasks.ts     # Fetch tasks, filters, refetch, updateTaskLocal (toggle complete)
│   │   └── useAgenda.ts    # Courses, selectedCourseIds, startDate, tasks, sync, toggle complete
│   ├── lib/
│   │   ├── api.ts          # getTasks, getTask, patchTask, createTask, deleteTask, Canvas APIs
│   │   └── utils.ts        # format.relativeDueDate, groupTasksByDueBucket, groupTasksByDay, dateKey, formatAgendaTime, formatDayHeader, todayYYYYMMDD, toISOStartOfLocalDay
│   └── types/
│       └── index.ts        # Task, TaskSource, TaskPriority, TaskStatus
├── public/                 # Static assets (svgs, etc.)
├── tailwind.config.ts      # content: src/app, src/components
├── postcss.config.mjs      # @tailwindcss/postcss
├── next.config.ts
├── tsconfig.json           # paths: "@/*" → "./src/*"
└── package.json
```

**Routing:** Next.js App Router. Routes live under `app/`; implementation is in `src/app/` and re-exported from `app/` (e.g. `app/agenda/page.tsx` → `src/app/agenda/page`). Path alias `@/*` maps to `./src/*`.

---

## 4. Routes & Pages

| Path | Page | Description |
|------|------|-------------|
| `/` | `src/app/page` | Redirects to `/tasks` |
| `/tasks` | `src/app/tasks/page` | Renders `<TasksDashboard />` |
| `/agenda` | `src/app/agenda/page` | Renders `<AgendaView />` |
| `/settings` | `src/app/settings/page` | Client component: Canvas sync trigger, result display |

**Layout:** Root layout (`src/app/layout.tsx`) wraps all pages with:

- **Sidebar** (desktop: left; mobile: top bar + slide‑down nav).
- **Header** (desktop only): title derived from pathname (Dashboard / Agenda / Settings).
- **Main:** `{children}` with padding.

---

## 5. Layout Components

### 5.1 Sidebar (`@/components/layout/Sidebar`)

- **Desktop:** Fixed-width left sidebar; TaskFlow branding; nav links (Dashboard, Agenda, Settings) with icons (LayoutList, CalendarDays, Settings). Active route highlighted.
- **Mobile:** Top bar with hamburger; slide‑down nav with same links. Link click closes nav.
- **Active state:** `/` and `/tasks` both count as Dashboard. `/agenda` and subpaths count as Agenda.

### 5.2 Header (`@/components/layout/Header`)

- **Desktop only** (`hidden` on small screens). Sticky; shows page title (Dashboard | Agenda | Settings) and subtitle “View and manage your unified task list.”

---

## 6. Task Dashboard (`/tasks`)

### 6.1 TasksDashboard (`@/components/tasks/TasksDashboard`)

- **State:** `filters` (source, status, courseOrCategory); `useTasks(filters)` for tasks, loading, error, refetch, `updateTaskLocal`.
- **UI:** Title + description; **TaskFilters** in a **Card**; loading/error/empty messages; grid of **TaskList** sections (Today, This Week, Later, No Due Date) via `groupTasksByDueBucket(tasks)`.
- **Toggle complete:** `handleToggleComplete` → `updateTaskLocal(task.id, { status })` (flip completed ↔ pending).

### 6.2 TaskFilters (`@/components/tasks/TaskFilters`)

- **Selects:** Source (all | canvas | gmail | calendar), Status (pending | completed | archived | all), Course / Category (all | distinct `course_or_category` from current tasks).
- **Refresh** button → `onRefresh` (refetch).
- Course options are derived from **current task list** (not from Canvas courses API).

### 6.3 TaskList (`@/components/tasks/TaskList`)

- **Props:** `title`, `tasks`, `onToggleComplete`.
- Renders a section with heading, task count, and a list of **TaskCard**s.

### 6.4 TaskCard (`@/components/tasks/TaskCard`)

- **Props:** `task`, `onToggleComplete`.
- Checkbox (checked when `status === "completed"`); title (strikethrough when completed); `course_or_category`; **DueDateBadge**; priority pill (if not none); **Badge** for source (canvas / gmail / calendar).
- Left border color by priority (red / amber / emerald / slate).

### 6.5 DueDateBadge (`@/components/tasks/DueDateBadge`)

- **Props:** `dueDate` (ISO string or null).
- Uses `format.relativeDueDate(dueDate)` → `relative`, `absolute`, `isOverdue`, `isSoon`. Renders relative text; tooltip `title={absolute}`. Colors: red (overdue), amber (soon), slate (default). “No due date” when null.

---

## 7. Agenda (`/agenda`)

### 7.1 AgendaView (`@/components/agenda/AgendaView`)

- **Data:** `useAgenda()` → courses, loading/error for courses, `selectedCourseIds`, `startDate`, tasks, loading/error for tasks, `refetch`, `toggleComplete`.
- **Course toggles:** Checkboxes per Canvas course. Selection persisted in `localStorage` (`taskflow_agenda_course_ids`). “Sync selected” → `triggerCanvasSync(selectedCourseIds)` then refetch. “Refresh” → refetch.
- **Date:** “From date” `<input type="date">` bound to `startDate`. “Today” sets `startDate` to today. Date range display (first–last day of shown tasks).
- **View tabs:** “Agenda” active; “Week” and “Month” placeholders (no behavior).
- **Empty states:** No courses selected → “Select at least one course…”. No tasks from `startDate` onward → “No tasks from {date} onwards…”.
- **Task list:** Tasks grouped by day (`groupTasksByDay`), sorted by `due_date`. Each day: header (e.g. “Wed, Jan 28”) + list of **AgendaItem**s. `todayRef` / `todayKey` used to mark today’s section (for potential scroll-to-today).

### 7.2 AgendaItem (internal to AgendaView)

- Checkbox, “Due {time}” (local), `course_or_category`, title. Strikethrough when completed. `onToggleComplete` → `patchTask` and local state update.

---

## 8. Settings (`/settings`)

- **Canvas Sync:** “Sync now” calls `triggerCanvasSync()` (no `course_ids`; backend syncs all active courses). Shows loading, error, and result (created/updated/total).

---

## 9. Hooks

### 9.1 useTasks (`@/hooks/useTasks`)

- **Input:** `filters: TaskFiltersState` (`source`, `status`, `courseOrCategory`).
- **Output:** `tasks`, `isLoading`, `error`, `refetch`, `updateTaskLocal(id, changes)`.
- **Fetch:** `getTasks` with `source` / `status` from filters. `courseOrCategory` applied **client-side** by filtering `tasks` on `course_or_category`.
- **updateTaskLocal:** Optimistic update; `patchTask` with `status`, `priority`, etc.; rollback on failure.

### 9.2 useAgenda (`@/hooks/useAgenda`)

- **Output:** `courses`, `coursesLoading`, `coursesError`, `selectedCourseIds`, `setSelectedCourseIds`, `startDate`, `setStartDate`, `tasks`, `isLoading`, `error`, `refetch`, `toggleComplete(task)`.
- **Courses:** Fetched via `getCanvasCourses()` on mount. Stored only in state.
- **Selected course IDs:** State + `localStorage` (`taskflow_agenda_course_ids`). Restored from storage in `useEffect` after mount (avoids hydration mismatch).
- **Start date:** State, default `todayYYYYMMDD()`.
- **Tasks:** Fetched only when `selectedCourseIds.length > 0`. `getTasks({ course_ids: selectedCourseIds, due_from: toISOStartOfLocalDay(startDate) })`. Refetches when `selectedCourseIds` or `startDate` change.
- **toggleComplete:** Flips `status` in state, calls `patchTask`, reverts on error.

---

## 10. API Client (`@/lib/api`)

- **Base URL:** `process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000"`.
- **Shared:** `apiFetch<T>(path, options)` — `fetch` with JSON headers; throws on non‑ok; returns `res.json()`.

| Function | Method | Path | Purpose |
|----------|--------|------|---------|
| `getTasks(params?)` | GET | `/api/tasks` | List tasks. Params: `source`, `status`, `due_from`, `due_to`, `course_ids` (appended as repeated query). |
| `getTask(id)` | GET | `/api/tasks/{id}` | Single task. |
| `patchTask(id, data)` | PATCH | `/api/tasks/{id}` | Update task (partial). |
| `createTask(data)` | POST | `/api/tasks` | Create task. |
| `deleteTask(id)` | DELETE | `/api/tasks/{id}` | Delete task. |
| `getCanvasCourses()` | GET | `/api/integrations/canvas/courses` | List Canvas courses for toggles. |
| `triggerCanvasSync(courseIds?)` | POST | `/api/integrations/canvas/sync` | Sync Canvas. Body `{ course_ids }` when `courseIds?.length`; otherwise `{}`. |

---

## 11. Utils (`@/lib/utils`)

| Function | Purpose |
|----------|---------|
| `format.relativeDueDate(due)` | `absolute` (locale string), `relative` (e.g. “Due tomorrow”), `isOverdue`, `isSoon`. |
| `groupTasksByDueBucket(tasks)` | Buckets: `today`, `thisWeek`, `later`, `noDueDate`. Uses local start-of-day and +7 days. Overdue included in “today”. |
| `dateKey(d)` | Local `YYYY-MM-DD` from `Date` (for grouping; avoids UTC off‑by‑one). |
| `groupTasksByDay(tasks)` | `Map<YYYY-MM-DD, Task[]>`; tasks without `due_date` skipped; per‑day lists sorted by `due_date`. |
| `formatAgendaTime(dueDate)` | Local time like “5:59pm” or “11:59pm”. |
| `formatDayHeader(dateKeyStr)` | “Wed, Jan 28” from `YYYY-MM-DD`. |
| `todayYYYYMMDD()` | Today as local `YYYY-MM-DD`. |
| `toISOStartOfLocalDay(dateStr)` | Start of local day as ISO string with offset (for `due_from`). |

---

## 12. Types (`@/types`)

- **TaskSource:** `"canvas" | "gmail" | "calendar"`.
- **TaskPriority:** `"high" | "medium" | "low" | "none"`.
- **TaskStatus:** `"pending" | "completed" | "archived"`.
- **Task:** `id`, `external_id`, `source`, `title`, `description`, `due_date` (ISO or null), `priority`, `status`, `course_or_category`, `created_at`, `updated_at`, `synced_at`.

---

## 13. UI Primitives

- **Button:** `variant` = primary | secondary | ghost | danger. Forwards `className` and normal button props.
- **Badge:** `variant` = default | canvas | gmail | calendar | muted. Used for task source.
- **Card:** Wrapper `div` with border, background, rounded corners. Used for filters container, etc.

---

## 14. Styling

- **Tailwind 4:** `@import "tailwindcss"` in `globals.css`. Theme extends with `--color-background`, `--color-foreground`, Geist font variables.
- **Colors:** Slate backgrounds (e.g. `slate-950`, `slate-900`), sky accents, red/amber for overdue/soon. Dark theme via CSS variables.
- **Tailwind content:** `src/app/**`, `src/components/**`.

---

## 15. Environment

- **`NEXT_PUBLIC_API_URL`:** Backend base URL. Default `http://localhost:8000` when unset.

---

## 16. Design Notes

- **Hydration:** Agenda restores `selectedCourseIds` from `localStorage` in `useEffect` only (initial state `[]`) to avoid server/client mismatch.
- **Dates:** Agenda uses **local** date for grouping and “from date” (e.g. `dateKey`, `toISOStartOfLocalDay`) to prevent off‑by‑one day issues.
- **Dashboard course filter:** Uses `course_or_category` from **already fetched** tasks (no `course_ids` API). Agenda uses `course_ids` and Canvas courses API.
- **Agenda “from date”:** Tasks are fetched with `due_from` = start of selected day (local → ISO with offset). Default start date is today.

---

## 17. Quick Reference: Key Files

| Purpose | File |
|--------|------|
| Root layout, Sidebar + Header | `src/app/layout.tsx` |
| Redirect / → /tasks | `src/app/page.tsx` |
| Tasks page | `src/app/tasks/page.tsx` |
| Agenda page | `src/app/agenda/page.tsx` |
| Settings page | `src/app/settings/page.tsx` |
| Sidebar nav | `src/components/layout/Sidebar.tsx` |
| Page header | `src/components/layout/Header.tsx` |
| Task dashboard | `src/components/tasks/TasksDashboard.tsx` |
| Task filters | `src/components/tasks/TaskFilters.tsx` |
| Task list section | `src/components/tasks/TaskList.tsx` |
| Task card | `src/components/tasks/TaskCard.tsx` |
| Due date badge | `src/components/tasks/DueDateBadge.tsx` |
| Agenda view | `src/components/agenda/AgendaView.tsx` |
| Button / Badge / Card | `src/components/ui/*.tsx` |
| Task data + toggle | `src/hooks/useTasks.ts` |
| Agenda data + sync | `src/hooks/useAgenda.ts` |
| API client | `src/lib/api.ts` |
| Date/task utils | `src/lib/utils.ts` |
| Task types | `src/types/index.ts` |
| Global styles | `src/app/globals.css` |
| Tailwind config | `tailwind.config.ts` |

---

## 18. Running the Frontend

From `frontend/`:

```bash
npm install
npm run dev
```

App runs at `http://localhost:3000`. Ensure the backend is up (e.g. `http://localhost:8000`) and CORS allows the frontend origin.

---

*This document reflects the state of the TaskFlow frontend as implemented. See `frontend/README.md` for additional setup details if present.*

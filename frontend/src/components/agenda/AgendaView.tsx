"use client";

import { useRef, useState } from "react";
import type { Task } from "@/types";
import { useAgenda } from "@/hooks/useAgenda";
import {
  groupTasksByDay,
  formatAgendaTime,
  formatDayHeader,
  dateKey,
  todayYYYYMMDD,
} from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import { triggerCanvasSync } from "@/lib/api";
import { Calendar, Loader2 } from "lucide-react";

export function AgendaView() {
  const [syncing, setSyncing] = useState(false);
  const {
    courses,
    coursesLoading,
    coursesError,
    selectedCourseIds,
    setSelectedCourseIds,
    startDate,
    setStartDate,
    tasks,
    isLoading,
    error,
    refetch,
    toggleComplete,
  } = useAgenda();

  const todayRef = useRef<HTMLDivElement | null>(null);
  const todayKey = dateKey(new Date());

  const handleTodayClick = () => {
    setStartDate(todayYYYYMMDD());
  };

  const toggleCourse = (id: number) => {
    const next = selectedCourseIds.includes(id)
      ? selectedCourseIds.filter((c) => c !== id)
      : [...selectedCourseIds, id];
    setSelectedCourseIds(next);
  };

  const handleSync = async () => {
    if (!selectedCourseIds.length) return;
    setSyncing(true);
    try {
      await triggerCanvasSync(selectedCourseIds);
      refetch();
    } catch {
      /* feedback via refetch error if needed */
    } finally {
      setSyncing(false);
    }
  };

  const byDay = groupTasksByDay(tasks);
  const sortedDays = Array.from(byDay.keys()).sort();
  const dateRange =
    sortedDays.length > 0
      ? `${formatDayHeader(sortedDays[0]!)} – ${formatDayHeader(sortedDays[sortedDays.length - 1]!)}`
      : "–";

  return (
    <div className="space-y-4 md:space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-slate-50 md:text-2xl">
          Agenda
        </h1>
        <p className="mt-1 text-xs text-slate-400 md:text-sm">
          Select courses and a start date. Tasks from that date onwards are
          shown, grouped by day. Completed tasks show with a strikethrough.
        </p>
      </div>

      {/* Course toggles */}
      <section className="rounded-xl border border-slate-800 bg-slate-900/40 p-4">
        <h2 className="mb-3 text-sm font-medium text-slate-300">
          Courses to show
        </h2>
        {coursesLoading && (
          <p className="text-sm text-slate-400">Loading courses…</p>
        )}
        {coursesError && (
          <p className="text-sm font-medium text-red-400">{coursesError}</p>
        )}
        {!coursesLoading && !coursesError && courses.length === 0 && (
          <p className="text-sm text-slate-500">
            No Canvas courses. Configure Canvas in Settings and sync, or sync
            below after selecting.
          </p>
        )}
        <div className="flex flex-wrap gap-2">
          {courses.map((c) => {
            const checked = selectedCourseIds.includes(c.id);
            return (
              <label
                key={c.id}
                className="flex cursor-pointer items-center gap-2 rounded-lg border border-slate-700 bg-slate-950/60 px-3 py-2 text-sm transition-colors hover:border-slate-600 hover:bg-slate-900/60 has-[:checked]:border-sky-500 has-[:checked]:bg-sky-500/10"
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggleCourse(c.id)}
                  className="h-4 w-4 rounded border-slate-600 bg-slate-900 text-sky-500"
                />
                <span className="text-slate-200">
                  {c.name ?? `Course ${c.id}`}
                </span>
              </label>
            );
          })}
        </div>
        {!coursesLoading && courses.length > 0 && (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Button
              variant="secondary"
              onClick={handleSync}
              disabled={!selectedCourseIds.length || syncing || isLoading}
            >
              {syncing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "Sync selected"
              )}
            </Button>
            <Button variant="secondary" onClick={refetch}>
              Refresh
            </Button>
          </div>
        )}
      </section>

      {/* Start date, Today, date range, view */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex flex-col gap-1 text-xs text-slate-400">
            <span>From date</span>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="rounded-md border border-slate-700 bg-slate-950/80 px-2 py-1.5 text-sm text-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
              aria-label="Show tasks from this date onwards"
            />
          </label>
          <Button variant="secondary" onClick={handleTodayClick}>
            Today
          </Button>
          <span className="text-sm text-slate-400">{dateRange}</span>
        </div>
        <div className="flex items-center gap-1 rounded-lg border border-slate-800 bg-slate-950/60 p-1">
          <span className="rounded-md bg-slate-800 px-2 py-1 text-xs font-medium text-slate-200">
            Agenda
          </span>
          <span className="rounded px-2 py-1 text-xs text-slate-500">
            Week
          </span>
          <span className="rounded px-2 py-1 text-xs text-slate-500">
            Month
          </span>
        </div>
      </div>

      {!selectedCourseIds.length && (
        <div className="rounded-xl border border-slate-800 bg-slate-900/30 p-8 text-center">
          <Calendar className="mx-auto h-10 w-10 text-slate-600" />
          <p className="mt-2 text-sm text-slate-400">
            Select at least one course above to view the agenda.
          </p>
        </div>
      )}

      {selectedCourseIds.length > 0 && error && (
        <p className="text-sm font-medium text-red-400">{error}</p>
      )}

      {selectedCourseIds.length > 0 && isLoading && (
        <p className="text-sm text-slate-400">Loading tasks…</p>
      )}

        {selectedCourseIds.length > 0 &&
        !isLoading &&
        !error &&
        sortedDays.length === 0 && (
          <p className="text-sm text-slate-400">
            No tasks from {formatDayHeader(startDate)} onwards for the selected
            courses. Sync above, choose an earlier date, or add tasks elsewhere.
          </p>
        )}

      {selectedCourseIds.length > 0 && !isLoading && sortedDays.length > 0 && (
        <div className="space-y-6">
          {sortedDays.map((dayKey) => (
            <section
              key={dayKey}
              ref={dayKey === todayKey ? todayRef : undefined}
              className="rounded-xl border border-slate-800 bg-slate-900/30 p-4"
            >
              <h2 className="mb-3 text-sm font-semibold text-slate-200">
                {formatDayHeader(dayKey)}
              </h2>
              <ul className="space-y-2">
                {(byDay.get(dayKey) ?? []).map((task) => (
                  <AgendaItem
                    key={task.id}
                    task={task}
                    onToggleComplete={toggleComplete}
                  />
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

interface AgendaItemProps {
  task: Task;
  onToggleComplete: (task: Task) => void;
}

function AgendaItem({ task, onToggleComplete }: AgendaItemProps) {
  const isCompleted = task.status === "completed";
  const time = task.due_date ? formatAgendaTime(task.due_date) : null;

  return (
    <li className="flex items-start gap-3 rounded-lg border border-slate-800/80 bg-slate-950/40 px-3 py-2 transition-colors hover:border-slate-700">
      <input
        type="checkbox"
        checked={isCompleted}
        onChange={() => onToggleComplete(task)}
        className="mt-1.5 h-4 w-4 shrink-0 rounded border-slate-600 bg-slate-900 text-sky-500"
        aria-label={isCompleted ? "Mark as pending" : "Mark as completed"}
      />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-2">
          {time && (
            <span className="text-xs text-slate-500">
              Due {time}
            </span>
          )}
          {task.course_or_category && (
            <span className="text-xs text-slate-500">
              {task.course_or_category}
            </span>
          )}
        </div>
        <h3
          className={`mt-0.5 font-medium ${
            isCompleted
              ? "text-slate-500 line-through"
              : "text-slate-100"
          }`}
        >
          {task.title}
        </h3>
      </div>
    </li>
  );
}

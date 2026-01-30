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
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { triggerCanvasSync, triggerNotionSync, type NotionSyncResult } from "@/lib/api";
import { Calendar, Loader2, CheckCircle2, AlertCircle } from "lucide-react";

export function AgendaView() {
  const [syncing, setSyncing] = useState(false);
  const [notionSyncing, setNotionSyncing] = useState(false);
  const [notionResult, setNotionResult] = useState<NotionSyncResult | null>(null);
  const [notionError, setNotionError] = useState<string | null>(null);
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

  const handleNotionPush = async () => {
    if (!selectedCourseIds.length) return;
    setNotionSyncing(true);
    setNotionError(null);
    setNotionResult(null);
    try {
      const res = await triggerNotionSync(selectedCourseIds);
      setNotionResult(res);
    } catch (err) {
      setNotionError(
        err instanceof Error ? err.message : "Failed to push tasks to Notion.",
      );
    } finally {
      setNotionSyncing(false);
    }
  };

  const byDay = groupTasksByDay(tasks);
  const sortedDays = Array.from(byDay.keys()).sort();
  const dateRange =
    sortedDays.length > 0
      ? `${formatDayHeader(sortedDays[0]!)} – ${formatDayHeader(sortedDays[sortedDays.length - 1]!)}`
      : "–";

  return (
    <div className="space-y-6 md:space-y-8">
      <div>
        <h1 className="text-page-title text-primary">
          Agenda
        </h1>
        <p className="mt-1 text-caption text-muted">
          Select courses and a start date. Tasks from that date onwards are
          shown, grouped by day. Completed tasks show with a strikethrough.
        </p>
      </div>

      {/* Setup: Courses and date range */}
      <Card>
        <CardHeader>
          <h2 className="text-section-title text-primary">
            Setup
          </h2>
          <p className="mt-0.5 text-caption text-muted">
            Choose courses and date range, then sync or push to Notion.
          </p>
        </CardHeader>
        <CardBody className="space-y-6">
          <section>
            <h3 className="text-label text-secondary mb-3">Courses to show</h3>
            {coursesLoading && (
              <div className="flex items-center gap-2 text-body text-muted">
                <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden="true" />
                Loading courses…
              </div>
            )}
            {coursesError && (
              <div className="flex items-center gap-2 rounded-lg border border-error/40 bg-error/10 px-3 py-2 text-body font-medium text-error">
                <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
                {coursesError}
              </div>
            )}
            {!coursesLoading && !coursesError && courses.length === 0 && (
              <p className="text-body text-muted">
                No Canvas courses. Configure Canvas in Settings and sync, or
                sync below after selecting.
              </p>
            )}
            <div className="flex flex-wrap gap-3 mt-2">
              {courses.map((c) => {
                const checked = selectedCourseIds.includes(c.id);
                return (
                  <label
                    key={c.id}
                    className={`flex cursor-pointer items-center gap-3 rounded-lg border px-4 py-3 text-body transition-colors ${
                      checked
                        ? "border-accent bg-accent-muted text-accent"
                        : "border-border bg-elevated text-secondary hover:border-border hover:bg-surface"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleCourse(c.id)}
                      className="h-4 w-4 shrink-0 rounded border-border bg-base text-accent focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-base"
                    />
                    <span>{c.name ?? `Course ${c.id}`}</span>
                  </label>
                );
              })}
            </div>
          </section>

          <section>
            <h3 className="text-label text-secondary mb-3">Date range</h3>
            <div className="flex flex-wrap items-center gap-4">
              <label className="flex flex-col gap-1.5">
                <span className="text-label text-secondary">From date</span>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="h-10 min-w-40 rounded-lg border border-border bg-base px-3 text-body text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-base"
                  aria-label="Show tasks from this date onwards"
                />
              </label>
              <div className="flex items-end">
                <Button variant="secondary" onClick={handleTodayClick}>
                  Today
                </Button>
              </div>
              <span className="text-caption text-muted self-center">{dateRange}</span>
            </div>
          </section>

          {!coursesLoading && courses.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-border-subtle">
              <Button
                variant="secondary"
                onClick={handleSync}
                disabled={!selectedCourseIds.length || syncing || isLoading}
                loading={syncing}
              >
                {syncing ? "Syncing…" : "Sync selected"}
              </Button>
              <Button
                variant="secondary"
                onClick={handleNotionPush}
                disabled={!selectedCourseIds.length || notionSyncing}
                loading={notionSyncing}
              >
                {notionSyncing ? "Pushing…" : "Push selected to Notion"}
              </Button>
              <Button variant="secondary" onClick={refetch}>
                Refresh
              </Button>
            </div>
          )}

          {notionError && (
            <div className="flex items-center gap-2 rounded-lg border border-error/40 bg-error/10 px-3 py-2 text-body font-medium text-error">
              <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
              {notionError}
            </div>
          )}
          {notionResult && !notionError && (
            <div className="flex items-center gap-2 rounded-lg border border-success/40 bg-success/10 px-3 py-2 text-body text-success">
              <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span>
                Pushed {notionResult.total} tasks to Notion ({notionResult.created}{" "}
                created, {notionResult.updated} updated, {notionResult.failed}{" "}
                failed).
              </span>
            </div>
          )}
        </CardBody>
      </Card>

      {!selectedCourseIds.length && (
        <div className="flex flex-col items-center justify-center rounded-xl border border-border bg-surface px-6 py-12 text-center">
          <Calendar className="h-12 w-12 text-muted" aria-hidden="true" />
          <p className="mt-4 text-body font-medium text-primary">
            Select courses to view agenda
          </p>
          <p className="mt-1 text-caption text-muted max-w-sm">
            Choose at least one course above to see tasks grouped by day.
          </p>
        </div>
      )}

      {selectedCourseIds.length > 0 && error && (
        <div className="flex items-center gap-2 rounded-xl border border-error/40 bg-error/10 px-4 py-3 text-body font-medium text-error">
          <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
          {error}
        </div>
      )}

      {selectedCourseIds.length > 0 && isLoading && (
        <div className="flex items-center gap-3 rounded-xl border border-border bg-surface px-4 py-6 text-secondary">
          <Loader2 className="h-5 w-5 shrink-0 animate-spin" aria-hidden="true" />
          <p className="text-body">Loading tasks…</p>
        </div>
      )}

      {selectedCourseIds.length > 0 &&
        !isLoading &&
        !error &&
        sortedDays.length === 0 && (
          <p className="text-body text-muted">
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
              className="rounded-xl border border-border bg-surface p-4 md:p-5"
            >
              <h2 className="text-section-title text-primary mb-4">
                {formatDayHeader(dayKey)}
              </h2>
              <ul className="space-y-3">
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
    <li className="flex items-start gap-3 rounded-lg border border-border bg-elevated px-4 py-3 transition-colors hover:border-border">
      <input
        type="checkbox"
        checked={isCompleted}
        onChange={() => onToggleComplete(task)}
        className="mt-0.5 h-4 w-4 shrink-0 rounded border-border bg-base text-accent focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-base"
        aria-label={isCompleted ? "Mark as pending" : "Mark as completed"}
      />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-2">
          {time && (
            <span className="text-caption text-muted">Due {time}</span>
          )}
          {task.course_or_category && (
            <span className="text-caption text-muted">
              {task.course_or_category}
            </span>
          )}
        </div>
        <h3
          className={`mt-0.5 text-card-title ${
            isCompleted ? "text-muted line-through" : "text-primary"
          }`}
        >
          {task.title}
        </h3>
      </div>
    </li>
  );
}

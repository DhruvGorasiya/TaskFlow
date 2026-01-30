"use client";

import { useState } from "react";
import { useTasks, type TaskFiltersState } from "@/hooks/useTasks";
import { TaskList } from "@/components/tasks/TaskList";
import { TaskFilters } from "@/components/tasks/TaskFilters";
import { Card, CardBody } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import type { Task } from "@/types";
import { groupTasksByDueBucket } from "@/lib/utils";
import { ClipboardList, Loader2 } from "lucide-react";

export function TasksDashboard() {
  const [filters, setFilters] = useState<TaskFiltersState>({
    source: "all",
    status: "pending",
    courseOrCategory: "all",
  });

  const { tasks, isLoading, error, refetch, updateTaskLocal } = useTasks(
    filters,
  );

  const grouped = groupTasksByDueBucket(tasks);

  const handleFiltersChange = (next: TaskFiltersState) => {
    setFilters(next);
  };

  const handleToggleComplete = (task: Task) => {
    const nextStatus = task.status === "completed" ? "pending" : "completed";
    updateTaskLocal(task.id, { status: nextStatus });
  };

  return (
    <div className="space-y-6 md:space-y-8">
      <div>
        <h1 className="text-page-title text-primary">
          Tasks
        </h1>
        <p className="mt-1 text-caption text-muted">
          Unified view of tasks from Canvas and other sources.
        </p>
      </div>

      <Card>
        <CardBody>
          <TaskFilters
            filters={filters}
            tasks={tasks}
            isLoading={isLoading}
            onChange={handleFiltersChange}
            onRefresh={refetch}
          />
        </CardBody>
      </Card>

      {isLoading && (
        <div className="flex items-center gap-3 rounded-xl border border-border bg-surface px-4 py-6 text-secondary">
          <Loader2 className="h-5 w-5 shrink-0 animate-spin" aria-hidden="true" />
          <p className="text-body">Loading tasks…</p>
        </div>
      )}

      {error && !isLoading && (
        <div className="flex flex-col gap-3 rounded-xl border border-error/40 bg-error/10 px-4 py-4 md:flex-row md:items-center md:justify-between">
          <p className="text-body font-medium text-error">
            {error || "Failed to load tasks."}
          </p>
          <Button variant="secondary" onClick={() => refetch()}>
            Retry
          </Button>
        </div>
      )}

      {!isLoading && !error && tasks.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-xl border border-border bg-surface px-6 py-12 text-center">
          <ClipboardList className="h-12 w-12 text-muted" aria-hidden="true" />
          <p className="mt-4 text-body font-medium text-primary">
            No tasks found
          </p>
          <p className="mt-1 text-caption text-muted max-w-sm">
            Try adjusting your filters or syncing from Canvas in Settings.
          </p>
          <Button variant="secondary" className="mt-4" onClick={() => refetch()}>
            Refresh
          </Button>
        </div>
      )}

      {!isLoading && tasks.length > 0 && (
        <div>
          <h2 className="sr-only">Task buckets</h2>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <TaskList
              title="Today"
              tasks={grouped.today}
              onToggleComplete={handleToggleComplete}
            />
            <TaskList
              title="This Week"
              tasks={grouped.thisWeek}
              onToggleComplete={handleToggleComplete}
            />
            <TaskList
              title="Later"
              tasks={grouped.later}
              onToggleComplete={handleToggleComplete}
            />
            <TaskList
              title="No Due Date"
              tasks={grouped.noDueDate}
              onToggleComplete={handleToggleComplete}
            />
          </div>
        </div>
      )}
    </div>
  );
}

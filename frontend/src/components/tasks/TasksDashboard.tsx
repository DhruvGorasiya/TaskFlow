"use client";

import { useState } from "react";
import { useTasks, type TaskFiltersState } from "@/hooks/useTasks";
import { TaskList } from "@/components/tasks/TaskList";
import { TaskFilters } from "@/components/tasks/TaskFilters";
import { Card } from "@/components/ui/Card";
import type { Task } from "@/types";
import { groupTasksByDueBucket } from "@/lib/utils";

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
    <div className="space-y-4 md:space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-slate-50 md:text-2xl">
            Tasks
          </h1>
          <p className="mt-1 text-xs text-slate-400 md:text-sm">
            Unified view of tasks from Canvas and other sources.
          </p>
        </div>
      </div>

      <Card className="p-3 md:p-4">
        <TaskFilters
          filters={filters}
          tasks={tasks}
          isLoading={isLoading}
          onChange={handleFiltersChange}
          onRefresh={refetch}
        />
      </Card>

      {isLoading && (
        <p className="text-sm text-slate-400">Loading tasks…</p>
      )}

      {error && !isLoading && (
        <p className="text-sm font-medium text-red-400">
          {error || "Failed to load tasks."}
        </p>
      )}

      {!isLoading && !error && tasks.length === 0 && (
        <p className="text-sm text-slate-400">
          No tasks found. Try adjusting your filters or syncing from Canvas in
          Settings.
        </p>
      )}

      {!isLoading && tasks.length > 0 && (
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
      )}
    </div>
  );
}


"use client";

import type { Task } from "@/types";
import { Badge } from "@/components/ui/Badge";
import { DueDateBadge } from "@/components/tasks/DueDateBadge";

interface TaskCardProps {
  task: Task;
  onToggleComplete: (task: Task) => void;
}

function sourceVariant(source: Task["source"]) {
  switch (source) {
    case "canvas":
      return "canvas" as const;
    case "gmail":
      return "gmail" as const;
    case "calendar":
      return "calendar" as const;
    default:
      return "default" as const;
  }
}

function priorityBorder(priority: Task["priority"]) {
  switch (priority) {
    case "high":
      return "border-l-2 border-l-error";
    case "medium":
      return "border-l-2 border-l-warning";
    case "low":
      return "border-l-2 border-l-success";
    case "none":
    default:
      return "border-l border-l-border-subtle";
  }
}

export function TaskCard({ task, onToggleComplete }: TaskCardProps) {
  const isCompleted = task.status === "completed";

  return (
    <article
      className={`group flex flex-col rounded-lg border border-border bg-elevated px-4 py-3 shadow-sm transition-colors hover:border-border ${priorityBorder(
        task.priority,
      )}`}
    >
      <header className="mb-2 flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-1 items-start gap-3">
          <input
            type="checkbox"
            className="mt-0.5 h-4 w-4 shrink-0 rounded border-border bg-surface text-accent focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-base"
            checked={isCompleted}
            onChange={() => onToggleComplete(task)}
            aria-label={isCompleted ? "Mark as pending" : "Mark as completed"}
          />
          <div className="min-w-0 space-y-0.5">
            <h3
              className={`line-clamp-2 text-card-title ${
                isCompleted
                  ? "text-muted line-through"
                  : "text-primary group-hover:text-primary"
              }`}
            >
              {task.title}
            </h3>
            {task.course_or_category && (
              <p className="text-caption text-muted">
                {task.course_or_category}
              </p>
            )}
          </div>
        </div>
        <Badge variant={sourceVariant(task.source)} className="shrink-0">
          {task.source.charAt(0).toUpperCase() + task.source.slice(1)}
        </Badge>
      </header>

      <div className="flex flex-wrap items-center gap-2">
        <DueDateBadge dueDate={task.due_date} />
        {task.priority !== "none" && (
          <span className="inline-flex items-center rounded-full border border-border-subtle bg-surface px-2.5 py-1 text-label font-medium uppercase tracking-wide text-muted">
            {task.priority === "high"
              ? "High priority"
              : task.priority === "medium"
              ? "Medium priority"
              : "Low priority"}
          </span>
        )}
      </div>
    </article>
  );
}

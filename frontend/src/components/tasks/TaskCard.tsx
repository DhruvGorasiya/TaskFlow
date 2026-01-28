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
      return "border-l-2 border-l-red-500";
    case "medium":
      return "border-l-2 border-l-amber-400";
    case "low":
      return "border-l border-l-emerald-400/70";
    case "none":
    default:
      return "border-l border-l-slate-700";
  }
}

export function TaskCard({ task, onToggleComplete }: TaskCardProps) {
  const isCompleted = task.status === "completed";

  return (
    <article
      className={`group flex flex-col rounded-lg border border-slate-800 bg-slate-900/70 px-3 py-2.5 text-sm shadow-sm transition-colors hover:border-slate-600 ${priorityBorder(
        task.priority,
      )}`}
    >
      <header className="mb-1 flex items-start justify-between gap-3">
        <div className="flex flex-1 items-start gap-2">
          <input
            type="checkbox"
            className="mt-1 h-4 w-4 rounded border-slate-600 bg-slate-900 text-sky-500"
            checked={isCompleted}
            onChange={() => onToggleComplete(task)}
            aria-label={isCompleted ? "Mark as pending" : "Mark as completed"}
          />
          <div className="space-y-0.5">
            <h3
              className={`line-clamp-2 font-medium ${
                isCompleted
                  ? "text-slate-400 line-through"
                  : "text-slate-50 group-hover:text-slate-100"
              }`}
            >
              {task.title}
            </h3>
            {task.course_or_category && (
              <p className="text-xs text-slate-400">
                {task.course_or_category}
              </p>
            )}
          </div>
        </div>
        <Badge variant={sourceVariant(task.source)} className="shrink-0">
          {task.source.charAt(0).toUpperCase() + task.source.slice(1)}
        </Badge>
      </header>

      <div className="mt-1 flex flex-wrap items-center gap-1.5">
        <DueDateBadge dueDate={task.due_date} />
        {task.priority !== "none" && (
          <span className="inline-flex items-center rounded-full border border-slate-700 bg-slate-900 px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide text-slate-300">
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


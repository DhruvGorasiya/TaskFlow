"use client";

import { format } from "@/lib/utils";

interface DueDateBadgeProps {
  dueDate: string | null;
}

export function DueDateBadge({ dueDate }: DueDateBadgeProps) {
  if (!dueDate) {
    return (
      <span className="inline-flex items-center rounded-full border border-border-subtle bg-elevated px-2.5 py-1 text-label font-medium text-muted">
        No due date
      </span>
    );
  }

  const { absolute, relative, isOverdue, isSoon } = format.relativeDueDate(
    dueDate,
  );

  const base =
    "inline-flex items-center rounded-full border px-2.5 py-1 text-label font-medium";
  const color = isOverdue
    ? "bg-error/10 text-error border-error/40"
    : isSoon
    ? "bg-warning/10 text-warning border-warning/40"
    : "bg-elevated text-secondary border-border-subtle";

  return (
    <span className={`${base} ${color}`} title={absolute}>
      {relative}
    </span>
  );
}

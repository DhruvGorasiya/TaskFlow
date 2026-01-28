"use client";

import { format } from "@/lib/utils";

interface DueDateBadgeProps {
  dueDate: string | null;
}

export function DueDateBadge({ dueDate }: DueDateBadgeProps) {
  if (!dueDate) {
    return (
      <span className="inline-flex items-center rounded-full bg-slate-900 px-2 py-0.5 text-[11px] font-medium text-slate-300">
        No due date
      </span>
    );
  }

  const { absolute, relative, isOverdue, isSoon } = format.relativeDueDate(
    dueDate,
  );

  const base =
    "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium";
  const color = isOverdue
    ? "bg-red-500/10 text-red-300 border border-red-500/60"
    : isSoon
    ? "bg-amber-500/10 text-amber-200 border border-amber-400/60"
    : "bg-slate-900 text-slate-200 border border-slate-700";

  return (
    <span className={`${base} ${color}`} title={absolute}>
      {relative}
    </span>
  );
}


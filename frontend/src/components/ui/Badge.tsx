"use client";

import type { HTMLAttributes, ReactNode } from "react";

type BadgeVariant = "default" | "canvas" | "gmail" | "calendar" | "muted";

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
  children: ReactNode;
}

const variantClasses: Record<BadgeVariant, string> = {
  default:
    "bg-slate-800/90 text-slate-100 border border-slate-700 shadow-sm shadow-slate-900/40",
  canvas:
    "bg-sky-500/10 text-sky-300 border border-sky-500/60 shadow-sm shadow-sky-950/40",
  gmail:
    "bg-red-500/10 text-red-300 border border-red-500/60 shadow-sm shadow-red-950/40",
  calendar:
    "bg-emerald-500/10 text-emerald-300 border border-emerald-500/60 shadow-sm shadow-emerald-950/40",
  muted: "bg-slate-800/80 text-slate-300 border border-slate-700",
};

export function Badge({ variant = "default", className, children, ...rest }: BadgeProps) {
  const classes = `inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${variantClasses[variant]} ${
    className ?? ""
  }`;
  return (
    <span className={classes} {...rest}>
      {children}
    </span>
  );
}


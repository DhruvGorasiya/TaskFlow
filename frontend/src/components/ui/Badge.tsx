"use client";

import type { HTMLAttributes, ReactNode } from "react";

type BadgeVariant = "default" | "canvas" | "gmail" | "calendar" | "muted";

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
  children: ReactNode;
}

const variantClasses: Record<BadgeVariant, string> = {
  default:
    "bg-elevated text-secondary border border-border",
  canvas:
    "bg-accent-muted text-accent border border-accent/30",
  gmail:
    "bg-error/10 text-error border border-error/30",
  calendar:
    "bg-success/10 text-success border border-success/30",
  muted: "bg-elevated text-muted border border-border-subtle",
};

export function Badge({ variant = "default", className, children, ...rest }: BadgeProps) {
  const classes = `inline-flex items-center rounded-full px-2.5 py-1 text-label font-medium ${variantClasses[variant]} ${
    className ?? ""
  }`;
  return (
    <span className={classes} {...rest}>
      {children}
    </span>
  );
}

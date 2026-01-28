"use client";

import type { HTMLAttributes, ReactNode } from "react";

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
}

export function Card({ className, children, ...props }: CardProps) {
  const classes = `rounded-xl border border-slate-800 bg-slate-900/60 shadow-sm ${className ?? ""}`;
  return (
    <div className={classes} {...props}>
      {children}
    </div>
  );
}


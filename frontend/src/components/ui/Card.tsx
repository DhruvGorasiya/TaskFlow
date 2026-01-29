"use client";

import type { HTMLAttributes, ReactNode } from "react";

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
}

export function Card({ className, children, ...props }: CardProps) {
  const classes = `rounded-xl border border-border bg-surface shadow-sm ${className ?? ""}`;
  return (
    <div className={classes} {...props}>
      {children}
    </div>
  );
}

interface CardHeaderProps {
  children: ReactNode;
  className?: string;
}

export function CardHeader({ children, className }: CardHeaderProps) {
  return (
    <div className={`border-b border-border-subtle px-4 py-3 md:px-5 md:py-4 ${className ?? ""}`}>
      {children}
    </div>
  );
}

interface CardBodyProps {
  children: ReactNode;
  className?: string;
}

export function CardBody({ children, className }: CardBodyProps) {
  return (
    <div className={`px-4 py-3 md:px-5 md:py-4 ${className ?? ""}`}>
      {children}
    </div>
  );
}

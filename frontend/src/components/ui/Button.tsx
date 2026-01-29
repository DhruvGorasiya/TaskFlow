"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";
import { Loader2 } from "lucide-react";

type Variant = "primary" | "secondary" | "ghost" | "danger";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  loading?: boolean;
  children: ReactNode;
}

const baseClasses =
  "inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-body font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-base disabled:cursor-not-allowed disabled:opacity-60";

const variantClasses: Record<Variant, string> = {
  primary:
    "bg-accent text-inverse hover:bg-accent-hover border border-accent/80 shadow-sm",
  secondary:
    "bg-surface text-primary hover:bg-elevated border border-border",
  ghost:
    "bg-transparent text-secondary hover:bg-elevated border border-transparent",
  danger:
    "bg-error text-inverse hover:opacity-90 border border-error/80 shadow-sm",
};

export function Button({
  variant = "primary",
  loading = false,
  className,
  children,
  disabled,
  ...props
}: ButtonProps) {
  const isDisabled = disabled || loading;
  return (
    <button
      className={`${baseClasses} ${variantClasses[variant]} ${className ?? ""}`}
      disabled={isDisabled}
      {...props}
    >
      {loading ? (
        <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden="true" />
      ) : null}
      {children}
    </button>
  );
}

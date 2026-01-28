"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  children: ReactNode;
}

const baseClasses =
  "inline-flex items-center justify-center rounded-lg px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 disabled:cursor-not-allowed disabled:opacity-60";

const variantClasses: Record<Variant, string> = {
  primary:
    "bg-sky-500 text-slate-950 hover:bg-sky-400 shadow-sm border border-sky-400/80",
  secondary:
    "bg-slate-900 text-slate-50 hover:bg-slate-800 border border-slate-700",
  ghost:
    "bg-transparent text-slate-300 hover:bg-slate-900 border border-transparent",
  danger:
    "bg-red-500 text-slate-950 hover:bg-red-400 border border-red-400/80 shadow-sm",
};

export function Button({
  variant = "primary",
  className,
  children,
  ...props
}: ButtonProps) {
  const classes = `${baseClasses} ${variantClasses[variant]} ${
    className ?? ""
  }`;
  return (
    <button className={classes} {...props}>
      {children}
    </button>
  );
}


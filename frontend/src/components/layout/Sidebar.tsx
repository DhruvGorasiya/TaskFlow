"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { CalendarDays, LayoutList, Settings, Workflow, X } from "lucide-react";

const navItems = [
  { href: "/tasks", label: "Dashboard", icon: LayoutList },
  { href: "/agenda", label: "Agenda", icon: CalendarDays },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);

  const toggle = () => setIsOpen((prev) => !prev);

  const activeClass =
    "bg-accent-muted text-accent border border-accent/30";
  const inactiveClass =
    "text-secondary hover:bg-elevated hover:text-primary border border-transparent";

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden w-64 shrink-0 border-r border-border bg-surface px-4 py-6 md:flex md:flex-col">
        <div className="flex items-center gap-3 px-2 pb-8">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent-muted border border-accent/20">
            <Workflow className="h-5 w-5 text-accent" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <p className="text-section-title text-primary truncate">
              TaskFlow
            </p>
            <p className="text-caption text-muted">Unified tasks</p>
          </div>
        </div>
        <nav className="space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive =
              pathname === item.href ||
              (item.href === "/tasks" && pathname === "/") ||
              (item.href === "/agenda" && pathname?.startsWith("/agenda"));
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 rounded-lg border px-3 py-2.5 text-body font-medium transition-colors ${
                  isActive ? activeClass : inactiveClass
                }`}
              >
                <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </aside>

      {/* Mobile top bar with slide-down nav */}
      <div className="fixed inset-x-0 top-0 z-40 border-b border-border bg-surface/95 px-4 py-3 shadow-sm backdrop-blur-sm md:hidden">
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={toggle}
            className="inline-flex h-9 w-9 flex-col items-center justify-center gap-1.5 rounded-lg border border-border bg-elevated text-primary transition-colors hover:bg-border-subtle"
            aria-expanded={isOpen}
            aria-label={isOpen ? "Close navigation" : "Open navigation"}
          >
            {isOpen ? (
              <X className="h-5 w-5" aria-hidden="true" />
            ) : (
              <>
                <span className="sr-only">Menu</span>
                <span className="block h-0.5 w-4 rounded-full bg-current" />
                <span className="block h-0.5 w-4 rounded-full bg-current" />
                <span className="block h-0.5 w-4 rounded-full bg-current" />
              </>
            )}
          </button>
          <div className="flex items-center gap-2">
            <Workflow className="h-5 w-5 text-accent" aria-hidden="true" />
            <span className="text-section-title text-primary">TaskFlow</span>
          </div>
          <div className="w-9" aria-hidden="true" />
        </div>
        {isOpen && (
          <nav className="mt-4 space-y-1 pb-2">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive =
                pathname === item.href ||
                (item.href === "/tasks" && pathname === "/") ||
                (item.href === "/agenda" && pathname?.startsWith("/agenda"));
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-3 rounded-lg border px-3 py-2.5 text-body font-medium transition-colors ${
                    isActive ? activeClass : inactiveClass
                  }`}
                  onClick={() => setIsOpen(false)}
                >
                  <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>
        )}
      </div>
    </>
  );
}

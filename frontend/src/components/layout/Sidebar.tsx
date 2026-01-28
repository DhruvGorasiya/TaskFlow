"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { CalendarDays, LayoutList, Settings, Workflow } from "lucide-react";

const navItems = [
  { href: "/tasks", label: "Dashboard", icon: LayoutList },
  { href: "/agenda", label: "Agenda", icon: CalendarDays },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);

  const toggle = () => setIsOpen((prev) => !prev);

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden w-64 shrink-0 border-r border-slate-800 bg-slate-950/80 px-4 py-4 md:flex md:flex-col">
        <div className="flex items-center gap-2 px-1 pb-6">
          <Workflow className="h-6 w-6 text-sky-400" aria-hidden="true" />
          <div>
            <p className="text-sm font-semibold tracking-tight text-slate-50">
              TaskFlow
            </p>
            <p className="text-xs text-slate-400">Unified tasks</p>
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
                className={`flex items-center gap-2 rounded-lg px-2 py-2 text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-slate-800 text-slate-50"
                    : "text-slate-300 hover:bg-slate-900 hover:text-slate-50"
                }`}
              >
                <Icon className="h-4 w-4" aria-hidden="true" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </aside>

      {/* Mobile top bar with slide-down nav */}
      <div className="fixed inset-x-0 top-0 z-40 border-b border-slate-800 bg-slate-950/95 px-4 py-3 shadow-sm md:hidden">
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={toggle}
            className="inline-flex items-center rounded-lg border border-slate-800 bg-slate-900 px-2 py-1 text-xs font-medium text-slate-100 shadow-sm hover:bg-slate-800"
            aria-expanded={isOpen}
            aria-label="Toggle navigation"
          >
            <span className="mr-1.5 h-0.5 w-4 rounded bg-slate-100" />
            <span className="mr-1.5 h-0.5 w-4 rounded bg-slate-100" />
            <span className="h-0.5 w-4 rounded bg-slate-100" />
          </button>
          <div className="flex items-center gap-2">
            <Workflow className="h-5 w-5 text-sky-400" aria-hidden="true" />
            <span className="text-sm font-semibold text-slate-50">
              TaskFlow
            </span>
          </div>
        </div>
        {isOpen && (
          <nav className="mt-3 space-y-1">
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
                  className={`flex items-center gap-2 rounded-lg px-2 py-2 text-sm font-medium transition-colors ${
                    isActive
                      ? "bg-slate-800 text-slate-50"
                      : "text-slate-300 hover:bg-slate-900 hover:text-slate-50"
                  }`}
                  onClick={() => setIsOpen(false)}
                >
                  <Icon className="h-4 w-4" aria-hidden="true" />
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


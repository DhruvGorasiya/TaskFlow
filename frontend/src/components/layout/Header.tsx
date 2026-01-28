"use client";

import { usePathname } from "next/navigation";

function getTitle(pathname: string): string {
  if (pathname.startsWith("/settings")) return "Settings";
  if (pathname.startsWith("/tasks")) return "Dashboard";
  return "TaskFlow";
}

export function Header() {
  const pathname = usePathname();
  const title = getTitle(pathname);

  return (
    <header className="sticky top-0 z-30 hidden border-b border-slate-800 bg-slate-950/80 px-6 py-4 backdrop-blur md:block">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-lg font-semibold tracking-tight text-slate-50">
            {title}
          </h1>
          <p className="mt-0.5 text-xs text-slate-400">
            View and manage your unified task list.
          </p>
        </div>
      </div>
    </header>
  );
}


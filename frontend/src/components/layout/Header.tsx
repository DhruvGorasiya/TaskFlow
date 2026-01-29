"use client";

import { usePathname } from "next/navigation";

function getTitle(pathname: string): string {
  if (pathname.startsWith("/settings")) return "Settings";
  if (pathname.startsWith("/agenda")) return "Agenda";
  if (pathname.startsWith("/tasks")) return "Dashboard";
  return "TaskFlow";
}

export function Header() {
  const pathname = usePathname();
  const title = getTitle(pathname);

  return (
    <header className="sticky top-0 z-30 border-b border-border bg-surface/90 px-4 py-4 backdrop-blur-sm md:px-6 md:py-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-page-title text-primary">
            {title}
          </h1>
          <p className="mt-1 text-caption text-muted">
            View and manage your unified task list.
          </p>
        </div>
      </div>
    </header>
  );
}

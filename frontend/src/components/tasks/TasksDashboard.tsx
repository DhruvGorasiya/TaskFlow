"use client";

import { useState, useEffect, useMemo } from "react";
import { useTasks } from "@/hooks/useTasks";
import { TaskList } from "@/components/tasks/TaskList";
import { Card, CardBody } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import type { Task } from "@/types";
import { groupTasksByDueBucket } from "@/lib/utils";
import { ClipboardList, Loader2 } from "lucide-react";
import { loadSelectedCourseIds } from "@/lib/courseSelection";

// Stable filters object - never changes
const DEFAULT_FILTERS = { source: "all" as const, status: "all" as const, courseOrCategory: "all" as const };

export function TasksDashboard() {
  const [selectedCourseIds, setSelectedCourseIds] = useState<number[]>([]);

  useEffect(() => {
    const stored = loadSelectedCourseIds();
    setSelectedCourseIds(stored);
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/7cba70ce-b46b-404a-8c4b-820a762188e6',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'frontend/src/components/tasks/TasksDashboard.tsx:useEffect:init',message:'Dashboard mounted; loaded selected course IDs',data:{storedCount:stored.length,storedIds:stored.slice().sort((a,b)=>a-b)},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'H1'})}).catch(()=>{});
    fetch('/api/__debug',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'frontend/src/components/tasks/TasksDashboard.tsx:useEffect:init',message:'Dashboard mounted; loaded selected course IDs (relay)',data:{storedCount:stored.length,storedIds:stored.slice().sort((a,b)=>a-b)},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'H1'})}).catch(()=>{});
    // #endregion
    
    // Listen for storage changes (when Settings updates course selection)
    const handleStorageChange = () => {
      const updated = loadSelectedCourseIds();
      setSelectedCourseIds(updated);
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/7cba70ce-b46b-404a-8c4b-820a762188e6',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'frontend/src/components/tasks/TasksDashboard.tsx:handleStorageChange',message:'Dashboard observed course selection change',data:{updatedCount:updated.length,updatedIds:updated.slice().sort((a,b)=>a-b)},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'H4'})}).catch(()=>{});
      fetch('/api/__debug',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'frontend/src/components/tasks/TasksDashboard.tsx:handleStorageChange',message:'Dashboard observed course selection change (relay)',data:{updatedCount:updated.length,updatedIds:updated.slice().sort((a,b)=>a-b)},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'H4'})}).catch(()=>{});
      // #endregion
    };
    window.addEventListener("storage", handleStorageChange);
    
    // Also listen for custom event for same-tab updates
    window.addEventListener("courseSelectionChanged", handleStorageChange);
    
    return () => {
      window.removeEventListener("storage", handleStorageChange);
      window.removeEventListener("courseSelectionChanged", handleStorageChange);
    };
  }, []);

  // Convert courseIds - pass null when empty, sorted array when courses selected
  // Memoize based on sorted string to ensure stability
  const courseIds = useMemo(() => {
    if (selectedCourseIds.length === 0) return null;
    // Return sorted copy for stable reference
    return [...selectedCourseIds].sort((a, b) => a - b);
  }, [selectedCourseIds.length > 0 ? [...selectedCourseIds].sort((a, b) => a - b).join(",") : ""]);

  // Use stable filters - only filter by course IDs from Settings
  const { tasks, isLoading, error, refetch, updateTaskLocal } = useTasks(
    DEFAULT_FILTERS,
    courseIds,
  );

  const grouped = groupTasksByDueBucket(tasks);

  const handleToggleComplete = (task: Task) => {
    const nextStatus = task.status === "completed" ? "pending" : "completed";
    updateTaskLocal(task.id, { status: nextStatus });
  };

  return (
    <div className="space-y-6 md:space-y-8">
      <div>
        <h1 className="text-page-title text-primary">
          Tasks
        </h1>
        <p className="mt-1 text-caption text-muted">
          Unified view of tasks from Canvas and other sources. Course selection is managed in Settings.
        </p>
      </div>

      {isLoading && (
        <div className="flex items-center gap-3 rounded-xl border border-border bg-surface px-4 py-6 text-secondary">
          <Loader2 className="h-5 w-5 shrink-0 animate-spin" aria-hidden="true" />
          <p className="text-body">Loading tasks…</p>
        </div>
      )}

      {error && !isLoading && (
        <div className="flex flex-col gap-3 rounded-xl border border-error/40 bg-error/10 px-4 py-4 md:flex-row md:items-center md:justify-between">
          <p className="text-body font-medium text-error">
            {error || "Failed to load tasks."}
          </p>
          <Button variant="secondary" onClick={() => refetch()}>
            Retry
          </Button>
        </div>
      )}

      {!isLoading && !error && tasks.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-xl border border-border bg-surface px-6 py-12 text-center">
          <ClipboardList className="h-12 w-12 text-muted" aria-hidden="true" />
          <p className="mt-4 text-body font-medium text-primary">
            No tasks found
          </p>
          <p className="mt-1 text-caption text-muted max-w-sm">
            {selectedCourseIds.length === 0
              ? "Select courses in Settings to view tasks, or sync from Canvas."
              : "Try adjusting your course selection in Settings, or sync from Canvas."}
          </p>
          <div className="mt-4 flex gap-2">
            <Button variant="secondary" onClick={() => refetch()}>
              Refresh
            </Button>
          </div>
        </div>
      )}

      {!isLoading && tasks.length > 0 && (
        <div>
          <h2 className="sr-only">Task buckets</h2>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <TaskList
              title="Today"
              tasks={grouped.today}
              onToggleComplete={handleToggleComplete}
            />
            <TaskList
              title="This Week"
              tasks={grouped.thisWeek}
              onToggleComplete={handleToggleComplete}
            />
            <TaskList
              title="Later"
              tasks={grouped.later}
              onToggleComplete={handleToggleComplete}
            />
            <TaskList
              title="No Due Date"
              tasks={grouped.noDueDate}
              onToggleComplete={handleToggleComplete}
            />
          </div>
        </div>
      )}
    </div>
  );
}

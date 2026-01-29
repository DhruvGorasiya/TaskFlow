"use client";

import { useCallback, useEffect, useState } from "react";
import type { Task, TaskSource, TaskStatus } from "@/types";
import { getTasks, patchTask } from "@/lib/api";

export interface TaskFiltersState {
  source: TaskSource | "all";
  status: TaskStatus | "all";
  courseOrCategory: string | "all";
}

interface UseTasksResult {
  tasks: Task[];
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
  updateTaskLocal: (id: string, changes: Partial<Task>) => void;
}

/**
 * @param filters - Source, status, and course/category filters (ignored when courseIds is provided)
 * @param courseIds - Optional Canvas course IDs. When provided, only tasks from these courses are fetched (all sources, all statuses).
 */
export function useTasks(
  filters: TaskFiltersState,
  courseIds: number[] | null = null,
): UseTasksResult {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchTasks = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const params: Parameters<typeof getTasks>[0] = {};
      
      // When courseIds is provided, filter by course IDs and show all tasks from those courses
      if (courseIds != null && courseIds.length > 0) {
        params.course_ids = courseIds;
        // Don't apply source/status filters when filtering by course IDs
      } else {
        // Only apply filters when not filtering by course IDs
        if (filters.source !== "all") params.source = filters.source;
        if (filters.status !== "all") params.status = filters.status;
      }

      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/7cba70ce-b46b-404a-8c4b-820a762188e6',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'frontend/src/hooks/useTasks.ts:fetchTasks',message:'Fetching tasks',data:{hasCourseFilter:Boolean(courseIds && courseIds.length>0),courseIds:courseIds ?? null,params},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'H2'})}).catch(()=>{});
      fetch('/api/__debug',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'frontend/src/hooks/useTasks.ts:fetchTasks',message:'Fetching tasks (relay)',data:{hasCourseFilter:Boolean(courseIds && courseIds.length>0),courseIds:courseIds ?? null,params},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'H2'})}).catch(()=>{});
      // #endregion
      
      const data = await getTasks(params);

      // Only apply courseOrCategory filter when not filtering by course IDs
      const filtered =
        courseIds != null && courseIds.length > 0
          ? data // Show all tasks when filtering by course IDs
          : filters.courseOrCategory === "all"
          ? data
          : data.filter(
              (t) => t.course_or_category === filters.courseOrCategory,
            );

      setTasks(filtered);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to fetch tasks from API.",
      );
    } finally {
      setIsLoading(false);
    }
  }, [filters.source, filters.status, filters.courseOrCategory, courseIds ? courseIds.join(",") : null]);

  useEffect(() => {
    void fetchTasks();
  }, [fetchTasks]);

  const refetch = useCallback(() => {
    void fetchTasks();
  }, [fetchTasks]);

  const updateTaskLocal = useCallback(
    async (id: string, changes: Partial<Task>) => {
      setTasks((prev) =>
        prev.map((t) => (t.id === id ? { ...t, ...changes } : t)),
      );
      try {
        await patchTask(id, {
          status: changes.status as TaskStatus | undefined,
          priority: changes.priority as Task["priority"] | undefined,
          title: changes.title,
          due_date: changes.due_date ?? undefined,
          course_or_category: changes.course_or_category ?? undefined,
          description: changes.description ?? undefined,
        });
      } catch (err) {
        // Roll back on failure
        setTasks((prev) => prev);
        // eslint-disable-next-line no-console
        console.error("Failed to update task", err);
      }
    },
    [],
  );

  return { tasks, isLoading, error, refetch, updateTaskLocal };
}

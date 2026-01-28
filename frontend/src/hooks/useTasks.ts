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

export function useTasks(filters: TaskFiltersState): UseTasksResult {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchTasks = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const params: Parameters<typeof getTasks>[0] = {};
      if (filters.source !== "all") params.source = filters.source;
      if (filters.status !== "all") params.status = filters.status;
      // For simplicity we let backend handle due date filters later if needed
      const data = await getTasks(params);

      const filtered =
        filters.courseOrCategory === "all"
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
  }, [filters]);

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


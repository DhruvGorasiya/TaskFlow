"use client";

import { useCallback, useEffect, useState } from "react";
import type { Task } from "@/types";
import { getCanvasCourses, getTasks, patchTask } from "@/lib/api";
import type { CanvasCourse } from "@/lib/api";
import type { TaskStatus } from "@/types";

const AGENDA_COURSE_IDS_KEY = "taskflow_agenda_course_ids";

function loadStoredCourseIds(): number[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(AGENDA_COURSE_IDS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? parsed.filter((x) => typeof x === "number") : [];
  } catch {
    return [];
  }
}

function storeCourseIds(ids: number[]) {
  try {
    localStorage.setItem(AGENDA_COURSE_IDS_KEY, JSON.stringify(ids));
  } catch {
    /* ignore */
  }
}

export interface UseAgendaResult {
  courses: CanvasCourse[];
  coursesLoading: boolean;
  coursesError: string | null;
  selectedCourseIds: number[];
  setSelectedCourseIds: (ids: number[]) => void;
  tasks: Task[];
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
  toggleComplete: (task: Task) => void;
}

export function useAgenda(): UseAgendaResult {
  const [courses, setCourses] = useState<CanvasCourse[]>([]);
  const [coursesLoading, setCoursesLoading] = useState(true);
  const [coursesError, setCoursesError] = useState<string | null>(null);
  const [selectedCourseIds, setSelectedCourseIdsState] = useState<number[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const setSelectedCourseIds = useCallback((ids: number[]) => {
    setSelectedCourseIdsState(ids);
    storeCourseIds(ids);
  }, []);

  useEffect(() => {
    const stored = loadStoredCourseIds();
    if (stored.length) setSelectedCourseIdsState(stored);
  }, []);

  const fetchCourses = useCallback(async () => {
    setCoursesLoading(true);
    setCoursesError(null);
    try {
      const data = await getCanvasCourses();
      setCourses(data);
    } catch (err) {
      setCoursesError(err instanceof Error ? err.message : "Failed to load courses.");
      setCourses([]);
    } finally {
      setCoursesLoading(false);
    }
  }, []);

  const fetchTasks = useCallback(async () => {
    if (!selectedCourseIds.length) {
      setTasks([]);
      setError(null);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const data = await getTasks({ course_ids: selectedCourseIds });
      setTasks(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load tasks.");
      setTasks([]);
    } finally {
      setIsLoading(false);
    }
  }, [selectedCourseIds]);

  useEffect(() => {
    void fetchCourses();
  }, [fetchCourses]);

  useEffect(() => {
    void fetchTasks();
  }, [fetchTasks]);

  const refetch = useCallback(() => {
    void fetchCourses();
    void fetchTasks();
  }, [fetchCourses, fetchTasks]);

  const toggleComplete = useCallback(async (task: Task) => {
    const next: TaskStatus = task.status === "completed" ? "pending" : "completed";
    setTasks((prev) =>
      prev.map((t) => (t.id === task.id ? { ...t, status: next } : t)),
    );
    try {
      await patchTask(task.id, { status: next });
    } catch {
      setTasks((prev) =>
        prev.map((t) => (t.id === task.id ? { ...t, status: task.status } : t)),
      );
    }
  }, []);

  return {
    courses,
    coursesLoading,
    coursesError,
    selectedCourseIds,
    setSelectedCourseIds,
    tasks,
    isLoading,
    error,
    refetch,
    toggleComplete,
  };
}

"use client";

import { useCallback, useEffect, useState } from "react";
import type { Task } from "@/types";
import { getCanvasCourses, getTasks, patchTask } from "@/lib/api";
import type { CanvasCourse } from "@/lib/api";
import type { TaskStatus } from "@/types";
import { todayYYYYMMDD, toISOStartOfLocalDay } from "@/lib/utils";
import { loadSelectedCourseIds } from "@/lib/courseSelection";

export interface UseAgendaResult {
  courses: CanvasCourse[];
  coursesLoading: boolean;
  coursesError: string | null;
  selectedCourseIds: number[];
  startDate: string;
  setStartDate: (date: string) => void;
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
  const [selectedCourseIds, setSelectedCourseIds] = useState<number[]>([]);
  const [startDate, setStartDate] = useState<string>(() => todayYYYYMMDD());
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const stored = loadSelectedCourseIds();
    setSelectedCourseIds(stored);
    
    // Listen for storage changes (when Settings updates course selection)
    const handleStorageChange = () => {
      const updated = loadSelectedCourseIds();
      setSelectedCourseIds(updated);
    };
    window.addEventListener("storage", handleStorageChange);
    
    // Also listen for custom event for same-tab updates
    window.addEventListener("courseSelectionChanged", handleStorageChange);
    
    return () => {
      window.removeEventListener("storage", handleStorageChange);
      window.removeEventListener("courseSelectionChanged", handleStorageChange);
    };
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
      const due_from = toISOStartOfLocalDay(startDate);
      const data = await getTasks({
        course_ids: selectedCourseIds,
        due_from,
      });
      setTasks(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load tasks.");
      setTasks([]);
    } finally {
      setIsLoading(false);
    }
  }, [selectedCourseIds, startDate]);

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
    startDate,
    setStartDate,
    tasks,
    isLoading,
    error,
    refetch,
    toggleComplete,
  };
}

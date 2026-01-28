export type TaskSource = "canvas" | "gmail" | "calendar";

export type TaskPriority = "high" | "medium" | "low" | "none";

export type TaskStatus = "pending" | "completed" | "archived";

export interface Task {
  id: string;
  external_id: string;
  source: TaskSource;
  title: string;
  description: string | null;
  due_date: string | null; // ISO datetime
  priority: TaskPriority;
  status: TaskStatus;
  course_or_category: string | null;
  created_at: string;
  updated_at: string;
  synced_at: string;
}


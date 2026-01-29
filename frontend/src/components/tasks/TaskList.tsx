import type { Task } from "@/types";
import { TaskCard } from "@/components/tasks/TaskCard";

interface TaskListProps {
  title: string;
  tasks: Task[];
  onToggleComplete: (task: Task) => void;
}

export function TaskList({ title, tasks, onToggleComplete }: TaskListProps) {
  return (
    <section className="flex flex-col rounded-xl border border-border bg-surface p-4 md:p-5">
      <header className="mb-4 flex items-center justify-between gap-2">
        <h2 className="text-section-title text-primary">
          {title}
        </h2>
        <span className="text-caption text-muted">
          {tasks.length} {tasks.length === 1 ? "task" : "tasks"}
        </span>
      </header>
      {tasks.length === 0 ? (
        <p className="text-caption text-muted">No tasks in this bucket.</p>
      ) : (
        <div className="space-y-3">
          {tasks.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              onToggleComplete={onToggleComplete}
            />
          ))}
        </div>
      )}
    </section>
  );
}

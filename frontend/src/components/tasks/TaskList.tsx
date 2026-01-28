import type { Task } from "@/types";
import { TaskCard } from "@/components/tasks/TaskCard";

interface TaskListProps {
  title: string;
  tasks: Task[];
  onToggleComplete: (task: Task) => void;
}

export function TaskList({ title, tasks, onToggleComplete }: TaskListProps) {
  return (
    <section className="flex flex-col rounded-xl border border-slate-800 bg-slate-950/40 p-3 md:p-4">
      <header className="mb-2 flex items-center justify-between gap-2">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-300">
          {title}
        </h2>
        <span className="text-[10px] font-medium text-slate-500">
          {tasks.length} {tasks.length === 1 ? "task" : "tasks"}
        </span>
      </header>
      {tasks.length === 0 ? (
        <p className="mt-1 text-xs text-slate-500">No tasks in this bucket.</p>
      ) : (
        <div className="space-y-2.5">
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


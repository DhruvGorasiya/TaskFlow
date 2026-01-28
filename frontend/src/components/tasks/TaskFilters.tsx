import type { Task } from "@/types";
import type { TaskFiltersState } from "@/hooks/useTasks";
import { Button } from "@/components/ui/Button";

interface TaskFiltersProps {
  filters: TaskFiltersState;
  tasks: Task[];
  isLoading: boolean;
  onChange: (next: TaskFiltersState) => void;
  onRefresh: () => void;
}

export function TaskFilters({
  filters,
  tasks,
  isLoading,
  onChange,
  onRefresh,
}: TaskFiltersProps) {
  const courses = Array.from(
    new Set(
      tasks
        .map((t) => t.course_or_category)
        .filter((c): c is string => Boolean(c)),
    ),
  ).sort();

  const handleChange =
    (field: keyof TaskFiltersState) =>
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      onChange({
        ...filters,
        [field]: e.target.value as TaskFiltersState[keyof TaskFiltersState],
      });
    };

  return (
    <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
      <div className="flex flex-1 flex-wrap gap-2">
        <FilterSelect
          label="Source"
          value={filters.source}
          onChange={handleChange("source")}
          options={[
            { label: "All sources", value: "all" },
            { label: "Canvas", value: "canvas" },
            { label: "Gmail", value: "gmail" },
            { label: "Calendar", value: "calendar" },
          ]}
        />
        <FilterSelect
          label="Status"
          value={filters.status}
          onChange={handleChange("status")}
          options={[
            { label: "Pending", value: "pending" },
            { label: "Completed", value: "completed" },
            { label: "Archived", value: "archived" },
            { label: "All", value: "all" },
          ]}
        />
        <FilterSelect
          label="Course / Category"
          value={filters.courseOrCategory}
          onChange={handleChange("courseOrCategory")}
          options={[
            { label: "All", value: "all" },
            ...courses.map((c) => ({ label: c, value: c })),
          ]}
        />
      </div>
      <div className="flex items-center gap-2">
        <Button
          variant="secondary"
          type="button"
          onClick={onRefresh}
          disabled={isLoading}
        >
          {isLoading ? "Refreshing…" : "Refresh"}
        </Button>
      </div>
    </div>
  );
}

interface FilterSelectProps {
  label: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  options: { label: string; value: string }[];
}

function FilterSelect({ label, value, onChange, options }: FilterSelectProps) {
  return (
    <label className="flex flex-col gap-1 text-xs text-slate-300">
      <span>{label}</span>
      <select
        className="h-8 min-w-[8rem] rounded-md border border-slate-700 bg-slate-950/80 px-2 text-xs text-slate-100 shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
        value={value}
        onChange={onChange}
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </label>
  );
}


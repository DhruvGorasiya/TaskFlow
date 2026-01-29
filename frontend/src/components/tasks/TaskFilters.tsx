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
    <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
      <div className="flex flex-1 flex-wrap gap-4">
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
      <div className="flex items-center">
        <Button
          variant="secondary"
          type="button"
          onClick={onRefresh}
          disabled={isLoading}
          loading={isLoading}
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
    <label className="flex flex-col gap-1.5">
      <span className="text-label text-secondary">{label}</span>
      <select
        className="h-10 min-w-40 rounded-lg border border-border bg-base px-3 text-body text-primary shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-base"
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

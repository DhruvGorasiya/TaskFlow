"use client";

import { useState, useCallback, useEffect } from "react";
import { triggerCanvasSync, getCanvasCourses } from "@/lib/api";
import type { CanvasCourse } from "@/lib/api";
import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { CheckCircle2, AlertCircle, Settings2, BookOpen } from "lucide-react";
import { loadSelectedCourseIds, storeSelectedCourseIds } from "@/lib/courseSelection";
import { Loader2 } from "lucide-react";

interface SyncResult {
  created: number;
  updated: number;
  total: number;
}

export default function SettingsPage() {
  const [isSyncing, setIsSyncing] = useState(false);
  const [result, setResult] = useState<SyncResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [courses, setCourses] = useState<CanvasCourse[]>([]);
  const [coursesLoading, setCoursesLoading] = useState(true);
  const [coursesError, setCoursesError] = useState<string | null>(null);
  const [selectedCourseIds, setSelectedCourseIds] = useState<number[]>([]);

  useEffect(() => {
    const stored = loadSelectedCourseIds();
    setSelectedCourseIds(stored);
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

  useEffect(() => {
    void fetchCourses();
  }, [fetchCourses]);

  const handleCourseToggle = (id: number) => {
    const next = selectedCourseIds.includes(id)
      ? selectedCourseIds.filter((c) => c !== id)
      : [...selectedCourseIds, id];
    setSelectedCourseIds(next);
    storeSelectedCourseIds(next);
    // Dispatch custom event for same-tab updates
    window.dispatchEvent(new Event("courseSelectionChanged"));
  };

  const handleSync = async () => {
    setIsSyncing(true);
    setError(null);
    setResult(null);
    try {
      const data = await triggerCanvasSync();
      setResult(data);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to trigger Canvas sync.",
      );
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <div className="max-w-2xl space-y-6 md:space-y-8">
      <div>
        <h1 className="text-page-title text-primary">
          Settings
        </h1>
        <p className="mt-1 text-caption text-muted">
          Manage integrations, course selection, and synchronization for TaskFlow.
        </p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-accent-muted border border-accent/20">
              <BookOpen className="h-5 w-5 text-accent" aria-hidden="true" />
            </div>
            <div>
              <h2 className="text-section-title text-primary">
                Courses to Show
              </h2>
              <p className="mt-0.5 text-caption text-muted">
                Select which Canvas courses to display on Dashboard and Agenda pages.
                Leave all unchecked to show tasks from every course.
              </p>
            </div>
          </div>
        </CardHeader>
        <CardBody className="space-y-4">
          {coursesLoading && (
            <div className="flex items-center gap-2 text-body text-muted">
              <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden="true" />
              Loading courses…
            </div>
          )}
          {coursesError && (
            <div className="flex items-center gap-2 rounded-lg border border-error/40 bg-error/10 px-3 py-2 text-body font-medium text-error">
              <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
              {coursesError}
            </div>
          )}
          {!coursesLoading && !coursesError && courses.length === 0 && (
            <p className="text-body text-muted">
              No Canvas courses. Configure Canvas integration and sync to load courses.
            </p>
          )}
          {!coursesLoading && courses.length > 0 && (
            <div className="flex flex-wrap gap-3">
              {courses.map((c) => {
                const checked = selectedCourseIds.includes(c.id);
                return (
                  <label
                    key={c.id}
                    className={`flex cursor-pointer items-center gap-3 rounded-lg border px-4 py-3 text-body transition-colors ${
                      checked
                        ? "border-accent bg-accent-muted text-accent"
                        : "border-border bg-elevated text-secondary hover:border-border hover:bg-surface"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => handleCourseToggle(c.id)}
                      className="h-4 w-4 shrink-0 rounded border-border bg-base text-accent focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-base"
                    />
                    <span>{c.name ?? `Course ${c.id}`}</span>
                  </label>
                );
              })}
            </div>
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-accent-muted border border-accent/20">
              <Settings2 className="h-5 w-5 text-accent" aria-hidden="true" />
            </div>
            <div>
              <h2 className="text-section-title text-primary">
                Canvas Sync
              </h2>
              <p className="mt-0.5 text-caption text-muted">
                Manually trigger a full sync of tasks from Canvas.
              </p>
            </div>
          </div>
        </CardHeader>
        <CardBody className="space-y-4">
          <div className="flex flex-wrap items-center gap-4">
            <Button
              onClick={handleSync}
              disabled={isSyncing}
              loading={isSyncing}
            >
              {isSyncing ? "Syncing…" : "Sync now"}
            </Button>
          </div>

          {error && (
            <div className="flex items-center gap-2 rounded-lg border border-error/40 bg-error/10 px-3 py-2 text-body font-medium text-error">
              <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
              {error}
            </div>
          )}

          {result && !error && (
            <div className="flex items-center gap-2 rounded-lg border border-success/40 bg-success/10 px-3 py-2 text-body text-success">
              <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span>
                Synced {result.total} tasks ({result.created} created,{" "}
                {result.updated} updated).
              </span>
            </div>
          )}
        </CardBody>
      </Card>

      <Card className="opacity-80">
        <CardHeader>
          <h2 className="text-section-title text-primary">
            Notion
          </h2>
          <p className="mt-0.5 text-caption text-muted">
            Push tasks to Notion from the Agenda page.
          </p>
        </CardHeader>
        <CardBody>
          <p className="text-body text-muted">
            Use the &quot;Push selected to Notion&quot; button on the Agenda page
            to sync tasks from selected Canvas courses to your Notion workspace.
          </p>
        </CardBody>
      </Card>
    </div>
  );
}

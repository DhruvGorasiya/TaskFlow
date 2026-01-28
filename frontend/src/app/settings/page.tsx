"use client";

import { useState } from "react";
import { triggerCanvasSync } from "@/lib/api";
import { Button } from "@/components/ui/Button";

interface SyncResult {
  created: number;
  updated: number;
  total: number;
}

export default function SettingsPage() {
  const [isSyncing, setIsSyncing] = useState(false);
  const [result, setResult] = useState<SyncResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSync = async () => {
    setIsSyncing(true);
    setError(null);
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
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-50">
          Settings
        </h1>
        <p className="mt-1 text-sm text-slate-400">
          Manage integrations and synchronization for TaskFlow.
        </p>
      </div>

      <section className="rounded-xl border border-slate-800 bg-slate-900/50 p-4 md:p-6 shadow-sm">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-base font-medium text-slate-50">
              Canvas Sync
            </h2>
            <p className="mt-1 text-sm text-slate-400">
              Manually trigger a full sync of tasks from Canvas.
            </p>
          </div>
          <Button onClick={handleSync} disabled={isSyncing}>
            {isSyncing ? "Syncing..." : "Sync now"}
          </Button>
        </div>

        {error && (
          <p className="mt-3 text-sm font-medium text-red-400">{error}</p>
        )}

        {result && !error && (
          <div className="mt-4 rounded-lg border border-slate-800 bg-slate-900/60 p-3 text-sm text-slate-300">
            <p className="font-medium text-slate-50">
              Synced {result.total} tasks
            </p>
            <p className="mt-1 text-slate-400">
              {result.created} created, {result.updated} updated.
            </p>
          </div>
        )}
      </section>
    </div>
  );
}


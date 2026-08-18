import type { TestRunStatus } from "@ghostqa/shared";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

import { listRuns } from "../api/runs.js";
import { EmptyState, ErrorState, LoadingState } from "../components/AsyncState.js";
import { PageHeader } from "../components/PageHeader.js";
import { RunTable } from "../components/RunTable.js";

type Filter = "ALL" | Extract<TestRunStatus, "COMPLETED" | "BASELINE_FAILED" | "ERROR">;

const filters: readonly { label: string; value: Filter }[] = [
  { label: "All", value: "ALL" },
  { label: "Completed", value: "COMPLETED" },
  { label: "Baseline failed", value: "BASELINE_FAILED" },
  { label: "Error", value: "ERROR" },
];

export const RunsPage = () => {
  const [filter, setFilter] = useState<Filter>("ALL");
  const runs = useQuery({ queryKey: ["runs"], queryFn: listRuns });

  if (runs.isPending) return <LoadingState label="Loading persisted runs…" />;
  if (runs.isError) return <ErrorState error={runs.error} onRetry={() => void runs.refetch()} />;

  const visibleRuns = filter === "ALL" ? runs.data : runs.data.filter((run) => run.status === filter);
  return (
    <div className="space-y-8">
      <PageHeader
        description="Execution state describes whether GhostQA finished; result counts describe target behavior."
        eyebrow="History"
        title="Runs"
      />
      <div className="flex flex-wrap gap-2" role="group" aria-label="Filter runs by execution status">
        {filters.map((option) => (
          <button
            aria-pressed={filter === option.value}
            className={`rounded-lg border px-3.5 py-2 text-sm font-medium ${filter === option.value ? "border-cyan-300/30 bg-cyan-300/10 text-cyan-200" : "border-slate-800 bg-slate-900/50 text-slate-400 hover:text-slate-200"}`}
            key={option.value}
            onClick={() => setFilter(option.value)}
            type="button"
          >
            {option.label}
          </button>
        ))}
      </div>
      {runs.data.length === 0 ? (
        <EmptyState message="Start testing from a configured flow to create persisted run history." title="No test runs yet" />
      ) : visibleRuns.length === 0 ? (
        <EmptyState message="No persisted runs match this execution-state filter." title="No matching runs" />
      ) : (
        <RunTable runs={visibleRuns} showProject />
      )}
    </div>
  );
};


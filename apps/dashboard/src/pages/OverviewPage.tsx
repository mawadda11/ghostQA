import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";

import { listProjects } from "../api/projects.js";
import { listRuns } from "../api/runs.js";
import { EmptyState, ErrorState, LoadingState } from "../components/AsyncState.js";
import { PageHeader } from "../components/PageHeader.js";
import { RunTable } from "../components/RunTable.js";
import { totalSummary } from "../utils/presentation.js";

export const OverviewPage = () => {
  const projects = useQuery({ queryKey: ["projects"], queryFn: listProjects });
  const runs = useQuery({ queryKey: ["runs"], queryFn: listRuns });

  if (projects.isPending || runs.isPending) {
    return <LoadingState label="Loading workspace overview…" />;
  }
  if (projects.isError || runs.isError) {
    const error = projects.error ?? runs.error;
    return (
      <ErrorState
        error={error}
        onRetry={() => {
          void projects.refetch();
          void runs.refetch();
        }}
        title="GhostQA workspace unavailable"
      />
    );
  }

  const totals = totalSummary(runs.data.map((run) => run.summary));
  const metrics = [
    { label: "Projects", value: projects.data.length, tone: "text-white" },
    { label: "Total runs", value: runs.data.length, tone: "text-white" },
    { label: "Failed scenarios", value: totals.failed, tone: "text-rose-300" },
    { label: "Needs review", value: totals.needsReview, tone: "text-amber-300" },
  ];

  return (
    <div className="space-y-8">
      <PageHeader
        description="Real browser runs and evidence persisted in your local GhostQA workspace."
        eyebrow="Workspace"
        title="Overview"
      />

      <section aria-label="Workspace metrics" className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        {metrics.map((metric) => (
          <article className="rounded-xl border border-slate-800 bg-slate-900/55 p-5" key={metric.label}>
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{metric.label}</p>
            <p className={`mt-3 text-3xl font-semibold tracking-tight ${metric.tone}`}>{metric.value}</p>
          </article>
        ))}
      </section>

      <aside className="flex flex-col gap-3 rounded-xl border border-sky-400/15 bg-sky-400/[0.045] px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-sky-200">Execution state and test result are separate</p>
          <p className="mt-1 text-sm leading-6 text-slate-400">
            A completed run means GhostQA finished testing. Its scenarios may still be PASS, FAIL, or NEEDS REVIEW.
          </p>
        </div>
        <span className="shrink-0 rounded-full border border-slate-700 bg-slate-900 px-3 py-1 text-xs font-medium text-slate-300">
          Evidence decides behavior status
        </span>
      </aside>

      <section aria-labelledby="recent-runs-heading" className="space-y-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-white" id="recent-runs-heading">Recent runs</h2>
            <p className="mt-1 text-sm text-slate-500">The five most recent persisted executions.</p>
          </div>
          <Link className="text-sm font-medium text-cyan-300 hover:text-cyan-200" to="/runs">View all runs</Link>
        </div>
        {runs.data.length === 0 ? (
          <EmptyState
            action={<Link className="rounded-lg bg-cyan-300 px-4 py-2 text-sm font-semibold text-slate-950" to="/projects">Open projects</Link>}
            message="Register a project and flow, then start a real browser run."
            title="No test runs yet"
          />
        ) : (
          <RunTable runs={runs.data.slice(0, 5)} showProject />
        )}
      </section>
    </div>
  );
};


import type { PersistedTestResult } from "@ghostqa/shared";
import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";

import { getProject } from "../api/projects.js";
import { getRun } from "../api/runs.js";
import { EmptyState, ErrorState, LoadingState } from "../components/AsyncState.js";
import { PageHeader } from "../components/PageHeader.js";
import { StatusBadge } from "../components/StatusBadge.js";
import { SummaryCounts } from "../components/SummaryCounts.js";
import {
  familyLabel,
  formatDateTime,
  formatDuration,
} from "../utils/presentation.js";

const ResultRow = ({ result }: { result: PersistedTestResult }) => {
  const evidenceCount =
    result.evidence.entries.length +
    result.evidence.network.length +
    result.evidence.console.length;
  const artifactKinds = [...new Set(result.artifacts.map((artifact) => artifact.kind))];
  return (
    <Link
      className="group grid gap-4 rounded-xl border border-slate-800 bg-slate-900/50 p-5 hover:border-slate-700 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"
      to={`/results/${result.id}`}
    >
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="font-semibold text-white group-hover:text-cyan-200">{result.title}</h3>
          {result.scenarioFamily === undefined ? <span className="rounded bg-slate-800 px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide text-slate-400">Baseline</span> : <span className="text-xs font-medium uppercase tracking-wide text-slate-500">{familyLabel(result.scenarioFamily)}</span>}
        </div>
        <p className="mt-2 line-clamp-2 text-sm leading-6 text-slate-400">{result.summary}</p>
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
          <span>{formatDuration(result.durationMs)}</span>
          <span>{evidenceCount} evidence observations</span>
          <span>{artifactKinds.length === 0 ? "No artifacts" : artifactKinds.map((kind) => kind.toLowerCase()).join(" + ")}</span>
        </div>
      </div>
      <div className="flex items-center justify-between gap-4 sm:justify-end"><StatusBadge status={result.status} /><span aria-hidden="true" className="text-slate-600 group-hover:text-cyan-300">→</span></div>
    </Link>
  );
};

export const RunDetailPage = () => {
  const { runId = "" } = useParams();
  const run = useQuery({ queryKey: ["run", runId], queryFn: () => getRun(runId), enabled: runId.length > 0 });
  const projectId = run.data?.projectId;
  const project = useQuery({ queryKey: ["project", projectId], queryFn: () => getProject(projectId ?? ""), enabled: projectId !== undefined });

  if (run.isPending || project.isPending) return <LoadingState label="Loading run results…" />;
  if (run.isError || project.isError) return <ErrorState error={run.error ?? project.error} onRetry={() => { void run.refetch(); void project.refetch(); }} />;

  return (
    <div className="space-y-8">
      <div className="text-sm text-slate-500"><Link className="hover:text-cyan-300" to="/runs">Runs</Link><span className="px-2">/</span><span className="font-mono text-slate-300">{run.data.id}</span></div>
      <PageHeader
        actions={<StatusBadge status={run.data.status} />}
        description={`${project.data.name} · ${run.data.flowName}`}
        eyebrow="Persisted run"
        title={`Run ${run.data.id.slice(-8)}`}
      />

      <aside className="rounded-xl border border-slate-700 bg-slate-900/55 px-5 py-4">
        <p className="text-sm leading-6 text-slate-300"><strong className="font-semibold text-white">Run status: {run.data.status.replaceAll("_", " ")}.</strong> This means the testing operation {run.data.status === "COMPLETED" ? "finished" : "did not finish normally"}; it does not mean every target behavior passed.</p>
      </aside>

      <section className="grid gap-4 lg:grid-cols-[1fr_1.2fr]">
        <article className="rounded-xl border border-slate-800 bg-slate-900/55 p-5">
          <div className="flex items-center justify-between gap-4"><div><p className="text-xs font-medium uppercase tracking-wide text-slate-500">Baseline result</p><p className="mt-2 text-sm text-slate-400">Known-good flow validation always runs first.</p></div><StatusBadge status={run.data.baselineStatus} /></div>
          {run.data.baselineResult === undefined ? <p className="mt-5 text-sm text-slate-500">No baseline result was persisted.</p> : <Link className="mt-5 inline-flex text-sm font-medium text-cyan-300 hover:text-cyan-200" to={`/results/${run.data.baselineResult.id}`}>Inspect baseline evidence →</Link>}
        </article>
        <article className="grid grid-cols-2 gap-x-5 gap-y-4 rounded-xl border border-slate-800 bg-slate-900/55 p-5 text-sm">
          <div><p className="text-xs uppercase tracking-wide text-slate-500">Project</p><Link className="mt-2 block font-medium text-cyan-300 hover:text-cyan-200" to={`/projects/${project.data.id}`}>{project.data.name}</Link></div>
          <div><p className="text-xs uppercase tracking-wide text-slate-500">Flow</p><Link className="mt-2 block font-medium text-cyan-300 hover:text-cyan-200" to={`/flows/${run.data.flowId}`}>{run.data.flowName}</Link></div>
          <div><p className="text-xs uppercase tracking-wide text-slate-500">Started</p><p className="mt-2 text-slate-300">{formatDateTime(run.data.startedAt)}</p></div>
          <div><p className="text-xs uppercase tracking-wide text-slate-500">Completed</p><p className="mt-2 text-slate-300">{formatDateTime(run.data.completedAt)}</p></div>
          <div className="col-span-2"><p className="text-xs uppercase tracking-wide text-slate-500">Target</p><p className="mt-2 break-all font-mono text-xs text-slate-300">{project.data.baseUrl}</p></div>
        </article>
      </section>

      <section className="space-y-4" aria-labelledby="summary-heading"><div><h2 className="text-lg font-semibold text-white" id="summary-heading">Behavior result summary</h2><p className="mt-1 text-sm text-slate-500">Scenario classifications only; baseline is shown separately.</p></div><SummaryCounts summary={run.data.summary} /></section>

      {run.data.errorMessage === undefined ? null : <div className="rounded-xl border border-red-400/20 bg-red-400/[0.06] p-5"><h2 className="font-semibold text-red-200">Execution error</h2><p className="mt-2 text-sm leading-6 text-red-100/70">{run.data.errorMessage}</p></div>}

      <section className="space-y-3" aria-labelledby="results-heading"><div><h2 className="text-lg font-semibold text-white" id="results-heading">Scenario results</h2><p className="mt-1 text-sm text-slate-500">Open a result to inspect the evidence behind its classification.</p></div>{run.data.scenarioResults.length === 0 ? <EmptyState message={run.data.status === "BASELINE_FAILED" ? "Behavioral scenarios were correctly skipped because the baseline did not pass." : "No scenario results were persisted for this run."} title="No behavioral results" /> : run.data.scenarioResults.map((result) => <ResultRow key={result.id} result={result} />)}</section>
    </div>
  );
};

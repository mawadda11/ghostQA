import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";

import { getProject } from "../api/projects.js";
import { artifactUrl, getResult, getRun } from "../api/runs.js";
import { EmptyState, ErrorState, LoadingState } from "../components/AsyncState.js";
import { PageHeader } from "../components/PageHeader.js";
import { ScreenshotViewer } from "../components/ScreenshotViewer.js";
import { StatusBadge } from "../components/StatusBadge.js";
import {
  familyLabel,
  formatDateTime,
  formatDuration,
  networkDuration,
  networkPath,
} from "../utils/presentation.js";

const responseTone = (status?: number): string => {
  if (status === undefined) return "text-slate-400";
  if (status >= 500) return "text-rose-300";
  if (status === 401) return "text-amber-300";
  if (status >= 200 && status < 300) return "text-emerald-300";
  return "text-slate-300";
};

export const ResultDetailPage = () => {
  const { resultId = "" } = useParams();
  const result = useQuery({ queryKey: ["result", resultId], queryFn: () => getResult(resultId), enabled: resultId.length > 0 });
  const testRunId = result.data?.testRunId;
  const run = useQuery({ queryKey: ["run", testRunId], queryFn: () => getRun(testRunId ?? ""), enabled: testRunId !== undefined });
  const projectId = run.data?.projectId;
  const project = useQuery({ queryKey: ["project", projectId], queryFn: () => getProject(projectId ?? ""), enabled: projectId !== undefined });

  if (result.isPending || run.isPending || project.isPending) return <LoadingState label="Loading execution evidence…" />;
  if (result.isError || run.isError || project.isError) return <ErrorState error={result.error ?? run.error ?? project.error} onRetry={() => { void result.refetch(); void run.refetch(); void project.refetch(); }} />;

  const screenshots = result.data.artifacts.filter((artifact) => artifact.kind === "SCREENSHOT");
  const traces = result.data.artifacts.filter((artifact) => artifact.kind === "TRACE");
  const pageErrors = result.data.evidence.console.filter((entry) => entry.source === "PAGE_ERROR");
  const consoleEntries = result.data.evidence.console.filter((entry) => entry.source === "CONSOLE");

  return (
    <div className="space-y-8">
      <div className="text-sm text-slate-500"><Link className="hover:text-cyan-300" to="/runs">Runs</Link><span className="px-2">/</span><Link className="hover:text-cyan-300" to={`/runs/${run.data.id}`}>Run {run.data.id.slice(-8)}</Link><span className="px-2">/</span><span className="text-slate-300">{result.data.title}</span></div>
      <PageHeader
        actions={<StatusBadge status={result.data.status} />}
        description={result.data.kind === "BASELINE" ? "Known-good baseline validation result" : result.data.scenarioFamily === undefined ? "Behavioral scenario result" : familyLabel(result.data.scenarioFamily)}
        eyebrow={result.data.kind === "BASELINE" ? "Baseline evidence" : "Scenario evidence"}
        title={result.data.title}
      />

      <section className="grid gap-4 xl:grid-cols-[1.4fr_1fr]">
        <article className="rounded-xl border border-slate-800 bg-slate-900/55 p-5 sm:p-6"><p className="text-xs font-medium uppercase tracking-wide text-slate-500">Classification summary</p><p className="mt-3 text-base leading-7 text-slate-200">{result.data.summary}</p>{result.data.failureOrigin === undefined ? null : <p className="mt-4 text-xs text-slate-500">Origin <span className="ml-2 rounded bg-slate-950 px-2 py-1 font-mono text-slate-300">{result.data.failureOrigin}</span></p>}</article>
        <article className="grid grid-cols-2 gap-4 rounded-xl border border-slate-800 bg-slate-900/55 p-5 text-sm"><div><p className="text-xs uppercase tracking-wide text-slate-500">Duration</p><p className="mt-2 text-slate-200">{formatDuration(result.data.durationMs)}</p></div><div><p className="text-xs uppercase tracking-wide text-slate-500">Artifacts</p><p className="mt-2 text-slate-200">{result.data.artifacts.length}</p></div><div><p className="text-xs uppercase tracking-wide text-slate-500">Started</p><p className="mt-2 text-slate-300">{formatDateTime(result.data.startedAt)}</p></div><div><p className="text-xs uppercase tracking-wide text-slate-500">Completed</p><p className="mt-2 text-slate-300">{formatDateTime(result.data.completedAt)}</p></div></article>
      </section>

      <section className="space-y-4" aria-labelledby="evidence-heading">
        <div><h2 className="text-lg font-semibold text-white" id="evidence-heading">Evidence summary</h2><p className="mt-1 text-sm text-slate-500">Recorded messages from the deterministic browser execution.</p></div>
        {result.data.evidence.entries.length === 0 ? <EmptyState message="This execution report did not record structured evidence messages." title="No evidence recorded" /> : <div className="space-y-2">{result.data.evidence.entries.map((entry, index) => <article className="rounded-xl border border-slate-800 bg-slate-900/45 px-4 py-4" key={`${entry.timestamp}-${index}`}><div className="flex flex-wrap items-center justify-between gap-2"><span className="rounded-md bg-slate-800 px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-cyan-300">{entry.type.replaceAll("_", " ")}</span><time className="text-xs text-slate-600">{formatDateTime(entry.timestamp)}</time></div><p className="mt-3 text-sm leading-6 text-slate-200">{entry.message}</p>{entry.metadata === undefined ? null : <details className="mt-3"><summary className="cursor-pointer text-xs text-slate-500 hover:text-slate-300">Technical metadata</summary><pre className="mt-2 overflow-auto rounded-lg bg-slate-950 p-3 text-xs text-slate-400">{JSON.stringify(entry.metadata, null, 2)}</pre></details>}</article>)}</div>}
      </section>

      <section className="space-y-4" aria-labelledby="network-heading">
        <div><h2 className="text-lg font-semibold text-white" id="network-heading">Network evidence</h2><p className="mt-1 text-sm text-slate-500">Captured response status is context, not an automatic failure decision.</p></div>
        {result.data.evidence.network.length === 0 ? <EmptyState message="No network observations were recorded for this result." title="No network evidence" /> : <div className="overflow-x-auto rounded-xl border border-slate-800"><table className="w-full min-w-[680px] text-left text-sm"><thead className="border-b border-slate-800 bg-slate-900/80 text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-4 py-3 font-medium">Method</th><th className="px-4 py-3 font-medium">Request</th><th className="px-4 py-3 font-medium">Status</th><th className="px-4 py-3 font-medium">Timing</th></tr></thead><tbody className="divide-y divide-slate-800 bg-slate-900/35">{result.data.evidence.network.map((observation, index) => <tr key={`${observation.startedAt}-${index}`}><td className="px-4 py-3 font-mono text-xs text-cyan-300">{observation.method}</td><td className="max-w-lg px-4 py-3"><details><summary className="cursor-pointer break-all font-mono text-xs text-slate-300">{networkPath(observation.url)}</summary><p className="mt-2 break-all font-mono text-[11px] leading-5 text-slate-500">{observation.url}</p>{observation.failureText === undefined ? null : <p className="mt-2 text-xs text-rose-300">{observation.failureText}</p>}</details></td><td className={`px-4 py-3 font-mono text-xs font-semibold ${responseTone(observation.status)}`}>{observation.status ?? "Failed"}</td><td className="px-4 py-3 text-xs text-slate-400">{networkDuration(observation.startedAt, observation.completedAt)}</td></tr>)}</tbody></table></div>}
      </section>

      <section className="grid gap-5 xl:grid-cols-2" aria-label="Browser evidence">
        <article className="rounded-xl border border-slate-800 bg-slate-900/50 p-5"><h2 className="text-lg font-semibold text-white">Browser state</h2><dl className="mt-5 space-y-4 text-sm"><div><dt className="text-xs uppercase tracking-wide text-slate-500">Final URL</dt><dd className="mt-2 break-all font-mono text-xs text-slate-300">{result.data.finalUrl ?? result.data.evidence.finalUrl ?? "Not recorded"}</dd></div><div><dt className="text-xs uppercase tracking-wide text-slate-500">Success assertion</dt><dd className="mt-2 flex items-center gap-3"><StatusBadge label={result.data.assertion.status.replaceAll("_", " ")} status={result.data.assertion.status === "PASSED" ? "PASS" : result.data.assertion.status === "FAILED" ? "FAIL" : "NEEDS_REVIEW"} /><span className="text-slate-400">{result.data.assertion.detail}</span></dd></div></dl></article>
        <article className="rounded-xl border border-slate-800 bg-slate-900/50 p-5"><h2 className="text-lg font-semibold text-white">Console and page errors</h2><div className="mt-4 space-y-3">{pageErrors.length === 0 && consoleEntries.length === 0 ? <p className="text-sm text-slate-500">No console or page-error observations recorded.</p> : [...pageErrors, ...consoleEntries].map((entry, index) => <div className="rounded-lg border border-slate-800 bg-slate-950/55 p-3" key={`${entry.timestamp}-${index}`}><div className="flex gap-2 text-[11px] font-semibold uppercase tracking-wide"><span className={entry.source === "PAGE_ERROR" || entry.level === "error" ? "text-rose-300" : "text-amber-300"}>{entry.source.replaceAll("_", " ")}</span><span className="text-slate-600">{entry.level}</span></div><p className="mt-2 break-words font-mono text-xs leading-5 text-slate-300">{entry.text}</p></div>)}</div></article>
      </section>

      <section className="space-y-4" aria-labelledby="steps-heading"><div><h2 className="text-lg font-semibold text-white" id="steps-heading">Executed steps</h2><p className="mt-1 text-sm text-slate-500">Compact execution record for the baseline journey.</p></div>{result.data.executedSteps.length === 0 ? <EmptyState message="No step observations were persisted for this execution." title="No executed steps" /> : <ol className="grid gap-2 lg:grid-cols-2">{result.data.executedSteps.map((step) => <li className="flex items-start gap-3 rounded-lg border border-slate-800 bg-slate-900/40 p-3.5" key={`${step.position}-${step.stepId}`}><span className={`mt-0.5 size-2 shrink-0 rounded-full ${step.status === "PASSED" ? "bg-emerald-400" : "bg-rose-400"}`} /><div className="min-w-0"><p className="text-sm font-medium text-slate-200">{step.position + 1}. {step.action.replaceAll("_", " ")}</p><p className="mt-1 truncate font-mono text-xs text-slate-500">{step.stepId}</p>{step.error === undefined ? null : <p className="mt-2 text-xs leading-5 text-rose-300">{step.error}</p>}</div></li>)}</ol>}</section>

      <section className="space-y-4" aria-labelledby="artifacts-heading"><div><h2 className="text-lg font-semibold text-white" id="artifacts-heading">Artifacts</h2><p className="mt-1 text-sm text-slate-500">Files are retrieved only through validated artifact IDs.</p></div>{screenshots.length === 0 && traces.length === 0 ? <EmptyState message="This result has no screenshot or trace artifact." title="No artifacts available" /> : <div className="grid gap-5 xl:grid-cols-[minmax(0,1.6fr)_minmax(18rem,0.7fr)]"><div className="space-y-3">{screenshots.map((artifact) => <ScreenshotViewer artifact={artifact} key={artifact.id} />)}</div><div className="space-y-3">{traces.map((artifact) => <article className="rounded-xl border border-slate-800 bg-slate-900/55 p-5" key={artifact.id}><p className="text-sm font-semibold text-white">Playwright trace</p><p className="mt-2 text-sm leading-6 text-slate-400">Download this ZIP and open it with Playwright Trace Viewer.</p><a className="mt-5 inline-flex rounded-lg border border-cyan-300/30 bg-cyan-300/10 px-3.5 py-2 text-sm font-semibold text-cyan-200 hover:bg-cyan-300/15" href={artifactUrl(artifact.id)}>Download trace</a></article>)}</div></div>}</section>

      <details className="rounded-xl border border-slate-800 bg-slate-900/40"><summary className="cursor-pointer px-5 py-4 text-sm font-semibold text-slate-300 hover:text-white">Raw evidence</summary><pre className="max-h-[38rem] overflow-auto border-t border-slate-800 bg-slate-950 p-5 text-xs leading-5 text-slate-400">{JSON.stringify({ evidence: result.data.evidence, assertion: result.data.assertion, executionError: result.data.executionError, executedSteps: result.data.executedSteps, artifacts: result.data.artifacts }, null, 2)}</pre></details>
    </div>
  );
};

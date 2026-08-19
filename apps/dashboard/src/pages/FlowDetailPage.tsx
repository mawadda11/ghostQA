import type { ScenarioDefinition } from "@ghostqa/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";

import {
  getFlow,
  getTestPlanRecommendations,
  importScenarioPlan,
  listFlowScenarios,
  replayBaseline,
  runFlow,
  saveTestPlan,
  updateScenarioEnabled,
} from "../api/flows.js";
import { getProject } from "../api/projects.js";
import { ErrorState, LoadingState } from "../components/AsyncState.js";
import { JsonImportDialog } from "../components/JsonImportDialog.js";
import { PageHeader } from "../components/PageHeader.js";
import { StatusBadge } from "../components/StatusBadge.js";
import { TestPlanBuilder } from "../components/TestPlanBuilder.js";
import {
  actionLabel,
  describeFlowStep,
  describeSuccessAssertion,
  familyLabel,
  scenarioPurpose,
} from "../utils/presentation.js";

export const FlowDetailPage = () => {
  const { flowId = "" } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [importingScenarios, setImportingScenarios] = useState(false);
  const [buildingPlan, setBuildingPlan] = useState(false);
  const flow = useQuery({ queryKey: ["flow", flowId], queryFn: () => getFlow(flowId), enabled: flowId.length > 0 });
  const projectId = flow.data?.projectId;
  const project = useQuery({ queryKey: ["project", projectId], queryFn: () => getProject(projectId ?? ""), enabled: projectId !== undefined });
  const scenarios = useQuery({ queryKey: ["flow-scenarios", flowId], queryFn: () => listFlowScenarios(flowId), enabled: flowId.length > 0 });
  const recommendations = useQuery({ queryKey: ["test-plan-recommendations", flowId], queryFn: () => getTestPlanRecommendations(flowId), enabled: flowId.length > 0 && (buildingPlan || scenarios.data?.length === 0) });
  const toggleMutation = useMutation({
    mutationFn: ({ scenarioId, enabled }: { scenarioId: string; enabled: boolean }) => updateScenarioEnabled(scenarioId, enabled),
    onSuccess: async () => queryClient.invalidateQueries({ queryKey: ["flow-scenarios", flowId] }),
  });
  const importMutation = useMutation({
    mutationFn: (definitions: readonly ScenarioDefinition[]) => importScenarioPlan(flowId, definitions),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["flow-scenarios", flowId] }),
        queryClient.invalidateQueries({ queryKey: ["project-flows", flow.data?.projectId] }),
      ]);
      setImportingScenarios(false);
    },
  });
  const planMutation = useMutation({
    mutationFn: (definitions: readonly ScenarioDefinition[]) => saveTestPlan(flowId, definitions),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["flow-scenarios", flowId] }),
        queryClient.invalidateQueries({ queryKey: ["project-flows", flow.data?.projectId] }),
      ]);
      setBuildingPlan(false);
    },
  });
  const replayMutation = useMutation({
    mutationFn: () => replayBaseline(flowId),
    onSuccess: async (run) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["runs"] }),
        queryClient.invalidateQueries({ queryKey: ["project-runs", run.projectId] }),
      ]);
    },
  });
  const runMutation = useMutation({
    mutationFn: () => runFlow(flowId),
    onSuccess: async (run) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["runs"] }),
        queryClient.invalidateQueries({ queryKey: ["project-runs", run.projectId] }),
      ]);
      navigate(`/runs/${run.id}`);
    },
  });

  if (flow.isPending || scenarios.isPending || project.isPending) return <LoadingState label="Loading baseline flow…" />;
  if (flow.isError || scenarios.isError || project.isError) {
    return <ErrorState error={flow.error ?? scenarios.error ?? project.error} onRetry={() => { void flow.refetch(); void scenarios.refetch(); void project.refetch(); }} />;
  }

  const assertion =
    flow.data.successAssertion === undefined
      ? undefined
      : describeSuccessAssertion(flow.data.successAssertion);
  const enabledCount = scenarios.data.filter((scenario) => scenario.enabled).length;

  return (
    <div className="space-y-8">
      <div className="text-sm text-slate-500"><Link className="hover:text-cyan-300" to="/projects">Projects</Link><span className="px-2">/</span><Link className="hover:text-cyan-300" to={`/projects/${project.data.id}`}>{project.data.name}</Link><span className="px-2">/</span><span className="text-slate-300">{flow.data.name}</span></div>
      <PageHeader
        actions={<div className="flex flex-wrap gap-2"><button className="rounded-lg border border-cyan-300/40 px-4 py-2.5 text-sm font-semibold text-cyan-200 hover:bg-cyan-300/10 disabled:opacity-50" disabled={replayMutation.isPending || runMutation.isPending} onClick={() => replayMutation.mutate()} type="button">{replayMutation.isPending ? "Replaying baseline…" : "Replay baseline"}</button><button className="rounded-lg bg-cyan-300 px-5 py-2.5 text-sm font-semibold text-slate-950 hover:bg-cyan-200 disabled:cursor-not-allowed disabled:opacity-60" disabled={runMutation.isPending || replayMutation.isPending || enabledCount === 0 || (replayMutation.data !== undefined && replayMutation.data.baselineStatus !== "PASS")} onClick={() => runMutation.mutate()} type="button">{runMutation.isPending ? "Running GhostQA…" : "Run tests"}</button></div>}
        description={`${flow.data.steps.length} normalized steps · ${enabledCount} of ${scenarios.data.length} scenario instances enabled`}
        eyebrow="Baseline flow"
        title={flow.data.name}
      />

      {replayMutation.isPending ? (
        <section aria-live="polite" className="rounded-xl border border-sky-400/20 bg-sky-400/[0.05] p-5"><h2 className="font-semibold text-sky-200">Replaying baseline…</h2><p className="mt-1 text-sm text-slate-400">GhostQA is using the existing Chromium baseline engine to reproduce the captured journey.</p></section>
      ) : null}
      {replayMutation.data?.baselineResult === undefined ? null : (
        <section className="rounded-xl border border-slate-800 bg-slate-900/55 p-5" aria-live="polite"><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Baseline replay</p><div className="mt-2"><StatusBadge status={replayMutation.data.baselineResult.status} /></div></div><Link className="text-sm font-medium text-cyan-300" to={`/runs/${replayMutation.data.id}`}>Open evidence</Link></div><p className="mt-3 text-sm text-slate-400">{replayMutation.data.baselineResult.status === "PASS" ? "Known-good journey reproduced successfully." : "Captured journey could not be reproduced. Review its evidence before running scenarios."}</p></section>
      )}
      {replayMutation.isError ? <ErrorState error={replayMutation.error} title="Baseline replay failed" /> : null}

      {runMutation.isPending ? (
        <section aria-live="polite" className="rounded-xl border border-sky-400/20 bg-sky-400/[0.05] p-5">
          <div className="flex items-start gap-4"><span className="mt-0.5 block size-5 shrink-0 animate-spin rounded-full border-2 border-sky-800 border-t-sky-300" /><div><h2 className="font-semibold text-sky-200">Running GhostQA…</h2><p className="mt-1 text-sm leading-6 text-slate-400">The server is validating the baseline, executing enabled behavioral scenarios sequentially, and collecting evidence. It will return the persisted run when execution finishes.</p><p className="mt-2 text-xs text-slate-500">No progress percentage is shown because the synchronous V1 API does not expose per-scenario live progress.</p></div></div>
        </section>
      ) : null}
      {runMutation.isError ? <ErrorState error={runMutation.error} title="Run failed to start or complete" /> : null}

      <section className="grid gap-5 xl:grid-cols-[1.6fr_1fr]">
        <article className="rounded-xl border border-slate-800 bg-slate-900/50 p-5 sm:p-6">
          <div><h2 className="text-lg font-semibold text-white">Baseline journey</h2><p className="mt-1 text-sm text-slate-500">Sensitive fill values are masked in this view.</p></div>
          <ol className="mt-6 space-y-2">
            {flow.data.steps.map((step) => {
              const critical = step.id === flow.data.criticalAction?.stepId;
              const attachedAssertions = flow.data.assertions?.filter(
                ({ afterStepId }) => afterStepId === step.id,
              ) ?? [];
              return (
                <li className={`flex gap-4 rounded-lg border px-4 py-3.5 ${critical ? "border-cyan-300/30 bg-cyan-300/[0.055]" : "border-slate-800 bg-slate-950/40"}`} key={step.id}>
                  <span className={`grid size-7 shrink-0 place-items-center rounded-md text-xs font-semibold ${critical ? "bg-cyan-300 text-slate-950" : "bg-slate-800 text-slate-400"}`}>{step.position + 1}</span>
                  <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><p className="text-sm font-medium text-slate-200">{actionLabel(step.action)}</p>{critical ? <span className="rounded-full bg-cyan-300/10 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-cyan-300">Critical action</span> : null}</div><p className="mt-1 break-words text-sm text-slate-400">{describeFlowStep(step)}</p>{attachedAssertions.map((flowAssertion) => { const described = describeSuccessAssertion(flowAssertion.assertion); return <p className="mt-2 rounded-md border border-emerald-300/15 bg-emerald-300/[0.04] px-2.5 py-2 text-xs text-emerald-100/80" key={flowAssertion.id}>Assertion: {described.label} — {described.value}</p>; })}</div>
                </li>
              );
            })}
          </ol>
        </article>

        <div className="space-y-4">
          <article className="rounded-xl border border-cyan-300/20 bg-cyan-300/[0.045] p-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-cyan-300">Critical action</p>
            {flow.data.criticalAction === undefined ? <p className="mt-3 text-sm text-slate-400">No critical action. This flow can still be replayed and use navigation scenarios.</p> : <><p className="mt-3 text-lg font-semibold text-white">{flow.data.criticalAction.label}</p>{flow.data.criticalAction.request === undefined ? <p className="mt-2 text-sm text-slate-500">No critical request matcher configured.</p> : <div className="mt-4 rounded-lg border border-slate-700 bg-slate-950/70 p-3"><p className="text-xs uppercase tracking-wide text-slate-500">Critical request</p><p className="mt-2 font-mono text-sm text-slate-200"><span className="text-cyan-300">{flow.data.criticalAction.request.method}</span> {flow.data.criticalAction.request.pathname}</p></div>}</>}
          </article>
          <article className="rounded-xl border border-slate-800 bg-slate-900/55 p-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Final assertion</p>
            {assertion === undefined ? <p className="mt-3 text-sm text-slate-500">No final assertion; step-bound assertions define expected states.</p> : <><p className="mt-3 text-sm font-medium text-slate-200">{assertion.label}</p><p className="mt-1 break-words text-sm text-slate-400">{assertion.value}</p></>}
          </article>
          <article className="rounded-xl border border-slate-800 bg-slate-900/55 p-5"><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Target</p><p className="mt-3 break-all font-mono text-xs text-slate-300">{project.data.baseUrl}</p></article>
        </div>
      </section>

      <section className="space-y-4" aria-labelledby="scenario-plan-heading">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><h2 className="text-lg font-semibold text-white" id="scenario-plan-heading">Test plan</h2><p className="mt-1 text-sm text-slate-500">GhostQA selects a focused set of applicable V1 scenarios; every flow keeps its own plan.</p></div>{scenarios.data.length === 0 ? null : <button className="rounded-lg border border-cyan-300/35 px-3.5 py-2 text-sm font-medium text-cyan-200 hover:bg-cyan-300/10" onClick={() => setBuildingPlan(true)} type="button">Customize test plan</button>}</div>
        {toggleMutation.isError ? <ErrorState error={toggleMutation.error} title="Scenario update failed" /> : null}
        {buildingPlan || scenarios.data.length === 0 ? (
          <div className="rounded-xl border border-slate-800 bg-slate-950/25 p-5 sm:p-6">
            {recommendations.isPending ? <LoadingState label="Analyzing captured flow…" /> : recommendations.isError ? <ErrorState error={recommendations.error} onRetry={() => { void recommendations.refetch(); }} title="Test plan recommendations unavailable" /> : <TestPlanBuilder onSave={(definitions) => planMutation.mutate(definitions)} pending={planMutation.isPending} plan={recommendations.data} />}
            {planMutation.isError ? <div className="mt-4"><ErrorState error={planMutation.error} title="Test plan could not be saved" /></div> : null}
          </div>
        ) : (
          <div className="grid gap-3 xl:grid-cols-2">
            {scenarios.data.map((scenario) => {
              const checkpoint = "checkpointStepId" in scenario.config ? scenario.config.checkpointStepId : undefined;
              const changing = toggleMutation.isPending && toggleMutation.variables?.scenarioId === scenario.id;
              return (
                <article className={`rounded-xl border p-5 ${scenario.enabled ? "border-slate-700 bg-slate-900/60" : "border-slate-800 bg-slate-900/30 opacity-75"}`} key={scenario.id}>
                  <div className="flex items-start justify-between gap-4"><div><h3 className="font-semibold text-white">{scenario.name}</h3><p className="mt-1 text-xs font-medium uppercase tracking-wide text-cyan-300">{familyLabel(scenario.family)}</p></div><label className="flex cursor-pointer items-center gap-2 text-xs font-medium text-slate-300"><span>{scenario.enabled ? "Enabled" : "Disabled"}</span><input checked={scenario.enabled} className="size-4 accent-cyan-300" disabled={changing || runMutation.isPending} onChange={(event) => toggleMutation.mutate({ scenarioId: scenario.id, enabled: event.target.checked })} type="checkbox" /></label></div>
                  <p className="mt-4 text-sm leading-6 text-slate-400">{scenarioPurpose(scenario.family)}</p>
                  {checkpoint === undefined ? null : <p className="mt-3 text-xs text-slate-500">Checkpoint <code className="rounded bg-slate-950 px-1.5 py-1 text-slate-300">{checkpoint}</code></p>}
                  <details className="mt-4 border-t border-slate-800 pt-3"><summary className="cursor-pointer text-xs font-medium text-slate-400 hover:text-slate-200">Technical configuration</summary><pre className="mt-3 max-h-72 overflow-auto rounded-lg bg-slate-950 p-3 text-xs leading-5 text-slate-400">{JSON.stringify(scenario.config, null, 2)}</pre></details>
                </article>
              );
            })}
          </div>
        )}
        <details className="rounded-lg border border-slate-800 bg-slate-900/35 p-4">
          <summary className="cursor-pointer text-sm font-medium text-slate-400 hover:text-slate-200">Advanced</summary>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3"><p className="text-xs leading-5 text-slate-500">Import validated ScenarioDefinition JSON for existing advanced workflows.</p><button className="rounded-lg border border-slate-700 px-3.5 py-2 text-sm font-medium text-slate-200" onClick={() => setImportingScenarios(true)} type="button">Import scenario JSON</button></div>
        </details>
      </section>

      {importingScenarios ? <JsonImportDialog kind="scenarios" onClose={() => setImportingScenarios(false)} onImport={(value) => importMutation.mutateAsync(value as readonly ScenarioDefinition[]).then(() => undefined)} /> : null}
    </div>
  );
};

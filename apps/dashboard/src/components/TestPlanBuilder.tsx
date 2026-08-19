import type {
  ElementStateExpectation,
  ScenarioDefinition,
  TestPlanRecommendation,
  TestPlanRecommendations,
} from "@ghostqa/shared";
import { useMemo, useState } from "react";

import {
  buildScenarioDefinitions,
  initialTestPlanSelections,
} from "../utils/test-plan.js";

const inputClasses =
  "mt-1.5 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-200 outline-none focus:border-cyan-300/50";

const recommendationLabel = (recommendation: TestPlanRecommendation): string =>
  recommendation.recommendation === "NOT_APPLICABLE"
    ? "Not applicable"
    : recommendation.configuration === "NEEDS_CONFIGURATION"
      ? "Needs configuration"
      : recommendation.defaultSelected === true
        ? "Focused"
        : "Available";

export const TestPlanBuilder = ({
  plan,
  pending,
  onSave,
}: {
  plan: TestPlanRecommendations;
  pending: boolean;
  onSave: (definitions: readonly ScenarioDefinition[]) => void;
}) => {
  const [selections, setSelections] = useState(() =>
    initialTestPlanSelections(plan),
  );
  const [attempted, setAttempted] = useState(false);
  const [customizing, setCustomizing] = useState(false);
  const built = useMemo(
    () => buildScenarioDefinitions(plan, selections),
    [plan, selections],
  );
  const update = (
    key: string,
    change: Partial<(typeof selections)[string]>,
  ): void => {
    const current = selections[key];
    if (current === undefined) return;
    setSelections({ ...selections, [key]: { ...current, ...change } });
  };
  const visibleRecommendations = plan.recommendations.filter(
    (recommendation) =>
      customizing || selections[recommendation.scenarioKey]?.enabled === true,
  );

  return (
    <section className="space-y-4" aria-labelledby="test-plan-builder-heading">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-white" id="test-plan-builder-heading">Focused plan</h2>
          <p className="mt-1 text-sm leading-6 text-slate-500">GhostQA selected a small applicable plan from captured structure and user-confirmed metadata.</p>
        </div>
        <button className="shrink-0 rounded-lg border border-slate-700 px-3.5 py-2 text-sm font-medium text-slate-200 hover:border-cyan-300/40" onClick={() => setCustomizing((value) => !value)} type="button">{customizing ? "Finish customizing" : "Customize test plan"}</button>
      </div>
      <div className="grid gap-3 xl:grid-cols-2">
        {visibleRecommendations.map((recommendation) => {
          const selection = selections[recommendation.scenarioKey];
          if (selection === undefined) return null;
          const unavailable = recommendation.configuration === "NOT_APPLICABLE";
          const needsObservation =
            recommendation.family === "API_FAILURE" ||
            recommendation.family === "REFRESH_BACK_NAVIGATION" ||
            recommendation.family === "SESSION_EXPIRY";
          return (
            <article className={`rounded-xl border p-5 ${selection.enabled ? "border-cyan-300/30 bg-cyan-300/[0.04]" : "border-slate-800 bg-slate-900/45"}`} key={recommendation.scenarioKey}>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="font-semibold text-white">{recommendation.name}</h3>
                  <span className={`mt-2 inline-block rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide ${unavailable ? "bg-slate-800 text-slate-500" : recommendation.defaultSelected === true ? "bg-cyan-300/10 text-cyan-300" : "bg-amber-300/10 text-amber-200"}`}>{recommendationLabel(recommendation)}</span>
                </div>
                {customizing ? (
                  <label className="flex items-center gap-2 text-xs font-medium text-slate-300">
                    <span>{selection.enabled ? "Selected" : "Off"}</span>
                    <input aria-label={`Enable ${recommendation.name}`} checked={selection.enabled} className="size-4 accent-cyan-300" disabled={unavailable || pending} onChange={(event) => update(recommendation.scenarioKey, { enabled: event.target.checked })} type="checkbox" />
                  </label>
                ) : (
                  <span className="rounded-full bg-cyan-300/10 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-cyan-300">Selected</span>
                )}
              </div>
              <p className="mt-3 text-sm leading-6 text-slate-400">{recommendation.reason}</p>
              {recommendation.request === undefined ? null : <p className="mt-3 rounded-lg bg-slate-950 p-2.5 font-mono text-xs text-slate-300"><span className="text-cyan-300">{recommendation.request.method}</span> {recommendation.request.pathname}</p>}
              {!customizing || !selection.enabled ? null : (
                <div className="mt-4 grid gap-3 border-t border-slate-800 pt-4 sm:grid-cols-2">
                  {recommendation.family === "DOUBLE_ACTION" ? (
                    <p className="text-xs leading-5 text-slate-500 sm:col-span-2">GhostQA will repeat the selected critical click and inspect small successful JSON responses for safe identifier proof.</p>
                  ) : (
                    <label className="text-xs font-medium text-slate-400">Checkpoint<select className={inputClasses} onChange={(event) => update(recommendation.scenarioKey, { checkpointStepId: event.target.value })} value={selection.checkpointStepId}><option value="">Choose a captured step…</option>{plan.steps.map((step) => <option key={step.id} value={step.id}>{step.label}</option>)}</select></label>
                  )}
                  {needsObservation ? (
                    <>
                      <label className="text-xs font-medium text-slate-400">{recommendation.family === "API_FAILURE" ? "Optional expected element" : "Observed element"}<select className={inputClasses} onChange={(event) => update(recommendation.scenarioKey, { observationId: event.target.value })} value={selection.observationId}><option value="">{recommendation.family === "API_FAILURE" ? "Use automatic observation" : "Choose a captured element…"}</option>{plan.observations.map((observation) => <option key={observation.id} value={observation.id}>{observation.label}</option>)}</select></label>
                      <label className="text-xs font-medium text-slate-400">Expected state<select className={inputClasses} onChange={(event) => update(recommendation.scenarioKey, { expectedState: event.target.value as ElementStateExpectation })} value={selection.expectedState}>{["VISIBLE", "HIDDEN", "ENABLED", "DISABLED"].map((state) => <option key={state} value={state}>{state.toLowerCase()}</option>)}</select></label>
                    </>
                  ) : null}
                  {recommendation.family === "API_FAILURE" ? <p className="self-end rounded-lg bg-slate-950 p-2.5 text-xs text-slate-400">Injected response: <span className="font-mono text-slate-200">500</span>. Automatic mode observes control recovery and semantic status feedback.</p> : null}
                  {recommendation.family === "SLOW_RESPONSE" ? <label className="text-xs font-medium text-slate-400">Delay (ms)<input className={inputClasses} max={10000} min={100} onChange={(event) => update(recommendation.scenarioKey, { delayMs: Number(event.target.value) })} type="number" value={selection.delayMs} /></label> : null}
                  {recommendation.family === "SESSION_EXPIRY" ? (
                    <>
                      <label className="text-xs font-medium text-slate-400">Session request method<input className={inputClasses} onChange={(event) => update(recommendation.scenarioKey, { sessionMethod: event.target.value })} placeholder="GET" value={selection.sessionMethod} /></label>
                      <label className="text-xs font-medium text-slate-400">Session request path<input className={inputClasses} onChange={(event) => update(recommendation.scenarioKey, { sessionPathname: event.target.value })} placeholder="/api/session" value={selection.sessionPathname} /></label>
                    </>
                  ) : null}
                  {attempted && built.errors[recommendation.scenarioKey] !== undefined ? <p className="text-xs text-rose-300 sm:col-span-2">{built.errors[recommendation.scenarioKey]}</p> : null}
                </div>
              )}
            </article>
          );
        })}
      </div>
      <div className="flex justify-end">
        <button className="rounded-lg bg-cyan-300 px-5 py-2.5 text-sm font-semibold text-slate-950 disabled:cursor-not-allowed disabled:opacity-50" disabled={pending || built.definitions.length === 0} onClick={() => { setAttempted(true); if (Object.keys(built.errors).length === 0) onSave(built.definitions); }} type="button">{pending ? "Saving focused plan…" : "Create focused plan"}</button>
      </div>
    </section>
  );
};

import type {
  AriaRole,
  CapturedFlowDraft,
  CriticalActionCandidate,
  FlowAssertion,
  FlowStep,
  LocatorSpec,
  NetworkRequestMatcher,
  NormalizedFlow,
} from "@ghostqa/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";

import {
  cancelCapture,
  getCapture,
  stopCapture,
} from "../api/capture.js";
import { createFlow, getProject } from "../api/projects.js";
import { ErrorState, LoadingState } from "../components/AsyncState.js";
import { PageHeader } from "../components/PageHeader.js";
import {
  actionLabel,
  formatDuration,
  locatorLabel,
} from "../utils/presentation.js";

const roles: readonly AriaRole[] = [
  "button",
  "checkbox",
  "combobox",
  "dialog",
  "heading",
  "link",
  "listitem",
  "navigation",
  "radio",
  "searchbox",
  "status",
  "textbox",
];

interface FlowReview {
  id: string;
  name: string;
  steps: FlowStep[];
  criticalStepId: string;
  criticalLabel: string;
  criticalRequest: NetworkRequestMatcher | undefined;
  successText: string;
  assertions: FlowAssertion[];
  assertionStepId: string;
  assertionText: string;
}

const reviewFromDraft = (draft: CapturedFlowDraft): FlowReview => ({
  id: draft.suggestedId,
  name: draft.suggestedName,
  steps: [...draft.steps],
  criticalStepId: "",
  criticalLabel: "",
  criticalRequest: undefined,
  successText: "",
  assertions: [],
  assertionStepId: draft.steps.at(-1)?.id ?? "",
  assertionText: "",
});

const reposition = (steps: readonly FlowStep[]): FlowStep[] =>
  steps.map((step, position) => ({ ...step, position }));

const targetName = (locator: LocatorSpec): string => {
  switch (locator.kind) {
    case "ROLE":
      return locator.name;
    case "LABEL":
    case "TEXT":
      return locator.text;
    case "TEST_ID":
      return locator.value;
    case "CSS":
      return locator.selector;
  }
};

const locatorInputClasses =
  "mt-2 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-200 outline-none focus:border-cyan-400/60";

const withLocator = (step: FlowStep, locator: LocatorSpec): FlowStep => {
  switch (step.action) {
    case "CLICK":
    case "FILL":
    case "SELECT_OPTION":
    case "PRESS":
    case "ASSERT_VISIBLE":
      return { ...step, locator };
    case "NAVIGATE":
    case "WAIT_FOR_URL":
      return step;
  }
};

const LocatorEditor = ({
  locator,
  onChange,
}: {
  locator: LocatorSpec;
  onChange: (locator: LocatorSpec) => void;
}) => (
  <div className="grid gap-3 sm:grid-cols-[9rem_1fr]">
    <label className="text-xs font-medium text-slate-400">
      Locator type
      <select
        className={locatorInputClasses}
        onChange={(event) => {
          const value = event.target.value as LocatorSpec["kind"];
          const current = targetName(locator);
          if (value === "ROLE") {
            onChange({ kind: "ROLE", role: "button", name: current, exact: true });
          } else if (value === "LABEL") {
            onChange({ kind: "LABEL", text: current, exact: true });
          } else if (value === "TEXT") {
            onChange({ kind: "TEXT", text: current, exact: true });
          } else if (value === "TEST_ID") {
            onChange({ kind: "TEST_ID", value: current });
          } else {
            onChange({ kind: "CSS", selector: current });
          }
        }}
        value={locator.kind}
      >
        <option value="ROLE">Role + name</option>
        <option value="LABEL">Label</option>
        <option value="TEST_ID">Test ID</option>
        <option value="TEXT">Visible text</option>
        <option value="CSS">Stable CSS</option>
      </select>
    </label>
    {locator.kind === "ROLE" ? (
      <div className="grid gap-3 sm:grid-cols-[9rem_1fr]">
        <label className="text-xs font-medium text-slate-400">
          Role
          <select
            className={locatorInputClasses}
            onChange={(event) =>
              onChange({ ...locator, role: event.target.value as AriaRole })
            }
            value={locator.role}
          >
            {roles.map((role) => (
              <option key={role} value={role}>{role}</option>
            ))}
          </select>
        </label>
        <label className="text-xs font-medium text-slate-400">
          Accessible name
          <input
            className={locatorInputClasses}
            onChange={(event) => onChange({ ...locator, name: event.target.value })}
            value={locator.name}
          />
        </label>
      </div>
    ) : (
      <label className="text-xs font-medium text-slate-400">
        {locator.kind === "LABEL"
          ? "Label text"
          : locator.kind === "TEXT"
            ? "Visible text"
            : locator.kind === "TEST_ID"
              ? "Test ID"
              : "CSS selector"}
        <input
          className={locatorInputClasses}
          onChange={(event) => {
            const value = event.target.value;
            if (locator.kind === "LABEL") onChange({ ...locator, text: value });
            if (locator.kind === "TEXT") onChange({ ...locator, text: value });
            if (locator.kind === "TEST_ID") onChange({ ...locator, value });
            if (locator.kind === "CSS") onChange({ ...locator, selector: value });
          }}
          value={targetName(locator)}
        />
      </label>
    )}
  </div>
);

const StepEditor = ({
  step,
  first,
  last,
  onChange,
  onDelete,
  onMove,
}: {
  step: FlowStep;
  first: boolean;
  last: boolean;
  onChange: (step: FlowStep) => void;
  onDelete: () => void;
  onMove: (direction: -1 | 1) => void;
}) => {
  const locator =
    step.action === "CLICK" ||
    step.action === "FILL" ||
    step.action === "SELECT_OPTION" ||
    step.action === "PRESS" ||
    step.action === "ASSERT_VISIBLE"
      ? step.locator
      : undefined;
  return (
    <li className="rounded-xl border border-slate-800 bg-slate-900/55 p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <span className="grid size-7 shrink-0 place-items-center rounded-md bg-slate-800 text-xs font-semibold text-slate-300">
            {step.position + 1}
          </span>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-white">{actionLabel(step.action)}</p>
            <p className="mt-1 break-words text-xs text-slate-500">{step.id}</p>
          </div>
        </div>
        <div className="flex gap-1">
          <button aria-label={`Move step ${step.position + 1} up`} className="rounded-md border border-slate-700 px-2 py-1 text-xs text-slate-300 disabled:opacity-30" disabled={first} onClick={() => onMove(-1)} type="button">Up</button>
          <button aria-label={`Move step ${step.position + 1} down`} className="rounded-md border border-slate-700 px-2 py-1 text-xs text-slate-300 disabled:opacity-30" disabled={last} onClick={() => onMove(1)} type="button">Down</button>
          <button className="rounded-md border border-rose-400/20 px-2 py-1 text-xs text-rose-300 hover:bg-rose-400/10" onClick={onDelete} type="button">Delete</button>
        </div>
      </div>
      <div className="mt-4 border-t border-slate-800 pt-4">
        {locator === undefined ? null : (
          <LocatorEditor
            locator={locator}
            onChange={(nextLocator) => onChange(withLocator(step, nextLocator))}
          />
        )}
        {step.action === "NAVIGATE" ? (
          <label className="text-xs font-medium text-slate-400">Path<input className={locatorInputClasses} onChange={(event) => onChange({ ...step, path: event.target.value })} value={step.path} /></label>
        ) : null}
        {step.action === "WAIT_FOR_URL" ? (
          <label className="text-xs font-medium text-slate-400">URL pattern<input className={locatorInputClasses} onChange={(event) => onChange({ ...step, url: event.target.value })} value={step.url} /></label>
        ) : null}
        {step.action === "FILL" ? (
          <label className="mt-3 block text-xs font-medium text-slate-400">
            Value {step.sensitive === true ? <span className="ml-2 rounded bg-amber-400/10 px-2 py-0.5 text-amber-300">Sensitive · masked</span> : null}
            <input autoComplete="off" className={locatorInputClasses} onChange={(event) => onChange({ ...step, value: event.target.value })} type={step.sensitive === true ? "password" : "text"} value={step.value} />
          </label>
        ) : null}
        {step.action === "SELECT_OPTION" ? (
          <label className="mt-3 block text-xs font-medium text-slate-400">Selected value<input className={locatorInputClasses} onChange={(event) => onChange({ ...step, value: event.target.value })} value={step.value} /></label>
        ) : null}
      </div>
    </li>
  );
};

const CriticalCandidateCard = ({
  candidate,
  selected,
  onSelect,
}: {
  candidate: CriticalActionCandidate;
  selected: boolean;
  onSelect: () => void;
}) => (
  <button
    className={`w-full rounded-lg border p-4 text-left ${selected ? "border-cyan-300/40 bg-cyan-300/[0.07]" : "border-slate-700 bg-slate-950/50 hover:border-slate-600"}`}
    onClick={onSelect}
    type="button"
  >
    <span className="flex flex-wrap items-center justify-between gap-2">
      <span className="font-medium text-slate-100">{candidate.label}</span>
      <span className="rounded bg-cyan-300/10 px-2 py-1 font-mono text-xs text-cyan-300">{candidate.request.method} {candidate.request.pathname}</span>
    </span>
    <span className="mt-2 block text-xs leading-5 text-slate-500">{candidate.reason}</span>
  </button>
);

export const CaptureBaselinePage = () => {
  const { projectId = "", captureId = "" } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [review, setReview] = useState<FlowReview>();
  const project = useQuery({
    queryKey: ["project", projectId],
    queryFn: () => getProject(projectId),
    enabled: projectId.length > 0,
  });
  const capture = useQuery({
    queryKey: ["capture", captureId],
    queryFn: () => getCapture(captureId),
    enabled: captureId.length > 0,
    refetchInterval: (query) =>
      query.state.data?.status === "ACTIVE" ? 1_000 : false,
  });
  useEffect(() => {
    if (review === undefined && capture.data?.draft !== undefined) {
      setReview(reviewFromDraft(capture.data.draft));
    }
  }, [capture.data?.draft, review]);

  const stopMutation = useMutation({
    mutationFn: () => stopCapture(captureId),
    onSuccess: (session) => {
      queryClient.setQueryData(["capture", captureId], session);
    },
    onError: async () => {
      await queryClient.invalidateQueries({ queryKey: ["capture", captureId] });
    },
  });
  const cancelMutation = useMutation({
    mutationFn: () => cancelCapture(captureId),
    onSuccess: () => navigate(`/projects/${projectId}`),
  });
  const saveMutation = useMutation({
    mutationFn: async (flow: NormalizedFlow) => createFlow(projectId, flow),
    onSuccess: async (flow) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["project", projectId] }),
        queryClient.invalidateQueries({ queryKey: ["project-flows", projectId] }),
      ]);
      try {
        await cancelCapture(captureId);
      } catch {
        // The saved normalized flow is independent from transient session cleanup.
      }
      navigate(`/flows/${flow.id}`);
    },
  });

  if (project.isPending || capture.isPending) {
    return <LoadingState label="Loading baseline capture…" />;
  }
  if (project.isError || capture.isError) {
    return <ErrorState error={project.error ?? capture.error} onRetry={() => { void project.refetch(); void capture.refetch(); }} />;
  }

  const session = capture.data;
  const elapsedMs = Math.max(0, Date.now() - new Date(session.startedAt).getTime());
  const updateStep = (stepId: string, next: FlowStep): void => {
    setReview((current) =>
      current === undefined
        ? current
        : {
            ...current,
            steps: current.steps.map((step) => (step.id === stepId ? next : step)),
          },
    );
  };
  const deleteStep = (stepId: string): void => {
    setReview((current) => {
      if (current === undefined) return current;
      return {
        ...current,
        steps: reposition(current.steps.filter((step) => step.id !== stepId)),
        ...(current.criticalStepId === stepId
          ? { criticalStepId: "", criticalLabel: "", criticalRequest: undefined }
          : {}),
        assertions: current.assertions.filter(
          (assertion) => assertion.afterStepId !== stepId,
        ),
        ...(current.assertionStepId === stepId
          ? {
              assertionStepId:
                current.steps.find((step) => step.id !== stepId)?.id ?? "",
            }
          : {}),
      };
    });
  };
  const moveStep = (stepId: string, direction: -1 | 1): void => {
    setReview((current) => {
      if (current === undefined) return current;
      const index = current.steps.findIndex((step) => step.id === stepId);
      const target = index + direction;
      if (index < 0 || target < 0 || target >= current.steps.length) return current;
      const steps = [...current.steps];
      const moving = steps[index];
      const displaced = steps[target];
      if (moving === undefined || displaced === undefined) return current;
      steps[index] = displaced;
      steps[target] = moving;
      return { ...current, steps: reposition(steps) };
    });
  };
  const selectCandidate = (candidate: CriticalActionCandidate): void => {
    setReview((current) =>
      current === undefined
        ? current
        : {
            ...current,
            criticalStepId: candidate.stepId,
            criticalLabel: candidate.label,
            criticalRequest: candidate.request,
          },
    );
  };
  const selectOtherCritical = (step: Extract<FlowStep, { action: "CLICK" }>): void => {
    const candidate = session.draft?.criticalActionCandidates.find(
      (item) => item.stepId === step.id,
    );
    if (candidate !== undefined) {
      selectCandidate(candidate);
      return;
    }
    setReview((current) =>
      current === undefined
        ? current
        : {
            ...current,
            criticalStepId: step.id,
            criticalLabel: targetName(step.locator),
            criticalRequest: undefined,
          },
    );
  };
  const clearCriticalAction = (): void => {
    setReview((current) =>
      current === undefined
        ? current
        : {
            ...current,
            criticalStepId: "",
            criticalLabel: "",
            criticalRequest: undefined,
          },
    );
  };
  const addAssertion = (): void => {
    setReview((current) => {
      if (
        current === undefined ||
        current.assertionStepId.length === 0 ||
        current.assertionText.trim().length === 0
      ) {
        return current;
      }
      const idBase = `assertion-${current.assertionStepId}`.slice(0, 112);
      let id = idBase;
      let suffix = 2;
      while (current.assertions.some((assertion) => assertion.id === id)) {
        id = `${idBase}-${suffix++}`;
      }
      return {
        ...current,
        assertionText: "",
        assertions: [
          ...current.assertions,
          {
            id,
            afterStepId: current.assertionStepId,
            assertion: {
              kind: "TEXT_VISIBLE",
              text: current.assertionText.trim(),
              exact: true,
            },
          },
        ],
      };
    });
  };
  const canSave =
    review !== undefined &&
    review.id.trim().length > 0 &&
    review.name.trim().length > 0 &&
    review.steps.length > 0 &&
    (review.criticalStepId.length === 0 ||
      review.criticalLabel.trim().length > 0) &&
    (review.successText.trim().length > 0 || review.assertions.length > 0);

  return (
    <div className="space-y-8">
      <div className="text-sm text-slate-500">
        <Link className="hover:text-cyan-300" to="/projects">Projects</Link>
        <span className="px-2">/</span>
        <Link className="hover:text-cyan-300" to={`/projects/${project.data.id}`}>{project.data.name}</Link>
        <span className="px-2">/</span>
        <span className="text-slate-300">Capture baseline</span>
      </div>
      <PageHeader
        description="GhostQA observes semantic DOM interactions in a controlled Chromium window. It does not record video or screen pixels."
        eyebrow="Interactive baseline capture"
        title={session.status === "READY" ? "Review captured baseline" : "Capture baseline"}
      />

      {session.status === "ACTIVE" ? (
        <section aria-live="polite" className="rounded-xl border border-cyan-300/25 bg-cyan-300/[0.045] p-5 sm:p-6">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="flex items-center gap-2 font-semibold text-cyan-200"><span className="size-2.5 animate-pulse rounded-full bg-cyan-300" />Capture active</p>
              <p className="mt-3 break-all font-mono text-sm text-slate-300">{session.targetUrl}</p>
              <p className="mt-2 text-sm text-slate-400">Capture browser opened in a separate Chromium window.</p>
              <p className="mt-1 text-sm text-slate-500">Elapsed {formatDuration(elapsedMs)} · Complete the journey in that window, keep it open, then return here and press Stop capture. If you do not see it, check the taskbar.</p>
            </div>
            <div className="flex shrink-0 gap-2">
              <button className="rounded-lg border border-slate-700 px-4 py-2.5 text-sm font-medium text-slate-200 disabled:opacity-50" disabled={stopMutation.isPending || cancelMutation.isPending} onClick={() => cancelMutation.mutate()} type="button">Cancel</button>
              <button className="rounded-lg bg-cyan-300 px-4 py-2.5 text-sm font-semibold text-slate-950 disabled:opacity-50" disabled={stopMutation.isPending || cancelMutation.isPending} onClick={() => stopMutation.mutate()} type="button">{stopMutation.isPending ? "Stopping…" : "Stop capture"}</button>
            </div>
          </div>
        </section>
      ) : null}

      {session.status === "ERROR" ? (
        <section className="rounded-xl border border-rose-400/20 bg-rose-400/[0.06] p-5" role="alert">
          <h2 className="font-semibold text-rose-200">Capture failed</h2>
          <p className="mt-2 text-sm leading-6 text-rose-100/70">{session.errorMessage ?? "The capture browser stopped unexpectedly."}</p>
          {session.diagnostics === undefined ? null : (
            <p className="mt-3 text-xs leading-5 text-slate-500">
              Safe diagnostics retained: {session.diagnostics.events.length} events · stage {session.diagnostics.stage.toLowerCase().replaceAll("_", " ")}. Input values are not included.
            </p>
          )}
          <Link className="mt-4 inline-block text-sm font-medium text-cyan-300" to={`/projects/${projectId}`}>Return to project</Link>
        </section>
      ) : null}
      {session.status === "CANCELLED" ? (
        <section className="rounded-xl border border-slate-800 bg-slate-900/50 p-5">
          <h2 className="font-semibold text-white">Capture cancelled</h2>
          <Link className="mt-3 inline-block text-sm font-medium text-cyan-300" to={`/projects/${projectId}`}>Return to project</Link>
        </section>
      ) : null}
      {stopMutation.isError && session.status !== "ERROR" ? <ErrorState error={stopMutation.error} title="Capture could not be stopped" /> : null}
      {cancelMutation.isError ? <ErrorState error={cancelMutation.error} title="Capture could not be cancelled" /> : null}

      {session.status === "READY" && session.draft !== undefined && review !== undefined ? (
        <>
          <section className="grid gap-4 lg:grid-cols-2">
            <label className="text-sm font-medium text-slate-300">Flow name<input className={locatorInputClasses} onChange={(event) => setReview({ ...review, name: event.target.value })} value={review.name} /></label>
            <label className="text-sm font-medium text-slate-300">Flow ID<input className={locatorInputClasses} onChange={(event) => setReview({ ...review, id: event.target.value })} value={review.id} /></label>
          </section>

          <section className="space-y-4" aria-labelledby="captured-steps-heading">
            <div><h2 className="text-lg font-semibold text-white" id="captured-steps-heading">Captured steps</h2><p className="mt-1 text-sm text-slate-500">Delete accidental actions, adjust locators or values, and reorder only when the intended journey requires it.</p></div>
            <ol className="space-y-3">
              {review.steps.map((step, index) => (
                <StepEditor first={index === 0} key={step.id} last={index === review.steps.length - 1} onChange={(next) => updateStep(step.id, next)} onDelete={() => deleteStep(step.id)} onMove={(direction) => moveStep(step.id, direction)} step={step} />
              ))}
            </ol>
          </section>

          <section className="rounded-xl border border-slate-800 bg-slate-900/55 p-5" aria-labelledby="flow-assertions-heading">
            <h2 className="text-lg font-semibold text-white" id="flow-assertions-heading">Flow assertions</h2>
            <p className="mt-1 text-sm leading-6 text-slate-500">Add a user-confirmed expected state after any captured step. GhostQA evaluates it there before continuing.</p>
            <div className="mt-4 grid gap-3 md:grid-cols-[1fr_1fr_auto] md:items-end">
              <label className="text-sm font-medium text-slate-300">
                After step
                <select className={locatorInputClasses} onChange={(event) => setReview({ ...review, assertionStepId: event.target.value })} value={review.assertionStepId}>
                  {review.steps.map((step) => <option key={step.id} value={step.id}>{step.position + 1}. {actionLabel(step.action)}</option>)}
                </select>
              </label>
              <label className="text-sm font-medium text-slate-300">
                Checkpoint visible text
                <input className={locatorInputClasses} onChange={(event) => setReview({ ...review, assertionText: event.target.value })} placeholder="Visible expected state" value={review.assertionText} />
              </label>
              <button className="rounded-lg border border-cyan-300/30 px-4 py-2.5 text-sm font-medium text-cyan-200 disabled:opacity-40" disabled={review.assertionStepId.length === 0 || review.assertionText.trim().length === 0} onClick={addAssertion} type="button">Add assertion</button>
            </div>
            {review.assertions.length === 0 ? (
              <p className="mt-4 text-sm text-slate-500">No step-bound assertions yet.</p>
            ) : (
              <ul className="mt-4 space-y-2">
                {review.assertions.map((flowAssertion) => {
                  const step = review.steps.find(({ id }) => id === flowAssertion.afterStepId);
                  return (
                    <li className="flex flex-col gap-2 rounded-lg border border-slate-800 bg-slate-950/50 p-3 sm:flex-row sm:items-center" key={flowAssertion.id}>
                      <span className="shrink-0 text-xs text-slate-500">After step {step === undefined ? "?" : step.position + 1}</span>
                      <input aria-label={`Assertion ${flowAssertion.id}`} className="min-w-0 flex-1 rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-200" onChange={(event) => setReview({ ...review, assertions: review.assertions.map((candidate) => candidate.id === flowAssertion.id && candidate.assertion.kind === "TEXT_VISIBLE" ? { ...candidate, assertion: { ...candidate.assertion, text: event.target.value } } : candidate) })} value={flowAssertion.assertion.kind === "TEXT_VISIBLE" ? flowAssertion.assertion.text : ""} />
                      <button className="text-xs font-medium text-rose-300" onClick={() => setReview({ ...review, assertions: review.assertions.filter(({ id }) => id !== flowAssertion.id) })} type="button">Remove</button>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          <section className="grid gap-5 xl:grid-cols-2">
            <article className="rounded-xl border border-slate-800 bg-slate-900/55 p-5">
              <h2 className="text-lg font-semibold text-white">Critical action (optional)</h2>
              <p className="mt-1 text-sm leading-6 text-slate-500">Choose a user-confirmed business mutation only when one exists. Read-only and navigation flows can leave this empty.</p>
              {session.draft.criticalActionCandidates.length === 0 ? <p className="mt-4 rounded-lg border border-amber-400/20 bg-amber-400/[0.05] p-3 text-sm text-amber-200">No nearby POST, PUT, PATCH, or DELETE request was observed. Leave this unset unless a captured click is intentionally critical.</p> : <div className="mt-4 space-y-2">{session.draft.criticalActionCandidates.map((candidate) => <CriticalCandidateCard candidate={candidate} key={`${candidate.stepId}-${candidate.request.method}-${candidate.request.pathname}`} onSelect={() => selectCandidate(candidate)} selected={review.criticalStepId === candidate.stepId && review.criticalRequest?.pathname === candidate.request.pathname} />)}</div>}
              <label className="mt-5 block text-sm font-medium text-slate-300">Critical click<select className={locatorInputClasses} onChange={(event) => { if (event.target.value.length === 0) { clearCriticalAction(); return; } const step = review.steps.find((item): item is Extract<FlowStep, { action: "CLICK" }> => item.id === event.target.value && item.action === "CLICK"); if (step !== undefined) selectOtherCritical(step); }} value={review.criticalStepId}><option value="">No critical action</option>{review.steps.filter((step): step is Extract<FlowStep, { action: "CLICK" }> => step.action === "CLICK").map((step) => <option key={step.id} value={step.id}>{step.position + 1}. {locatorLabel(step.locator)}</option>)}</select></label>
              <label className="mt-4 block text-sm font-medium text-slate-300">Critical action label<input className={locatorInputClasses} disabled={review.criticalStepId.length === 0} onChange={(event) => setReview({ ...review, criticalLabel: event.target.value })} value={review.criticalLabel} /></label>
              {review.criticalRequest === undefined ? null : <p className="mt-4 rounded-lg bg-slate-950 p-3 font-mono text-sm text-slate-300"><span className="text-cyan-300">{review.criticalRequest.method}</span> {review.criticalRequest.pathname}</p>}
            </article>

            <article className="rounded-xl border border-slate-800 bg-slate-900/55 p-5">
              <h2 className="text-lg font-semibold text-white">Final assertion (optional)</h2>
              <p className="mt-1 text-sm leading-6 text-slate-500">Keep the backward-compatible end-of-flow check, or use step-bound assertions above. GhostQA never chooses business success for you.</p>
              <label className="mt-5 block text-sm font-medium text-slate-300">Expected visible text<input className={locatorInputClasses} list={`success-text-${captureId}`} onChange={(event) => setReview({ ...review, successText: event.target.value })} placeholder="Success confirmation text" value={review.successText} /></label>
              <datalist id={`success-text-${captureId}`}>{session.draft.successTextCandidates.map((candidate) => <option key={candidate} value={candidate} />)}</datalist>
              {session.draft.successTextCandidates.length === 0 ? null : <div className="mt-3 flex flex-wrap gap-2" aria-label="Suggested visible text">{session.draft.successTextCandidates.map((candidate) => <button className="rounded-full border border-slate-700 bg-slate-950 px-3 py-1.5 text-left text-xs text-slate-300 hover:border-cyan-300/40 hover:text-cyan-200" key={candidate} onClick={() => setReview({ ...review, successText: candidate })} type="button">{candidate}</button>)}</div>}
              <p className="mt-4 text-xs leading-5 text-slate-500">Assertion type: <code className="text-slate-300">TEXT_VISIBLE</code>. Suggestions come from visible final-page headings and status text; you must confirm the value.</p>
            </article>
          </section>

          <section className="flex flex-col-reverse gap-3 border-t border-slate-800 pt-6 sm:flex-row sm:justify-end">
            <button className="rounded-lg border border-slate-700 px-5 py-2.5 text-sm font-medium text-slate-200 disabled:opacity-50" disabled={cancelMutation.isPending || saveMutation.isPending} onClick={() => cancelMutation.mutate()} type="button">Discard capture</button>
            <button className="rounded-lg bg-cyan-300 px-5 py-2.5 text-sm font-semibold text-slate-950 disabled:cursor-not-allowed disabled:opacity-50" disabled={!canSave || saveMutation.isPending || cancelMutation.isPending} onClick={() => { if (!canSave || review === undefined) return; const flow: NormalizedFlow = { id: review.id.trim(), name: review.name.trim(), steps: reposition(review.steps), ...(review.criticalStepId.length === 0 ? {} : { criticalAction: { stepId: review.criticalStepId, label: review.criticalLabel.trim(), ...(review.criticalRequest === undefined ? {} : { request: review.criticalRequest }) } }), ...(review.successText.trim().length === 0 ? {} : { successAssertion: { kind: "TEXT_VISIBLE" as const, text: review.successText.trim(), exact: true } }), ...(review.assertions.length === 0 ? {} : { assertions: review.assertions }) }; saveMutation.mutate(flow); }} type="button">{saveMutation.isPending ? "Saving baseline…" : "Save baseline"}</button>
          </section>
          {saveMutation.isError ? <ErrorState error={saveMutation.error} title="Baseline could not be saved" /> : null}
        </>
      ) : null}
    </div>
  );
};

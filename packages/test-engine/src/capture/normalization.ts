import type {
  CapturedFlowDraft,
  CaptureNetworkObservation,
  CriticalActionCandidate,
  FlowStep,
  LocatorSpec,
} from "@ghostqa/shared";

import {
  CaptureNormalizationError,
  capturedActionLabel,
  selectStableLocator,
} from "./locators.js";
import type {
  NormalizeCaptureInput,
  RawCaptureEvent,
  RawCaptureNetworkObservation,
} from "./types.js";

const MUTATION_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);
const ASSOCIATION_WINDOW_MS = 2_000;
// Browser-event bindings and Playwright request callbacks cross process queues.
// Keep a very small lead allowance for a request observed just before its click.
const REQUEST_LEAD_TOLERANCE_MS = 100;

const slug = (value: string): string =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80) || "step";

const locatorIdentity = (locator: LocatorSpec): string => JSON.stringify(locator);

const relativeNavigationPath = (rawUrl: string, baseUrl: string): string => {
  const url = new URL(rawUrl);
  const base = new URL(baseUrl);
  return url.origin === base.origin
    ? `${url.pathname}${url.search}${url.hash}`
    : url.href;
};

const GENERATED_PATH_SEGMENT = /^(?:\d+|[a-z]+[-_]\d+|[0-9a-f]{16,}|[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12})$/i;

const navigationPattern = (rawUrl: string): string => {
  const url = new URL(rawUrl);
  const pathname = url.pathname
    .split("/")
    .map((segment) =>
      GENERATED_PATH_SEGMENT.test(segment) ? "*" : segment,
    )
    .join("/");
  return `**${pathname}${url.search}${url.hash}`;
};

const uniqueStepId = (
  action: string,
  label: string,
  counts: Map<string, number>,
): string => {
  const base = slug(action.length === 0 ? label : `${action}-${label}`);
  const count = (counts.get(base) ?? 0) + 1;
  counts.set(base, count);
  return count === 1 ? base : `${base}-${count}`;
};

interface NormalizedAction {
  raw: RawCaptureEvent;
  step: FlowStep;
  label: string;
}

const normalizeActions = (
  input: NormalizeCaptureInput,
): { steps: FlowStep[]; actions: NormalizedAction[] } => {
  const ordered = [...input.events].sort(
    (left, right) =>
      left.timestampMs - right.timestampMs || left.order - right.order,
  );
  const steps: FlowStep[] = [
    {
      id: "navigate-start",
      position: 0,
      action: "NAVIGATE",
      path: relativeNavigationPath(input.baseUrl, input.baseUrl),
    },
  ];
  const actions: NormalizedAction[] = [];
  const counts = new Map<string, number>();
  let currentUrl = new URL(input.baseUrl).href;

  const appendNavigationBoundary = (rawUrl: string): void => {
    const nextUrl = new URL(rawUrl).href;
    if (nextUrl === currentUrl) return;
    currentUrl = nextUrl;
    const previous = steps.at(-1);
    if (
      previous !== undefined &&
      previous.action !== "NAVIGATE" &&
      previous.action !== "WAIT_FOR_URL"
    ) {
      steps.push({
        id: uniqueStepId("wait", new URL(nextUrl).pathname, counts),
        position: steps.length,
        action: "WAIT_FOR_URL",
        url: navigationPattern(nextUrl),
      });
    }
  };

  for (const event of ordered) {
    if (event.kind === "NAVIGATION") {
      continue;
    }

    appendNavigationBoundary(event.pageUrl);

    let locator: LocatorSpec;
    try {
      locator = selectStableLocator(event.locator);
    } catch (error) {
      if (!(error instanceof CaptureNormalizationError)) throw error;
      const pathname = new URL(event.pageUrl).pathname;
      throw new CaptureNormalizationError(
        `Captured ${event.kind.toLowerCase()} event ${event.order} on ${pathname} had no stable unique locator.`,
        event.order,
        event.kind,
      );
    }
    const label = capturedActionLabel(event.kind, locator);
    const prior = actions.at(-1);
    if (
      event.kind === "FILL" &&
      prior?.step.action === "FILL" &&
      steps.at(-1)?.id === prior.step.id &&
      locatorIdentity(prior.step.locator) === locatorIdentity(locator)
    ) {
      const replacement: FlowStep = {
        ...prior.step,
        value: event.value,
        ...(event.sensitive ? { sensitive: true } : {}),
      };
      steps[prior.step.position] = replacement;
      prior.raw = event;
      prior.step = replacement;
      continue;
    }

    const id = uniqueStepId("", label, counts);
    const position = steps.length;
    const step: FlowStep =
      event.kind === "CLICK"
        ? { id, position, action: "CLICK", locator }
        : event.kind === "FILL"
          ? {
              id,
              position,
              action: "FILL",
              locator,
              value: event.value,
              ...(event.sensitive ? { sensitive: true } : {}),
            }
          : {
              id,
              position,
              action: "SELECT_OPTION",
              locator,
              value: event.value,
            };
    steps.push(step);
    actions.push({ raw: event, step, label });
  }

  appendNavigationBoundary(input.finalUrl);

  return { steps, actions };
};

const associateNetwork = (
  network: readonly RawCaptureNetworkObservation[],
  actions: readonly NormalizedAction[],
): {
  observations: CaptureNetworkObservation[];
  candidates: CriticalActionCandidate[];
} => {
  const observations: CaptureNetworkObservation[] = [];
  const ranked = new Map<
    string,
    {
      candidate: CriticalActionCandidate;
      distanceMs: number;
      stepPosition: number;
    }
  >();

  for (const request of network) {
    const action = [...actions]
      .reverse()
      .find(
        (candidate) =>
          candidate.step.action === "CLICK" &&
          candidate.raw.timestampMs <=
            request.timestampMs + REQUEST_LEAD_TOLERANCE_MS &&
          request.timestampMs - candidate.raw.timestampMs <=
            ASSOCIATION_WINDOW_MS,
      );
    observations.push({
      method: request.method,
      pathname: request.pathname,
      ...(request.status === undefined ? {} : { status: request.status }),
      timestamp: new Date(request.timestampMs).toISOString(),
      ...(action === undefined ? {} : { actionStepId: action.step.id }),
    });

    if (action === undefined || !MUTATION_METHODS.has(request.method)) continue;
    const key = `${action.step.id}\u0000${request.method}\u0000${request.pathname}`;
    const distanceMs = Math.abs(request.timestampMs - action.raw.timestampMs);
    const candidate: CriticalActionCandidate = {
      stepId: action.step.id,
      label: action.label.replace(/^Click\s+/, ""),
      request: { method: request.method, pathname: request.pathname },
      reason: "A mutation request occurred immediately after this action.",
    };
    const existing = ranked.get(key);
    if (existing === undefined || distanceMs < existing.distanceMs) {
      ranked.set(key, {
        candidate,
        distanceMs,
        stepPosition: action.step.position,
      });
    }
  }

  return {
    observations,
    candidates: [...ranked.values()]
      .sort(
        (left, right) =>
          right.stepPosition - left.stepPosition ||
          left.distanceMs - right.distanceMs,
      )
      .map(({ candidate }) => candidate),
  };
};

export const normalizeCapturedInteractions = (
  input: NormalizeCaptureInput,
): CapturedFlowDraft => {
  const { steps, actions } = normalizeActions(input);
  if (actions.length === 0) {
    throw new Error("Capture ended without any meaningful user interactions.");
  }
  const { observations, candidates } = associateNetwork(input.network, actions);
  return {
    suggestedId: input.suggestedFlowId,
    suggestedName: input.suggestedFlowName,
    steps,
    criticalActionCandidates: candidates,
    successTextCandidates: [...new Set(input.successTextCandidates)].slice(0, 20),
    finalUrl: input.finalUrl,
    network: observations,
  };
};

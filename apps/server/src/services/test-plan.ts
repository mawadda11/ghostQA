import type {
  ElementObservation,
  FlowStep,
  LocatorSpec,
  NormalizedFlow,
  SuccessAssertion,
  TestPlanObservationOption,
  TestPlanRecommendation,
  TestPlanRecommendations,
} from "@ghostqa/shared";
import type { PrismaClient } from "@prisma/client";

import { getFlowExecutionRecord, toNormalizedFlow } from "./flows.js";

const locatorForStep = (step: FlowStep): LocatorSpec | undefined => {
  switch (step.action) {
    case "CLICK":
    case "FILL":
    case "SELECT_OPTION":
    case "PRESS":
    case "ASSERT_VISIBLE":
      return step.locator;
    case "NAVIGATE":
    case "WAIT_FOR_URL":
      return undefined;
  }
};

const locatorLabel = (locator: LocatorSpec): string => {
  switch (locator.kind) {
    case "ROLE":
      return `${locator.role}: ${locator.name}`;
    case "LABEL":
      return `label: ${locator.text}`;
    case "TEXT":
      return `text: ${locator.text}`;
    case "TEST_ID":
      return `test id: ${locator.value}`;
    case "CSS":
      return `element: ${locator.selector}`;
  }
};

const stepLabel = (step: FlowStep): string => {
  const locator = locatorForStep(step);
  if (locator !== undefined) return `${step.position + 1}. ${step.action} — ${locatorLabel(locator)}`;
  switch (step.action) {
    case "NAVIGATE":
      return `${step.position + 1}. ${step.action} — ${step.path}`;
    case "WAIT_FOR_URL":
      return `${step.position + 1}. ${step.action} — ${step.url}`;
    default:
      return `${step.position + 1}. ${step.action}`;
  }
};

const assertionObservation = (
  assertion: SuccessAssertion,
): ElementObservation | undefined => {
  if (assertion.kind === "URL_MATCHES") return undefined;
  if (assertion.kind === "ELEMENT_VISIBLE") {
    return { locator: assertion.locator, state: "VISIBLE" };
  }
  return {
    locator:
      assertion.locator ??
      {
        kind: "TEXT",
        text: assertion.text,
        ...(assertion.exact === undefined ? {} : { exact: assertion.exact }),
      },
    state: "VISIBLE",
  };
};

const observationOptions = (
  flow: NormalizedFlow,
): TestPlanObservationOption[] => {
  const options: TestPlanObservationOption[] = [];
  const seen = new Set<string>();
  const push = (option: TestPlanObservationOption): void => {
    const key = JSON.stringify(option.observation.locator);
    if (seen.has(key)) return;
    seen.add(key);
    options.push(option);
  };

  for (const assertion of flow.assertions ?? []) {
    const observation = assertionObservation(assertion.assertion);
    if (observation !== undefined) {
      push({
        id: `assertion:${assertion.id}`,
        afterStepId: assertion.afterStepId,
        label: `Assertion — ${locatorLabel(observation.locator)}`,
        observation,
      });
    }
  }

  if (flow.successAssertion !== undefined) {
    const observation = assertionObservation(flow.successAssertion);
    const finalStep = flow.steps[flow.steps.length - 1];
    if (observation !== undefined && finalStep !== undefined) {
      push({
        id: "assertion:final",
        afterStepId: finalStep.id,
        label: `Final assertion — ${locatorLabel(observation.locator)}`,
        observation,
      });
    }
  }

  for (const step of flow.steps) {
    const locator = locatorForStep(step);
    if (locator !== undefined) {
      push({
        id: `step:${step.id}`,
        afterStepId: step.id,
        label: `Captured element — ${locatorLabel(locator)}`,
        observation: { locator, state: "VISIBLE" },
      });
    }
  }
  return options;
};

const requestBacked = (
  flow: NormalizedFlow,
): {
  request?: { method: string; pathname: string };
  checkpoint?: FlowStep;
} => {
  const critical = flow.criticalAction;
  if (critical === undefined) return {};
  const criticalIndex = flow.steps.findIndex(({ id }) => id === critical.stepId);
  return {
    ...(critical.request === undefined ? {} : { request: critical.request }),
    ...(criticalIndex <= 0 ? {} : { checkpoint: flow.steps[criticalIndex - 1] }),
  };
};

const expectedUrlFor = (step: FlowStep | undefined): string | undefined =>
  step?.action === "WAIT_FOR_URL" ? step.url : undefined;

const observationIdFor = (
  observations: readonly TestPlanObservationOption[],
  observation: ElementObservation,
): string | undefined =>
  observations.find(
    (option) =>
      JSON.stringify(option.observation.locator) ===
      JSON.stringify(observation.locator),
  )?.id;

const safeRefreshDefaults = (
  flow: NormalizedFlow,
  observations: readonly TestPlanObservationOption[],
  mutationCheckpoint: FlowStep | undefined,
): { checkpointStepId: string; observationId: string; expectedUrl?: string } | undefined => {
  const defaultsFor = (
    checkpoint: FlowStep,
    observationId: string,
  ): { checkpointStepId: string; observationId: string; expectedUrl?: string } => {
    const expectedUrl = expectedUrlFor(checkpoint);
    return {
      checkpointStepId: checkpoint.id,
      observationId,
      ...(expectedUrl === undefined ? {} : { expectedUrl }),
    };
  };
  const criticalStep = flow.steps.find(
    ({ id }) => id === flow.criticalAction?.stepId,
  );
  const criticalLocator =
    criticalStep === undefined ? undefined : locatorForStep(criticalStep);
  if (mutationCheckpoint !== undefined && criticalLocator !== undefined) {
    const observationId = observationIdFor(observations, {
      locator: criticalLocator,
      state: "VISIBLE",
    });
    if (observationId !== undefined) {
      return defaultsFor(mutationCheckpoint, observationId);
    }
  }

  const assertion = [...(flow.assertions ?? [])].reverse().find((candidate) =>
    assertionObservation(candidate.assertion) !== undefined,
  );
  if (assertion !== undefined) {
    const observation = assertionObservation(assertion.assertion);
    const checkpoint = flow.steps.find(({ id }) => id === assertion.afterStepId);
    if (observation !== undefined && checkpoint !== undefined) {
      const observationId = observationIdFor(observations, observation);
      if (observationId !== undefined) {
        return defaultsFor(checkpoint, observationId);
      }
    }
  }

  const finalStep = flow.steps.at(-1);
  const finalObservation =
    flow.successAssertion === undefined
      ? undefined
      : assertionObservation(flow.successAssertion);
  const finalObservationId =
    finalObservation === undefined
      ? undefined
      : observationIdFor(observations, finalObservation);
  return finalStep === undefined || finalObservationId === undefined
    ? undefined
    : defaultsFor(finalStep, finalObservationId);
};

const safeBackDefaults = (
  flow: NormalizedFlow,
  observations: readonly TestPlanObservationOption[],
): { checkpointStepId: string; observationId: string } | undefined => {
  const waitIndex = flow.steps
    .map(({ action }) => action)
    .lastIndexOf("WAIT_FOR_URL");
  if (waitIndex < 1) return undefined;
  const checkpoint = flow.steps[waitIndex];
  if (checkpoint === undefined) return undefined;
  const indexedAssertions = (flow.assertions ?? []).flatMap((assertion) => {
    const observation = assertionObservation(assertion.assertion);
    const stepIndex = flow.steps.findIndex(({ id }) => id === assertion.afterStepId);
    return observation === undefined || stepIndex < 0
      ? []
      : [{ observation, stepIndex }];
  });
  const shared = indexedAssertions.find(
    (before) =>
      before.stepIndex < waitIndex &&
      indexedAssertions.some(
        (after) =>
          after.stepIndex >= waitIndex &&
          JSON.stringify(after.observation.locator) ===
            JSON.stringify(before.observation.locator),
      ),
  );
  if (shared === undefined) return undefined;
  const observationId = observationIdFor(observations, shared.observation);
  return observationId === undefined
    ? undefined
    : { checkpointStepId: checkpoint.id, observationId };
};

export const recommendTestPlan = (flow: NormalizedFlow): TestPlanRecommendations => {
  const observations = observationOptions(flow);
  const { request, checkpoint } = requestBacked(flow);
  const hasMutation = flow.criticalAction !== undefined && request !== undefined;
  const waitSteps = flow.steps.filter(
    (step): step is Extract<FlowStep, { action: "WAIT_FOR_URL" }> =>
      step.action === "WAIT_FOR_URL",
  );
  const refreshDefaults = safeRefreshDefaults(flow, observations, checkpoint);
  const backDefaults = safeBackDefaults(flow, observations);
  const common = {
    ...(checkpoint === undefined ? {} : { defaultCheckpointStepId: checkpoint.id }),
    ...(request === undefined ? {} : { request }),
  };
  const recommendations: TestPlanRecommendation[] = [
    {
      scenarioKey: "double-action",
      name: "Double Action",
      family: "DOUBLE_ACTION",
      recommendation: hasMutation ? "RECOMMENDED" : "NOT_APPLICABLE",
      configuration: hasMutation ? "READY" : "NOT_APPLICABLE",
      defaultSelected: hasMutation,
      reason: hasMutation
        ? "Selected because this captured action triggered a state-changing request."
        : "This flow has no user-selected critical click with mutation metadata.",
      ...common,
    },
    {
      scenarioKey: "api-failure",
      name: "API Failure",
      family: "API_FAILURE",
      recommendation:
        hasMutation && checkpoint !== undefined ? "RECOMMENDED" : "NOT_APPLICABLE",
      configuration:
        hasMutation && checkpoint !== undefined ? "READY" : "NOT_APPLICABLE",
      defaultSelected: hasMutation && checkpoint !== undefined,
      reason:
        hasMutation && checkpoint !== undefined
          ? "Selected because the observed request can be deterministically failed and recovery can be observed generically."
          : "API Failure needs a critical action, mutation request, and preceding checkpoint.",
      ...common,
    },
    {
      scenarioKey: "slow-response",
      name: "Slow Response",
      family: "SLOW_RESPONSE",
      recommendation: hasMutation ? "RECOMMENDED" : "NOT_APPLICABLE",
      configuration:
        hasMutation && checkpoint !== undefined ? "READY" : "NOT_APPLICABLE",
      defaultSelected: hasMutation && checkpoint !== undefined,
      reason:
        hasMutation && checkpoint !== undefined
          ? "Selected because the observed request can be delayed after a stable checkpoint."
          : "Slow Response needs a critical action, mutation request, and preceding checkpoint.",
      ...common,
    },
    {
      scenarioKey: "refresh",
      name: "Refresh",
      family: "REFRESH_BACK_NAVIGATION",
      mode: "REFRESH",
      recommendation: refreshDefaults === undefined ? "AVAILABLE" : "RECOMMENDED",
      configuration:
        refreshDefaults === undefined ? "NEEDS_CONFIGURATION" : "READY",
      defaultSelected: refreshDefaults !== undefined,
      reason:
        refreshDefaults === undefined
          ? "A safe captured state could not be inferred; configure this test explicitly if needed."
          : "Selected because the journey contains a stable captured state that can be compared after reload.",
      ...(refreshDefaults === undefined
        ? {}
        : {
            defaultCheckpointStepId: refreshDefaults.checkpointStepId,
            defaultObservationId: refreshDefaults.observationId,
            ...(refreshDefaults.expectedUrl === undefined
              ? {}
              : { defaultExpectedUrl: refreshDefaults.expectedUrl }),
          }),
    },
    {
      scenarioKey: "back",
      name: "Back Navigation",
      family: "REFRESH_BACK_NAVIGATION",
      mode: "BACK",
      recommendation:
        backDefaults !== undefined
          ? "RECOMMENDED"
          : waitSteps.length > 0
            ? "AVAILABLE"
            : "NOT_APPLICABLE",
      configuration:
        backDefaults !== undefined
          ? "READY"
          : waitSteps.length > 0
            ? "NEEDS_CONFIGURATION"
            : "NOT_APPLICABLE",
      defaultSelected: backDefaults !== undefined,
      reason:
        backDefaults !== undefined
          ? "Selected because the baseline proves the same semantic state before and after a captured navigation transition."
          : waitSteps.length > 0
          ? "The flow contains a navigation transition; confirm the expected state after going back."
          : "No captured URL transition provides a deterministic back-navigation checkpoint.",
      ...(backDefaults === undefined
        ? {}
        : {
            defaultCheckpointStepId: backDefaults.checkpointStepId,
            defaultObservationId: backDefaults.observationId,
          }),
    },
    {
      scenarioKey: "session-expiry",
      name: "Session Expiry",
      family: "SESSION_EXPIRY",
      recommendation: "AVAILABLE",
      configuration: "NEEDS_CONFIGURATION",
      defaultSelected: false,
      reason:
        "GhostQA does not infer authentication. Enable this only with an explicit session request or storage key and expected state.",
    },
  ];

  return {
    flowId: flow.id,
    mode: "FOCUSED",
    steps: flow.steps.map((step) => ({
      id: step.id,
      position: step.position,
      action: step.action,
      label: stepLabel(step),
    })),
    observations,
    recommendations,
  };
};

export const getTestPlanRecommendations = async (
  prisma: PrismaClient,
  flowId: string,
): Promise<TestPlanRecommendations> =>
  recommendTestPlan(toNormalizedFlow(await getFlowExecutionRecord(prisma, flowId)));

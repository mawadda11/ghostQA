import type { FailureOrigin, ResultStatus } from "@ghostqa/shared";

type ScenarioStatus = Exclude<ResultStatus, "ERROR">;

export interface ScenarioClassification {
  status: ScenarioStatus;
  summary: string;
  failureOrigin?: Extract<FailureOrigin, "TARGET_APP_FAILURE">;
}

const targetFailure = (summary: string): ScenarioClassification => ({
  status: "FAIL",
  failureOrigin: "TARGET_APP_FAILURE",
  summary,
});

const needsReview = (summary: string): ScenarioClassification => ({
  status: "NEEDS_REVIEW",
  summary,
});

const pass = (summary: string): ScenarioClassification => ({
  status: "PASS",
  summary,
});

export const classifyDoubleAction = (input: {
  successfulMutationCount: number;
  distinctIdentifierCount: number;
  assertionPassed: boolean;
}): ScenarioClassification => {
  if (
    input.successfulMutationCount >= 2 &&
    input.distinctIdentifierCount >= 2
  ) {
    return targetFailure(
      "Duplicate mutation detected: two successful requests produced distinct identifiers.",
    );
  }

  if (input.successfulMutationCount >= 2) {
    return needsReview(
      "Multiple successful mutation requests were observed, but uniqueness could not be confirmed.",
    );
  }

  if (input.successfulMutationCount === 1 && input.assertionPassed) {
    return pass("Only one successful mutation completed and the success assertion passed.");
  }

  return needsReview("The double action outcome could not be determined safely.");
};

export const classifyApiFailure = (input: {
  injectedFailureObserved: boolean;
  brokenStateMatched?: boolean;
  recoveryStateMatched?: boolean;
  assertionPassed: boolean;
  automaticObservation?: {
    controlStuck: boolean;
    controlRecovered: boolean;
    statusVisible: boolean;
    pageErrorCount: number;
  };
}): ScenarioClassification => {
  if (!input.injectedFailureObserved) {
    return needsReview("The configured HTTP failure was not observed.");
  }

  if (input.assertionPassed) {
    return targetFailure(
      "The application reported success after the injected HTTP failure.",
    );
  }

  if (input.brokenStateMatched === true) {
    return targetFailure(
      "The configured broken state was confirmed after the injected HTTP failure.",
    );
  }

  if (input.recoveryStateMatched === true) {
    return pass("The configured recovery state appeared after the HTTP failure.");
  }

  if (input.automaticObservation?.controlStuck === true) {
    return targetFailure(
      "The critical control remained stuck after the injected HTTP failure.",
    );
  }

  if (
    input.automaticObservation?.controlRecovered === true &&
    input.automaticObservation.statusVisible &&
    input.automaticObservation.pageErrorCount === 0
  ) {
    return pass(
      "The application exposed a status state and restored the critical control after the HTTP failure.",
    );
  }

  return needsReview(
    "Automatic recovery evidence after the injected HTTP failure was inconclusive.",
  );
};

export const classifySlowResponse = (input: {
  successfulMutationCount: number;
  assertionPassed: boolean;
  repeatabilityMatched: boolean;
  preventionMatched: boolean;
  safePendingState?: boolean;
  stuckAfterCompletion?: boolean;
  pageErrorCount?: number;
}): ScenarioClassification => {
  if (input.successfulMutationCount >= 2) {
    return targetFailure(
      "Multiple successful mutations completed during the delayed response.",
    );
  }

  if (input.stuckAfterCompletion === true) {
    return targetFailure(
      "The critical control remained stuck after the delayed request completed.",
    );
  }

  if (
    input.successfulMutationCount === 1 &&
    input.assertionPassed &&
    (input.preventionMatched || input.safePendingState === true) &&
    (input.pageErrorCount ?? 0) === 0
  ) {
    return pass(
      "The control showed a protected pending state and the journey completed after the delay.",
    );
  }

  if (input.repeatabilityMatched) {
    return needsReview(
      "The critical action remained repeatable during the delay; no duplicate mutation was triggered automatically.",
    );
  }

  return needsReview("Behavior during the delayed response was inconclusive.");
};

export const classifyNavigation = (input: {
  stateMatched: boolean;
  urlMatched: boolean;
  mutationCount: number;
  mode: "REFRESH" | "BACK";
}): ScenarioClassification => {
  if (input.mutationCount > 0) {
    return targetFailure(
      `${input.mode === "REFRESH" ? "Refresh" : "Back navigation"} triggered an unexpected mutation.`,
    );
  }

  if (!input.stateMatched || !input.urlMatched) {
    return targetFailure(
      `${input.mode === "REFRESH" ? "Refresh" : "Back navigation"} did not preserve the configured expected state.`,
    );
  }

  return pass(
    `${input.mode === "REFRESH" ? "Refresh" : "Back navigation"} preserved the configured expected state.`,
  );
};

export const classifySessionExpiry = (input: {
  invalidationObserved: boolean;
  unauthorizedObserved: boolean;
  brokenStateMatched: boolean;
  recoveryStateMatched: boolean;
  assertionPassed: boolean;
}): ScenarioClassification => {
  if (!input.invalidationObserved) {
    return needsReview("Session invalidation could not be confirmed.");
  }

  if (input.assertionPassed) {
    return targetFailure(
      "The application reported success after the session was invalidated.",
    );
  }

  if (input.brokenStateMatched) {
    return targetFailure(
      input.unauthorizedObserved
        ? "An unauthorized response was observed and the configured broken state was confirmed."
        : "The configured broken state was confirmed after session invalidation.",
    );
  }

  if (input.recoveryStateMatched) {
    return pass("The configured authentication recovery state appeared.");
  }

  return needsReview("Authentication recovery was inconclusive.");
};

import type {
  ElementObservation,
  NetworkRequestMatcher,
  ScenarioConfig,
  ScenarioExecutionRequest,
} from "@ghostqa/shared";

import { validateBaselineRequest } from "../baseline/validation.js";

export class ScenarioValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ScenarioValidationError";
  }
}

const validateMatcher = (
  matcher: NetworkRequestMatcher | undefined,
  label: string,
): void => {
  if (
    matcher === undefined ||
    matcher.method.trim().length === 0 ||
    !matcher.pathname.startsWith("/")
  ) {
    throw new ScenarioValidationError(
      `${label} requires a request method and absolute pathname.`,
    );
  }
};

const validateObservation = (
  observation: ElementObservation,
  label: string,
): void => {
  if (
    observation.timeoutMs !== undefined &&
    (observation.timeoutMs < 1 || observation.timeoutMs > 30_000)
  ) {
    throw new ScenarioValidationError(`${label} timeout must be 1-30000 ms.`);
  }

  if (
    observation.stableForMs !== undefined &&
    (observation.stableForMs < 0 || observation.stableForMs > 10_000)
  ) {
    throw new ScenarioValidationError(
      `${label} stable duration must be 0-10000 ms.`,
    );
  }

  if (
    observation.state === "ATTRIBUTE_EQUALS" &&
    (observation.attribute?.trim().length === 0 ||
      observation.value === undefined)
  ) {
    throw new ScenarioValidationError(
      `${label} requires an attribute name and expected value.`,
    );
  }
};

const matcherFor = (
  config: ScenarioConfig,
  request: ScenarioExecutionRequest,
): NetworkRequestMatcher | undefined => {
  switch (config.family) {
    case "DOUBLE_ACTION":
    case "API_FAILURE":
    case "SLOW_RESPONSE":
      return config.request ?? request.flow.criticalAction.request;
    case "SESSION_EXPIRY":
      return config.strategy.kind === "INTERCEPT_REQUEST"
        ? config.strategy.request ?? request.flow.criticalAction.request
        : undefined;
    case "REFRESH_BACK_NAVIGATION":
      return undefined;
  }
};

export const resolveScenarioRequestMatcher = (
  request: ScenarioExecutionRequest,
): NetworkRequestMatcher | undefined => matcherFor(request.scenario.config, request);

export const validateScenarioRequest = (
  request: ScenarioExecutionRequest,
): void => {
  validateBaselineRequest({
    kind: "BASELINE",
    runId: request.runId,
    target: request.target,
    flow: request.flow,
    artifactDirectory: request.artifactDirectory,
  });

  if (request.scenario.id.trim().length === 0) {
    throw new ScenarioValidationError("A scenario ID is required.");
  }
  if (request.scenario.name.trim().length === 0) {
    throw new ScenarioValidationError("A scenario name is required.");
  }
  if (request.scenario.family !== request.scenario.config.family) {
    throw new ScenarioValidationError(
      "Scenario family must match the typed configuration family.",
    );
  }

  const config = request.scenario.config;
  const criticalIndex = request.flow.steps.findIndex(
    (step) => step.id === request.flow.criticalAction.stepId,
  );
  const checkpointId =
    config.family === "DOUBLE_ACTION" ? undefined : config.checkpointStepId;
  if (checkpointId !== undefined) {
    const checkpointIndex = request.flow.steps.findIndex(
      (step) => step.id === checkpointId,
    );
    if (checkpointIndex < 0) {
      throw new ScenarioValidationError(
        `Scenario checkpoint "${checkpointId}" does not exist in the flow.`,
      );
    }
    if (
      config.family !== "REFRESH_BACK_NAVIGATION" &&
      checkpointIndex >= criticalIndex
    ) {
      throw new ScenarioValidationError(
        "Failure scenario checkpoints must occur before the critical action.",
      );
    }
  }

  switch (config.family) {
    case "DOUBLE_ACTION":
      validateMatcher(matcherFor(config, request), "Double Action");
      if (
        config.identifierField !== undefined &&
        !/^[A-Za-z][A-Za-z0-9_]{0,63}$/.test(config.identifierField)
      ) {
        throw new ScenarioValidationError(
          "Response identifier field must be a simple safe property name.",
        );
      }
      break;
    case "API_FAILURE":
      validateMatcher(matcherFor(config, request), "API Failure");
      validateObservation(config.brokenState, "API Failure broken state");
      if (config.recoveryState !== undefined) {
        validateObservation(config.recoveryState, "API Failure recovery state");
      }
      break;
    case "SLOW_RESPONSE":
      validateMatcher(matcherFor(config, request), "Slow Response");
      if (config.delayMs < 100 || config.delayMs > 10_000) {
        throw new ScenarioValidationError(
          "Slow Response delay must be 100-10000 ms.",
        );
      }
      if (config.repeatabilityObservation !== undefined) {
        validateObservation(
          config.repeatabilityObservation,
          "Slow Response repeatability observation",
        );
      }
      if (config.preventionObservation !== undefined) {
        validateObservation(
          config.preventionObservation,
          "Slow Response prevention observation",
        );
      }
      break;
    case "REFRESH_BACK_NAVIGATION":
      validateObservation(config.expectedState, "Navigation expected state");
      break;
    case "SESSION_EXPIRY":
      if (config.strategy.kind === "INTERCEPT_REQUEST") {
        validateMatcher(matcherFor(config, request), "Session Expiry");
      } else if (
        (config.strategy.cookieNames?.length ?? 0) === 0 &&
        (config.strategy.localStorageKeys?.length ?? 0) === 0 &&
        (config.strategy.sessionStorageKeys?.length ?? 0) === 0
      ) {
        throw new ScenarioValidationError(
          "Clear-storage session expiry requires at least one configured key or cookie.",
        );
      }
      validateObservation(config.brokenState, "Session Expiry broken state");
      if (config.recoveryState !== undefined) {
        validateObservation(config.recoveryState, "Session Expiry recovery state");
      }
      break;
  }
};

import type { ScenarioDefinition } from "@ghostqa/shared";

const stuckSubmittingState = {
  locator: { kind: "TEST_ID", value: "confirm-order" },
  state: "ATTRIBUTE_EQUALS",
  attribute: "aria-busy",
  value: "true",
  timeoutMs: 1_000,
  stableForMs: 300,
} as const;

export const ghostShopScenarios: readonly ScenarioDefinition[] = [
  {
    id: "double-action",
    name: "Double Action",
    family: "DOUBLE_ACTION",
    config: {
      family: "DOUBLE_ACTION",
      identifierField: "id",
      responseTimeoutMs: 4_000,
    },
  },
  {
    id: "api-failure",
    name: "API Failure",
    family: "API_FAILURE",
    config: {
      family: "API_FAILURE",
      checkpointStepId: "start-checkout",
      statusCode: 500,
      brokenState: stuckSubmittingState,
      assertionTimeoutMs: 500,
    },
  },
  {
    id: "slow-response",
    name: "Slow Response",
    family: "SLOW_RESPONSE",
    config: {
      family: "SLOW_RESPONSE",
      checkpointStepId: "start-checkout",
      delayMs: 2_000,
      repeatabilityObservation: {
        locator: { kind: "TEST_ID", value: "confirm-order" },
        state: "ENABLED",
        timeoutMs: 1_000,
      },
    },
  },
  {
    id: "refresh",
    name: "Refresh",
    family: "REFRESH_BACK_NAVIGATION",
    config: {
      family: "REFRESH_BACK_NAVIGATION",
      mode: "REFRESH",
      checkpointStepId: "start-checkout",
      expectedState: {
        locator: { kind: "TEST_ID", value: "confirm-order" },
        state: "VISIBLE",
        timeoutMs: 750,
      },
      expectedUrl: "**/checkout",
    },
  },
  {
    id: "back",
    name: "Back",
    family: "REFRESH_BACK_NAVIGATION",
    config: {
      family: "REFRESH_BACK_NAVIGATION",
      mode: "BACK",
      checkpointStepId: "start-checkout",
      expectedState: {
        locator: { kind: "TEXT", text: "Aurora Headphones", exact: true },
        state: "VISIBLE",
        timeoutMs: 1_000,
      },
      expectedUrl: "**/cart",
    },
  },
  {
    id: "session-expiry",
    name: "Session Expiry",
    family: "SESSION_EXPIRY",
    config: {
      family: "SESSION_EXPIRY",
      checkpointStepId: "start-checkout",
      strategy: { kind: "INTERCEPT_REQUEST", statusCode: 401 },
      brokenState: stuckSubmittingState,
      assertionTimeoutMs: 500,
    },
  },
];

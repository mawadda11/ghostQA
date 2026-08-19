import type {
  ScenarioConfig,
  ScenarioExecutionRequest,
} from "@ghostqa/shared";
import { describe, expect, it } from "vitest";

import { ScenarioValidationError, validateScenarioRequest } from "./validation.js";

const createRequest = (
  config: ScenarioConfig = {
    family: "DOUBLE_ACTION",
    identifierField: "id",
  },
): ScenarioExecutionRequest => ({
  kind: "SCENARIO",
  runId: "scenario-test",
  target: {
    baseUrl: "http://127.0.0.1:4173",
    allowedHosts: ["localhost", "127.0.0.1"],
  },
  artifactDirectory: "artifacts/test/scenario-test",
  baselineValidation: { status: "PASS", runId: "baseline-test" },
  scenario: {
    id: "scenario",
    name: "Scenario",
    family: config.family,
    config,
  },
  flow: {
    id: "flow-test",
    name: "Test flow",
    steps: [
      { id: "open", position: 0, action: "NAVIGATE", path: "/" },
      {
        id: "checkpoint",
        position: 1,
        action: "ASSERT_VISIBLE",
        locator: { kind: "TEXT", text: "Ready" },
      },
      {
        id: "submit",
        position: 2,
        action: "CLICK",
        locator: { kind: "ROLE", role: "button", name: "Submit" },
      },
    ],
    criticalAction: {
      stepId: "submit",
      label: "Submit",
      request: { method: "POST", pathname: "/api/submit" },
    },
    successAssertion: { kind: "TEXT_VISIBLE", text: "Complete" },
  },
});

describe("validateScenarioRequest", () => {
  it("accepts all five typed scenario families", () => {
    const observation = {
      locator: { kind: "TEST_ID", value: "submit" },
      state: "VISIBLE",
    } as const;
    const configs: ScenarioConfig[] = [
      { family: "DOUBLE_ACTION", identifierField: "id" },
      {
        family: "API_FAILURE",
        checkpointStepId: "checkpoint",
        statusCode: 500,
        brokenState: observation,
      },
      {
        family: "SLOW_RESPONSE",
        checkpointStepId: "checkpoint",
        delayMs: 2_000,
      },
      {
        family: "REFRESH_BACK_NAVIGATION",
        checkpointStepId: "checkpoint",
        mode: "REFRESH",
        expectedState: observation,
      },
      {
        family: "SESSION_EXPIRY",
        checkpointStepId: "checkpoint",
        strategy: { kind: "INTERCEPT_REQUEST", statusCode: 401 },
        brokenState: observation,
      },
    ];

    for (const config of configs) {
      expect(() => validateScenarioRequest(createRequest(config))).not.toThrow();
    }
  });

  it("rejects a family/config mismatch", () => {
    const request = createRequest();
    const invalid = {
      ...request,
      scenario: { ...request.scenario, family: "API_FAILURE" },
    } as ScenarioExecutionRequest;

    expect(() => validateScenarioRequest(invalid)).toThrowError(
      ScenarioValidationError,
    );
  });

  it("accepts API Failure automatic observation without a configured element", () => {
    expect(() =>
      validateScenarioRequest(
        createRequest({
          family: "API_FAILURE",
          checkpointStepId: "checkpoint",
          statusCode: 500,
        }),
      ),
    ).not.toThrow();
  });

  it("rejects a missing checkpoint", () => {
    const invalid = createRequest({
      family: "SLOW_RESPONSE",
      checkpointStepId: "missing",
      delayMs: 2_000,
    });

    expect(() => validateScenarioRequest(invalid)).toThrowError(
      /does not exist/,
    );
  });

  it("rejects unsafe response identifier fields", () => {
    const invalid = createRequest({
      family: "DOUBLE_ACTION",
      identifierField: "nested.id",
    });

    expect(() => validateScenarioRequest(invalid)).toThrowError(/safe property/);
  });

  it("rejects unbounded slow-response delays at runtime", () => {
    const invalid = createRequest({
      family: "SLOW_RESPONSE",
      checkpointStepId: "checkpoint",
      delayMs: 60_000,
    });

    expect(() => validateScenarioRequest(invalid)).toThrowError(/100-10000/);
  });

  it("allows navigation scenarios without a critical action", () => {
    const request = createRequest({
      family: "REFRESH_BACK_NAVIGATION",
      checkpointStepId: "checkpoint",
      mode: "REFRESH",
      expectedState: {
        locator: { kind: "TEXT", text: "Ready" },
        state: "VISIBLE",
      },
    });
    const { criticalAction: _criticalAction, ...flow } = request.flow;
    expect(() => validateScenarioRequest({ ...request, flow })).not.toThrow();
  });

  it("requires a critical action for mutation-dependent scenarios", () => {
    const request = createRequest();
    const { criticalAction: _criticalAction, ...flow } = request.flow;
    expect(() => validateScenarioRequest({ ...request, flow })).toThrowError(
      /requires a configured critical action/,
    );
  });
});

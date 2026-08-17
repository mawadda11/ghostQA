import type { BaselineExecutionRequest } from "@ghostqa/shared";
import { describe, expect, it } from "vitest";

import {
  BaselineValidationError,
  validateBaselineRequest,
} from "./validation.js";

const createValidBaselineRequest = (): BaselineExecutionRequest => ({
  kind: "BASELINE",
  runId: "run-test",
  target: {
    baseUrl: "http://127.0.0.1:4173",
    allowedHosts: ["localhost", "127.0.0.1"],
  },
  artifactDirectory: "artifacts/test/run-test/baseline",
  flow: {
    id: "flow-test",
    name: "Test flow",
    steps: [
      { id: "open", position: 0, action: "NAVIGATE", path: "/" },
      {
        id: "submit",
        position: 1,
        action: "CLICK",
        locator: { kind: "ROLE", role: "button", name: "Submit" },
      },
    ],
    criticalAction: {
      stepId: "submit",
      label: "Submit",
      request: { method: "POST", pathname: "/api/submit" },
    },
    successAssertion: {
      kind: "TEXT_VISIBLE",
      text: "Complete",
      exact: true,
    },
  },
});

describe("validateBaselineRequest", () => {
  it("accepts a normalized local baseline flow", () => {
    expect(() => validateBaselineRequest(createValidBaselineRequest())).not.toThrow();
  });

  it("rejects a target outside the exact host allowlist", () => {
    const request = createValidBaselineRequest();
    const invalid = {
      ...request,
      target: { ...request.target, baseUrl: "https://example.com" },
    } satisfies BaselineExecutionRequest;

    expect(() => validateBaselineRequest(invalid)).toThrowError(
      /not allowlisted/,
    );
  });

  it("rejects navigation outside the allowed target hosts", () => {
    const request = createValidBaselineRequest();
    const submitStep = request.flow.steps[1];
    if (submitStep === undefined) {
      throw new Error("Test fixture is missing its submit step.");
    }
    const invalid = {
      ...request,
      flow: {
        ...request.flow,
        steps: [
          {
            id: "external",
            position: 0,
            action: "NAVIGATE",
            path: "https://example.com",
          },
          submitStep,
        ],
      },
    } satisfies BaselineExecutionRequest;

    expect(() => validateBaselineRequest(invalid)).toThrowError(
      BaselineValidationError,
    );
  });

  it("rejects empty flows", () => {
    const request = createValidBaselineRequest();
    const invalid = {
      ...request,
      flow: { ...request.flow, steps: [] },
    } satisfies BaselineExecutionRequest;

    expect(() => validateBaselineRequest(invalid)).toThrowError(
      /at least one step/,
    );
  });

  it("requires the critical action to reference a click step", () => {
    const request = createValidBaselineRequest();
    const invalid = {
      ...request,
      flow: {
        ...request.flow,
        criticalAction: {
          ...request.flow.criticalAction,
          stepId: "open",
        },
      },
    } satisfies BaselineExecutionRequest;

    expect(() => validateBaselineRequest(invalid)).toThrowError(
      /critical action/,
    );
  });
});

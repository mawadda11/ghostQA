import { describe, expect, it } from "vitest";

import {
  createProjectSchema,
  normalizedFlowSchema,
  scenarioConfigSchema,
} from "./schemas.js";

describe("API request schemas", () => {
  it("rejects unexpected project fields", () => {
    expect(() =>
      createProjectSchema.parse({
        name: "Project",
        baseUrl: "http://localhost:3000",
        executableCode: "alert(1)",
      }),
    ).toThrow();
  });

  it("rejects duplicate flow-step IDs and invalid positions", () => {
    expect(() =>
      normalizedFlowSchema.parse({
        id: "flow",
        name: "Flow",
        steps: [
          { id: "same", position: 0, action: "NAVIGATE", path: "/" },
          {
            id: "same",
            position: 4,
            action: "CLICK",
            locator: { kind: "TEST_ID", value: "submit" },
          },
        ],
        criticalAction: { stepId: "same", label: "Submit" },
        successAssertion: { kind: "TEXT_VISIBLE", text: "Done" },
      }),
    ).toThrow();
  });

  it("rejects scenario configuration outside bounded V1 behavior", () => {
    expect(() =>
      scenarioConfigSchema.parse({
        family: "SLOW_RESPONSE",
        checkpointStepId: "ready",
        delayMs: 60_000,
      }),
    ).toThrow();
  });

  it("accepts bounded API Failure automatic observation", () => {
    expect(() =>
      scenarioConfigSchema.parse({
        family: "API_FAILURE",
        checkpointStepId: "ready",
        request: { method: "POST", pathname: "/api/items" },
        statusCode: 500,
      }),
    ).not.toThrow();
  });

  it("accepts optional critical actions and multiple step-bound assertions", () => {
    expect(() =>
      normalizedFlowSchema.parse({
        id: "read-only",
        name: "Read-only flow",
        steps: [
          { id: "start", position: 0, action: "NAVIGATE", path: "/" },
          { id: "result", position: 1, action: "WAIT_FOR_URL", url: "**/result" },
        ],
        assertions: [
          {
            id: "start-ready",
            afterStepId: "start",
            assertion: { kind: "TEXT_VISIBLE", text: "Ready" },
          },
          {
            id: "result-ready",
            afterStepId: "result",
            assertion: { kind: "URL_MATCHES", value: "**/result" },
          },
        ],
      }),
    ).not.toThrow();
  });

  it("rejects assertions attached to missing steps and flows with no assertion", () => {
    const base = {
      id: "invalid",
      name: "Invalid flow",
      steps: [{ id: "start", position: 0, action: "NAVIGATE", path: "/" }],
    };
    expect(() => normalizedFlowSchema.parse(base)).toThrow(/requires a final assertion/);
    expect(() => normalizedFlowSchema.parse({
      ...base,
      assertions: [{
        id: "missing",
        afterStepId: "unknown",
        assertion: { kind: "TEXT_VISIBLE", text: "Ready" },
      }],
    })).toThrow(/existing flow step/);
  });
});

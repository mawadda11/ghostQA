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
});

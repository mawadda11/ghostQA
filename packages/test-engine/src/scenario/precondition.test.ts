import type { ScenarioExecutionRequest } from "@ghostqa/shared";
import { describe, expect, it } from "vitest";

import { PlaywrightScenarioEngine } from "./runner.js";

describe("PlaywrightScenarioEngine baseline precondition", () => {
  it("returns BASELINE_REQUIRED without launching a browser", async () => {
    const request: ScenarioExecutionRequest = {
      kind: "SCENARIO",
      runId: "scenario-test",
      target: {
        baseUrl: "http://127.0.0.1:4173",
        allowedHosts: ["127.0.0.1"],
      },
      artifactDirectory: "artifacts/test/not-created",
      baselineValidation: { status: "NOT_VALIDATED" },
      scenario: {
        id: "double-action",
        name: "Double Action",
        family: "DOUBLE_ACTION",
        config: { family: "DOUBLE_ACTION" },
      },
      flow: {
        id: "flow",
        name: "Flow",
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
        successAssertion: { kind: "TEXT_VISIBLE", text: "Complete" },
      },
    };

    const report = await new PlaywrightScenarioEngine().execute(request);
    expect(report.status).toBe("BASELINE_REQUIRED");
    expect(report.artifacts).toEqual([]);
    expect(report.executedSteps).toEqual([]);
  });
});

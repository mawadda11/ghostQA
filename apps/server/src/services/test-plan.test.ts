import { describe, expect, it } from "vitest";

import type { NormalizedFlow } from "@ghostqa/shared";

import { recommendTestPlan } from "./test-plan.js";

const mutationFlow: NormalizedFlow = {
  id: "mutation",
  name: "Generic mutation",
  steps: [
    { id: "start", position: 0, action: "NAVIGATE", path: "/" },
    { id: "ready", position: 1, action: "WAIT_FOR_URL", url: "**/review" },
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
    request: { method: "POST", pathname: "/api/items" },
  },
  successAssertion: { kind: "TEXT_VISIBLE", text: "Saved" },
};

describe("deterministic test-plan recommendations", () => {
  it("recommends request-backed scenarios from generic mutation metadata", () => {
    const plan = recommendTestPlan(mutationFlow);
    expect(plan.mode).toBe("FOCUSED");
    expect(plan.recommendations.find(({ scenarioKey }) => scenarioKey === "double-action")).toMatchObject({
      recommendation: "RECOMMENDED",
      configuration: "READY",
      request: { method: "POST", pathname: "/api/items" },
    });
    expect(plan.recommendations.find(({ scenarioKey }) => scenarioKey === "api-failure")).toMatchObject({
      recommendation: "RECOMMENDED",
      configuration: "READY",
      defaultSelected: true,
    });
    expect(plan.recommendations.find(({ scenarioKey }) => scenarioKey === "slow-response")).toMatchObject({
      defaultSelected: true,
    });
    expect(plan.recommendations.find(({ scenarioKey }) => scenarioKey === "refresh")).toMatchObject({
      configuration: "READY",
      defaultSelected: true,
    });
    expect(plan.recommendations.find(({ scenarioKey }) => scenarioKey === "session-expiry")).not.toHaveProperty("request");
    expect(plan.recommendations.find(({ scenarioKey }) => scenarioKey === "session-expiry")?.defaultSelected).toBe(false);
    expect(plan.recommendations.filter(({ defaultSelected }) => defaultSelected)).toHaveLength(4);
  });

  it("does not invent mutation scenarios for a read-only flow", () => {
    const flow: NormalizedFlow = {
      id: "read-only",
      name: "Read only",
      steps: [
        { id: "start", position: 0, action: "NAVIGATE", path: "/" },
        { id: "result", position: 1, action: "WAIT_FOR_URL", url: "**/result" },
      ],
      assertions: [
        {
          id: "result-visible",
          afterStepId: "result",
          assertion: { kind: "TEXT_VISIBLE", text: "Result" },
        },
      ],
    };
    const plan = recommendTestPlan(flow);
    for (const key of ["double-action", "api-failure", "slow-response"]) {
      expect(plan.recommendations.find(({ scenarioKey }) => scenarioKey === key)).toMatchObject({
        recommendation: "NOT_APPLICABLE",
        configuration: "NOT_APPLICABLE",
      });
    }
    expect(plan.recommendations.find(({ scenarioKey }) => scenarioKey === "back")).toMatchObject({
      recommendation: "AVAILABLE",
    });
    expect(plan.recommendations.filter(({ defaultSelected }) => defaultSelected).map(({ scenarioKey }) => scenarioKey)).toEqual([
      "refresh",
    ]);
  });

  it("selects back only when the same semantic assertion is proven on both sides", () => {
    const flow: NormalizedFlow = {
      id: "shared-state",
      name: "Shared shell navigation",
      steps: [
        { id: "start", position: 0, action: "NAVIGATE", path: "/" },
        { id: "open", position: 1, action: "CLICK", locator: { kind: "ROLE", role: "link", name: "Details" } },
        { id: "details", position: 2, action: "WAIT_FOR_URL", url: "**/details" },
      ],
      assertions: [
        { id: "shell-before", afterStepId: "start", assertion: { kind: "TEXT_VISIBLE", text: "Application shell" } },
        { id: "shell-after", afterStepId: "details", assertion: { kind: "TEXT_VISIBLE", text: "Application shell" } },
      ],
    };
    expect(
      recommendTestPlan(flow).recommendations.find(({ scenarioKey }) => scenarioKey === "back"),
    ).toMatchObject({ configuration: "READY", defaultSelected: true });
  });
});

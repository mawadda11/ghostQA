import { describe, expect, it } from "vitest";

import type { TestPlanRecommendations } from "@ghostqa/shared";

import {
  buildScenarioDefinitions,
  initialTestPlanSelections,
} from "./test-plan.js";

const plan: TestPlanRecommendations = {
  flowId: "flow",
  mode: "FOCUSED",
  steps: [
    { id: "ready", position: 0, action: "WAIT_FOR_URL", label: "Ready" },
    { id: "submit", position: 1, action: "CLICK", label: "Submit" },
  ],
  observations: [
    {
      id: "saved",
      afterStepId: "submit",
      label: "Saved",
      observation: {
        locator: { kind: "TEXT", text: "Saved" },
        state: "VISIBLE",
      },
    },
  ],
  recommendations: [
    {
      scenarioKey: "double-action",
      name: "Double Action",
      family: "DOUBLE_ACTION",
      recommendation: "RECOMMENDED",
      configuration: "READY",
      reason: "Observed request",
      request: { method: "POST", pathname: "/api/items" },
      defaultCheckpointStepId: "ready",
      defaultSelected: true,
    },
    {
      scenarioKey: "session-expiry",
      name: "Session Expiry",
      family: "SESSION_EXPIRY",
      recommendation: "AVAILABLE",
      configuration: "NEEDS_CONFIGURATION",
      reason: "Explicit only",
    },
  ],
};

describe("visual test-plan mapping", () => {
  it("enables only ready deterministic recommendations by default", () => {
    const selections = initialTestPlanSelections(plan);
    expect(selections["double-action"]?.enabled).toBe(true);
    expect(selections["session-expiry"]?.enabled).toBe(false);
    expect(buildScenarioDefinitions(plan, selections)).toMatchObject({
      errors: {},
      definitions: [
        {
          family: "DOUBLE_ACTION",
          config: {
            family: "DOUBLE_ACTION",
            request: { method: "POST", pathname: "/api/items" },
          },
        },
      ],
    });
  });

  it("maps automatic API Failure to the existing scenario definition contract", () => {
    const automaticPlan: TestPlanRecommendations = {
      ...plan,
      recommendations: [
        {
          scenarioKey: "api-failure",
          name: "API Failure",
          family: "API_FAILURE",
          recommendation: "RECOMMENDED",
          configuration: "READY",
          defaultSelected: true,
          reason: "Observed request can be failed",
          request: { method: "POST", pathname: "/api/items" },
          defaultCheckpointStepId: "ready",
        },
      ],
    };
    expect(
      buildScenarioDefinitions(
        automaticPlan,
        initialTestPlanSelections(automaticPlan),
      ),
    ).toEqual({
      errors: {},
      definitions: [
        {
          id: "api-failure",
          name: "API Failure",
          family: "API_FAILURE",
          config: {
            family: "API_FAILURE",
            checkpointStepId: "ready",
            request: { method: "POST", pathname: "/api/items" },
            statusCode: 500,
          },
        },
      ],
    });
  });

  it("does not invent session configuration when a card is enabled", () => {
    const selections = initialTestPlanSelections(plan);
    selections["session-expiry"] = {
      ...selections["session-expiry"]!,
      enabled: true,
    };
    expect(buildScenarioDefinitions(plan, selections).errors).toHaveProperty(
      "session-expiry",
    );
  });
});

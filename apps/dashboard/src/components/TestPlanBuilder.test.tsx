import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { TestPlanRecommendations } from "@ghostqa/shared";

import { TestPlanBuilder } from "./TestPlanBuilder.js";

const plan: TestPlanRecommendations = {
  flowId: "flow",
  mode: "FOCUSED",
  steps: [{ id: "start", position: 0, action: "NAVIGATE", label: "Start" }],
  observations: [],
  recommendations: [
    {
      scenarioKey: "double-action",
      name: "Double Action",
      family: "DOUBLE_ACTION",
      recommendation: "RECOMMENDED",
      configuration: "READY",
      defaultSelected: true,
      reason: "Observed mutation",
      request: { method: "POST", pathname: "/api/items" },
    },
    {
      scenarioKey: "api-failure",
      name: "API Failure",
      family: "API_FAILURE",
      recommendation: "NOT_APPLICABLE",
      configuration: "NOT_APPLICABLE",
      reason: "No mutation",
    },
  ],
};

describe("TestPlanBuilder", () => {
  it("allows visual selection while disabling not-applicable cards", () => {
    const onSave = vi.fn();
    render(<TestPlanBuilder onSave={onSave} pending={false} plan={plan} />);
    expect(screen.getByRole("heading", { name: "Focused plan" })).toBeDefined();
    fireEvent.click(screen.getByRole("button", { name: "Create focused plan" }));
    expect(onSave).toHaveBeenCalledWith([
      expect.objectContaining({ id: "double-action", family: "DOUBLE_ACTION" }),
    ]);
    fireEvent.click(screen.getByRole("button", { name: "Customize test plan" }));
    expect(screen.getByLabelText("Enable API Failure")).toHaveProperty("disabled", true);
    fireEvent.click(screen.getByLabelText("Enable Double Action"));
    expect(screen.getByRole("button", { name: "Create focused plan" })).toHaveProperty("disabled", true);
  });

  it("allows a selected scenario to be customized before mapping", () => {
    const onSave = vi.fn();
    const customizable: TestPlanRecommendations = {
      ...plan,
      steps: [
        { id: "ready", position: 0, action: "NAVIGATE", label: "Ready" },
        { id: "submit", position: 1, action: "CLICK", label: "Submit" },
      ],
      recommendations: [
        {
          scenarioKey: "slow-response",
          name: "Slow Response",
          family: "SLOW_RESPONSE",
          recommendation: "RECOMMENDED",
          configuration: "READY",
          defaultSelected: true,
          reason: "Request can be delayed",
          request: { method: "POST", pathname: "/api/items" },
          defaultCheckpointStepId: "ready",
        },
      ],
    };
    render(<TestPlanBuilder onSave={onSave} pending={false} plan={customizable} />);
    fireEvent.click(screen.getByRole("button", { name: "Customize test plan" }));
    fireEvent.change(screen.getByLabelText("Delay (ms)"), { target: { value: "3456" } });
    fireEvent.click(screen.getByRole("button", { name: "Create focused plan" }));
    expect(onSave).toHaveBeenCalledWith([
      expect.objectContaining({ config: expect.objectContaining({ delayMs: 3456 }) }),
    ]);
  });

  it("allows an available scenario to be enabled manually", () => {
    const onSave = vi.fn();
    const available: TestPlanRecommendations = {
      ...plan,
      recommendations: [
        {
          scenarioKey: "double-action",
          name: "Double Action",
          family: "DOUBLE_ACTION",
          recommendation: "AVAILABLE",
          configuration: "READY",
          defaultSelected: false,
          reason: "Available by explicit choice",
          request: { method: "POST", pathname: "/api/items" },
        },
      ],
    };
    render(<TestPlanBuilder onSave={onSave} pending={false} plan={available} />);
    fireEvent.click(screen.getByRole("button", { name: "Customize test plan" }));
    fireEvent.click(screen.getByLabelText("Enable Double Action"));
    fireEvent.click(screen.getByRole("button", { name: "Create focused plan" }));
    expect(onSave).toHaveBeenCalledWith([
      expect.objectContaining({ family: "DOUBLE_ACTION" }),
    ]);
  });
});

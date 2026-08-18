import type { FlowStep } from "@ghostqa/shared";
import { describe, expect, it } from "vitest";

import {
  describeFlowStep,
  networkPath,
  statusClasses,
  statusLabel,
  totalSummary,
} from "./presentation.js";

describe("dashboard result presentation", () => {
  it("masks sensitive normalized fill values", () => {
    const step: FlowStep = {
      id: "password",
      position: 0,
      action: "FILL",
      locator: { kind: "LABEL", text: "Account password" },
      value: "do-not-display",
    };
    expect(describeFlowStep(step)).toContain("••••••••");
    expect(describeFlowStep(step)).not.toContain("do-not-display");
  });

  it("keeps non-sensitive flow configuration readable", () => {
    const step: FlowStep = {
      id: "email",
      position: 0,
      action: "FILL",
      locator: { kind: "LABEL", text: "Email" },
      value: "developer@example.test",
    };
    expect(describeFlowStep(step)).toContain("developer@example.test");
  });

  it("uses text labels and distinct tones for result states", () => {
    expect(statusLabel("NEEDS_REVIEW")).toBe("NEEDS REVIEW");
    expect(statusClasses("PASS")).toContain("emerald");
    expect(statusClasses("FAIL")).toContain("rose");
    expect(statusClasses("RUNNING")).toContain("sky");
  });

  it("calculates dashboard totals only from persisted summaries", () => {
    expect(
      totalSummary([
        { total: 2, passed: 1, failed: 1, needsReview: 0, errors: 0 },
        { total: 3, passed: 1, failed: 0, needsReview: 1, errors: 1 },
      ]),
    ).toEqual({ total: 5, passed: 2, failed: 1, needsReview: 1, errors: 1 });
  });

  it("uses a compact network path without losing query context", () => {
    expect(networkPath("http://127.0.0.1:4173/api/submissions?retry=1")).toBe(
      "/api/submissions?retry=1",
    );
  });
});

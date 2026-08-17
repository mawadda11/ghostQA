import { describe, expect, it } from "vitest";

import { calculateRunSummary } from "./run-summary.js";

describe("calculateRunSummary", () => {
  it("counts scenario outcomes without treating target failures as run errors", () => {
    expect(
      calculateRunSummary([
        "PASS",
        "FAIL",
        "FAIL",
        "NEEDS_REVIEW",
        "ERROR",
      ]),
    ).toEqual({
      total: 5,
      passed: 1,
      failed: 2,
      needsReview: 1,
      errors: 1,
    });
  });

  it("counts BASELINE_REQUIRED as an execution error", () => {
    expect(calculateRunSummary(["BASELINE_REQUIRED"]).errors).toBe(1);
  });
});

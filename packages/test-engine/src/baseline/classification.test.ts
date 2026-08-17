import { describe, expect, it } from "vitest";

import { classifyBaselineResult } from "./classification.js";

describe("classifyBaselineResult", () => {
  it("passes only when the assertion passed", () => {
    expect(
      classifyBaselineResult({
        assertionStatus: "PASSED",
        stepFailed: false,
        engineError: false,
      }),
    ).toEqual({ status: "PASS" });
  });

  it("classifies an assertion failure as a target failure", () => {
    expect(
      classifyBaselineResult({
        assertionStatus: "FAILED",
        stepFailed: false,
        engineError: false,
      }),
    ).toEqual({ status: "FAIL", failureOrigin: "TARGET_APP_FAILURE" });
  });

  it("classifies a failed flow step as a target failure", () => {
    expect(
      classifyBaselineResult({
        assertionStatus: "NOT_EVALUATED",
        stepFailed: true,
        engineError: false,
      }),
    ).toEqual({ status: "FAIL", failureOrigin: "TARGET_APP_FAILURE" });
  });

  it("classifies an engine error separately", () => {
    expect(
      classifyBaselineResult({
        assertionStatus: "NOT_EVALUATED",
        stepFailed: false,
        engineError: true,
      }),
    ).toEqual({ status: "ERROR", failureOrigin: "GHOSTQA_ENGINE_FAILURE" });
  });
});

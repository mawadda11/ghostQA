import type { FailureOrigin, ResultStatus } from "@ghostqa/shared";

export interface BaselineClassificationInput {
  assertionStatus: "PASSED" | "FAILED" | "NOT_EVALUATED";
  stepFailed: boolean;
  engineError: boolean;
}

export type BaselineClassification =
  | { status: Extract<ResultStatus, "PASS"> }
  | {
      status: Extract<ResultStatus, "FAIL">;
      failureOrigin: Extract<FailureOrigin, "TARGET_APP_FAILURE">;
    }
  | {
      status: Extract<ResultStatus, "ERROR">;
      failureOrigin: Extract<FailureOrigin, "GHOSTQA_ENGINE_FAILURE">;
    };

export const classifyBaselineResult = ({
  assertionStatus,
  stepFailed,
  engineError,
}: BaselineClassificationInput): BaselineClassification => {
  if (engineError) {
    return {
      status: "ERROR",
      failureOrigin: "GHOSTQA_ENGINE_FAILURE",
    };
  }

  if (stepFailed || assertionStatus === "FAILED") {
    return {
      status: "FAIL",
      failureOrigin: "TARGET_APP_FAILURE",
    };
  }

  if (assertionStatus === "PASSED") {
    return { status: "PASS" };
  }

  return {
    status: "ERROR",
    failureOrigin: "GHOSTQA_ENGINE_FAILURE",
  };
};

import type { ExecutedStep, FlowStep } from "@ghostqa/shared";
import type { Page } from "playwright";

import { executeFlowStep } from "../baseline/steps.js";

export class ScenarioFlowStepError extends Error {
  constructor(
    readonly stepId: string,
    message: string,
  ) {
    super(message);
    this.name = "ScenarioFlowStepError";
  }
}

const nowIso = (): string => new Date().toISOString();

export const executeSteps = async (
  page: Page,
  baseUrl: string,
  steps: readonly FlowStep[],
  records: ExecutedStep[],
): Promise<void> => {
  for (const step of steps) {
    const startedAt = nowIso();
    try {
      await executeFlowStep(page, baseUrl, step);
      records.push({
        stepId: step.id,
        position: step.position,
        action: step.action,
        status: "PASSED",
        startedAt,
        completedAt: nowIso(),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      records.push({
        stepId: step.id,
        position: step.position,
        action: step.action,
        status: "FAILED",
        startedAt,
        completedAt: nowIso(),
        error: message,
      });
      throw new ScenarioFlowStepError(step.id, message);
    }
  }
};

import type {
  BaselineExecutionRequest,
  EngineExecutionReport,
} from "@ghostqa/shared";

export { PlaywrightBaselineEngine } from "./baseline/runner.js";
export { createBaselineArtifactPaths } from "./baseline/artifacts.js";
export { classifyBaselineResult } from "./baseline/classification.js";
export { evaluateSuccessAssertion } from "./baseline/success-assertion.js";
export {
  BaselineValidationError,
  validateBaselineRequest,
} from "./baseline/validation.js";

/** Persistence-free baseline execution boundary used by orchestration code. */
export interface TestEngine {
  execute(request: BaselineExecutionRequest): Promise<EngineExecutionReport>;
}

export type { BaselineExecutionRequest, EngineExecutionReport };

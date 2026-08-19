import type {
  BaselineExecutionRequest,
  EngineExecutionReport,
  ScenarioExecutionReport,
  ScenarioExecutionRequest,
} from "@ghostqa/shared";

export { PlaywrightBaselineEngine } from "./baseline/runner.js";
export { createBaselineArtifactPaths } from "./baseline/artifacts.js";
export { classifyBaselineResult } from "./baseline/classification.js";
export { evaluateSuccessAssertion } from "./baseline/success-assertion.js";
export {
  BaselineValidationError,
  validateBaselineRequest,
} from "./baseline/validation.js";
export { PlaywrightScenarioEngine } from "./scenario/runner.js";
export { PlaywrightCaptureEngine } from "./capture/browser.js";
export {
  CaptureBrowserError,
} from "./capture/browser.js";
export {
  CaptureNormalizationError,
  capturedActionLabel,
  selectStableLocator,
} from "./capture/locators.js";
export { normalizeCapturedInteractions } from "./capture/normalization.js";
export type {
  CaptureEngine,
  CaptureHandle,
  CaptureStartRequest,
  NormalizeCaptureInput,
  RawCaptureEvent,
  RawCaptureNetworkObservation,
  RawLocatorCandidates,
} from "./capture/types.js";
export {
  classifyApiFailure,
  classifyDoubleAction,
  classifyNavigation,
  classifySessionExpiry,
  classifySlowResponse,
} from "./scenario/classification.js";
export {
  createEvidenceEntry,
  consoleEvidenceEntries,
} from "./scenario/evidence.js";
export {
  ScenarioValidationError,
  validateScenarioRequest,
} from "./scenario/validation.js";

/** Persistence-free baseline execution boundary used by orchestration code. */
export interface TestEngine {
  execute(request: BaselineExecutionRequest): Promise<EngineExecutionReport>;
}

/** Persistence-free behavioral scenario boundary used by orchestration code. */
export interface ScenarioTestEngine {
  execute(request: ScenarioExecutionRequest): Promise<ScenarioExecutionReport>;
}

export type {
  BaselineExecutionRequest,
  EngineExecutionReport,
  ScenarioExecutionReport,
  ScenarioExecutionRequest,
};

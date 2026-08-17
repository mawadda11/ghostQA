import type {
  EvidenceEntry,
  ExecutedStep,
  ScenarioExecutionRequest,
  SuccessAssertionResult,
} from "@ghostqa/shared";
import type { BrowserContext, Page } from "playwright";

import type { BrowserEvidenceCollector } from "../runtime/browser-evidence.js";
import type { ScenarioClassification } from "./classification.js";

export interface ScenarioExecutionContext {
  request: ScenarioExecutionRequest;
  page: Page;
  browserContext: BrowserContext;
  collector: BrowserEvidenceCollector;
  executedSteps: ExecutedStep[];
  evidence: EvidenceEntry[];
}

export interface ScenarioOutcome {
  classification: ScenarioClassification;
  assertion: SuccessAssertionResult;
}

export interface ScenarioExecutor {
  execute(context: ScenarioExecutionContext): Promise<ScenarioOutcome>;
}

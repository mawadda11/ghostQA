import type {
  FailureOrigin,
  JsonValue,
  NormalizedFlow,
  ResultStatus,
  ScenarioFamily,
  SuccessAssertion,
} from "./domain.js";

export interface ExecutionTarget {
  baseUrl: string;
  allowedHosts: readonly string[];
}

interface BaseExecutionRequest {
  runId: string;
  target: ExecutionTarget;
  flow: NormalizedFlow;
  artifactDirectory: string;
}

export interface BaselineExecutionRequest extends BaseExecutionRequest {
  kind: "BASELINE";
}

export interface ScenarioExecutionRequest extends BaseExecutionRequest {
  kind: "SCENARIO";
  scenario: {
    id: string;
    family: ScenarioFamily;
    config: Readonly<Record<string, JsonValue>>;
  };
}

export type EngineExecutionRequest =
  | BaselineExecutionRequest
  | ScenarioExecutionRequest;

export interface ConsoleObservation {
  source: "CONSOLE" | "PAGE_ERROR";
  level: "debug" | "info" | "log" | "warning" | "error";
  text: string;
  timestamp: string;
}

export interface NetworkObservation {
  method: string;
  url: string;
  status?: number;
  failureText?: string;
  startedAt: string;
  completedAt?: string;
}

export interface ExecutionEvidence {
  finalUrl?: string;
  console: readonly ConsoleObservation[];
  network: readonly NetworkObservation[];
}

export interface ArtifactDescriptor {
  kind: "SCREENSHOT" | "TRACE";
  path: string;
  mimeType: string;
}

export interface ExecutedStep {
  stepId: string;
  position: number;
  action: string;
  status: "PASSED" | "FAILED";
  startedAt: string;
  completedAt: string;
  error?: string;
}

export interface SuccessAssertionResult {
  assertion: SuccessAssertion;
  status: "PASSED" | "FAILED" | "NOT_EVALUATED";
  detail: string;
}

export interface ExecutionErrorObservation {
  source: "FLOW_STEP" | "ENGINE";
  name: string;
  message: string;
  stepId?: string;
}

interface BaseExecutionReport {
  summary: string;
  evidence: ExecutionEvidence;
  artifacts: readonly ArtifactDescriptor[];
  executedSteps: readonly ExecutedStep[];
  assertion: SuccessAssertionResult;
  executionError?: ExecutionErrorObservation;
  startedAt: string;
  completedAt: string;
  durationMs: number;
}

interface SuccessfulExecutionReport extends BaseExecutionReport {
  status: Extract<ResultStatus, "PASS">;
  failureOrigin?: never;
}

interface FailedExecutionReport extends BaseExecutionReport {
  status: Extract<ResultStatus, "FAIL">;
  failureOrigin: Extract<FailureOrigin, "TARGET_APP_FAILURE">;
}

interface ReviewExecutionReport extends BaseExecutionReport {
  status: Extract<ResultStatus, "NEEDS_REVIEW">;
  failureOrigin?: never;
}

interface ErrorExecutionReport extends BaseExecutionReport {
  status: Extract<ResultStatus, "ERROR">;
  failureOrigin: Extract<FailureOrigin, "GHOSTQA_ENGINE_FAILURE">;
}

export type EngineExecutionReport =
  | SuccessfulExecutionReport
  | FailedExecutionReport
  | ReviewExecutionReport
  | ErrorExecutionReport;

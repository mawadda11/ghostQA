import type {
  FailureOrigin,
  Flow,
  JsonValue,
  ResultStatus,
  ScenarioFamily,
} from "./domain.js";

export interface ExecutionTarget {
  baseUrl: string;
}

interface BaseExecutionRequest {
  runId: string;
  target: ExecutionTarget;
  flow: Flow;
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
  relativePath: string;
  mimeType: string;
}

interface BaseExecutionReport {
  summary: string;
  evidence: ExecutionEvidence;
  artifacts: readonly ArtifactDescriptor[];
  startedAt: string;
  completedAt: string;
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

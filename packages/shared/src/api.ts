import type {
  ArtifactDescriptor,
  ConsoleObservation,
  EvidenceEntry,
  ExecutedStep,
  ExecutionErrorObservation,
  NetworkObservation,
  ScenarioConfig,
  SuccessAssertionResult,
} from "./engine.js";
import type {
  FailureOrigin,
  FlowStep,
  Project,
  ResultStatus,
  ScenarioFamily,
  SuccessAssertion,
  CriticalAction,
} from "./domain.js";

export interface HealthResponse {
  status: "ok";
  service: "ghostqa-server";
}

export type ApiErrorCode =
  | "INVALID_REQUEST"
  | "NOT_FOUND"
  | "TARGET_NOT_ALLOWED"
  | "BASELINE_FAILED"
  | "RUN_EXECUTION_ERROR";

export interface ApiErrorResponse {
  error: {
    code: ApiErrorCode;
    message: string;
  };
}

export interface ProjectSummary extends Project {
  flowCount: number;
  runCount: number;
}

export interface PersistedFlow {
  id: string;
  projectId: string;
  name: string;
  steps: readonly FlowStep[];
  criticalAction: CriticalAction;
  successAssertion: SuccessAssertion;
  createdAt: string;
  updatedAt: string;
}

export interface FlowSummary {
  id: string;
  projectId: string;
  name: string;
  stepCount: number;
  scenarioCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface PersistedScenario {
  id: string;
  flowId: string;
  scenarioKey: string;
  name: string;
  family: ScenarioFamily;
  enabled: boolean;
  config: ScenarioConfig;
  createdAt: string;
  updatedAt: string;
}

export const TEST_RUN_STATUSES = [
  "RUNNING",
  "COMPLETED",
  "BASELINE_FAILED",
  "ERROR",
] as const;

export type TestRunStatus = (typeof TEST_RUN_STATUSES)[number];
export type PersistedResultStatus = ResultStatus | "BASELINE_REQUIRED";

export interface RunSummaryCounts {
  total: number;
  passed: number;
  failed: number;
  needsReview: number;
  errors: number;
}

export interface ArtifactMetadata {
  id: string;
  kind: ArtifactDescriptor["kind"];
  mimeType: string;
  downloadUrl: string;
  createdAt: string;
}

export interface PersistedExecutionEvidence {
  finalUrl?: string;
  console: readonly ConsoleObservation[];
  network: readonly NetworkObservation[];
  entries: readonly EvidenceEntry[];
}

export interface PersistedTestResult {
  id: string;
  testRunId: string;
  scenarioId?: string;
  kind: "BASELINE" | "SCENARIO";
  scenarioFamily?: ScenarioFamily;
  status: PersistedResultStatus;
  failureOrigin?: FailureOrigin;
  title: string;
  summary: string;
  durationMs: number;
  finalUrl?: string;
  startedAt: string;
  completedAt: string;
  executionError?: ExecutionErrorObservation;
  evidence: PersistedExecutionEvidence;
  executedSteps: readonly ExecutedStep[];
  assertion: SuccessAssertionResult;
  artifacts: readonly ArtifactMetadata[];
}

export interface TestRunHistoryItem {
  id: string;
  projectId: string;
  flowId: string;
  flowName: string;
  status: TestRunStatus;
  baselineStatus?: PersistedResultStatus;
  summary: RunSummaryCounts;
  startedAt?: string;
  completedAt?: string;
}

export interface TestRunDetail extends TestRunHistoryItem {
  errorMessage?: string;
  baselineResult?: PersistedTestResult;
  scenarioResults: readonly PersistedTestResult[];
}

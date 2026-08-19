import type {
  ArtifactDescriptor,
  ConsoleObservation,
  EvidenceEntry,
  ExecutedStep,
  ExecutionErrorObservation,
  ElementObservation,
  FlowAssertionResult,
  NetworkObservation,
  ScenarioConfig,
  SuccessAssertionResult,
} from "./engine.js";
import type {
  AriaRole,
  FailureOrigin,
  FlowStep,
  FlowAssertion,
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
  | "RUN_EXECUTION_ERROR"
  | "CAPTURE_NOT_ACTIVE"
  | "CAPTURE_FAILED";

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
  criticalAction?: CriticalAction;
  successAssertion?: SuccessAssertion;
  assertions?: readonly FlowAssertion[];
  createdAt: string;
  updatedAt: string;
}

export type TestPlanRecommendationLevel =
  | "RECOMMENDED"
  | "AVAILABLE"
  | "NOT_APPLICABLE";

export type TestPlanConfigurationState =
  | "READY"
  | "NEEDS_CONFIGURATION"
  | "NOT_APPLICABLE";

export interface TestPlanStepOption {
  id: string;
  position: number;
  action: FlowStep["action"];
  label: string;
}

export interface TestPlanObservationOption {
  id: string;
  afterStepId: string;
  label: string;
  observation: ElementObservation;
}

export interface TestPlanRecommendation {
  scenarioKey: string;
  name: string;
  family: ScenarioFamily;
  mode?: "REFRESH" | "BACK";
  recommendation: TestPlanRecommendationLevel;
  configuration: TestPlanConfigurationState;
  reason: string;
  /** Whether this scenario belongs to the deterministic focused plan. */
  defaultSelected?: boolean;
  request?: { method: string; pathname: string };
  defaultCheckpointStepId?: string;
  defaultObservationId?: string;
  defaultExpectedUrl?: string;
}

export interface TestPlanRecommendations {
  flowId: string;
  mode: "FOCUSED";
  steps: readonly TestPlanStepOption[];
  observations: readonly TestPlanObservationOption[];
  recommendations: readonly TestPlanRecommendation[];
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

export const CAPTURE_SESSION_STATUSES = [
  "ACTIVE",
  "READY",
  "CANCELLED",
  "ERROR",
] as const;

export type CaptureSessionStatus =
  (typeof CAPTURE_SESSION_STATUSES)[number];

export interface CaptureNetworkObservation {
  method: string;
  pathname: string;
  status?: number;
  timestamp: string;
  actionStepId?: string;
}

export interface CriticalActionCandidate {
  stepId: string;
  label: string;
  request: {
    method: string;
    pathname: string;
  };
  reason: string;
}

export interface CapturedFlowDraft {
  suggestedId: string;
  suggestedName: string;
  steps: readonly FlowStep[];
  criticalActionCandidates: readonly CriticalActionCandidate[];
  successTextCandidates: readonly string[];
  finalUrl: string;
  network: readonly CaptureNetworkObservation[];
}

export type CaptureDiagnosticStage =
  | "CAPTURING"
  | "FLUSHING_EVENTS"
  | "READING_FINAL_PAGE"
  | "NORMALIZING";

export interface CaptureDiagnosticLocatorCandidates {
  role?: { role: AriaRole; name: string; unique: boolean };
  label?: { text: string; unique: boolean };
  testId?: { value: string; unique: boolean };
  text?: { text: string; unique: boolean };
  css?: { selector: string; unique: boolean };
}

export interface CaptureDiagnosticEvent {
  order: number;
  kind: "CLICK" | "FILL" | "SELECT_OPTION" | "NAVIGATION";
  timestamp: string;
  pathname: string;
  locator?: CaptureDiagnosticLocatorCandidates;
  sensitive?: boolean;
  valueLength?: number;
}

export interface CaptureDiagnostics {
  stage: CaptureDiagnosticStage;
  events: readonly CaptureDiagnosticEvent[];
  network: readonly CaptureNetworkObservation[];
  finalPathname?: string;
  errorMessage: string;
}

export interface CaptureSession {
  id: string;
  projectId: string;
  status: CaptureSessionStatus;
  targetUrl: string;
  startedAt: string;
  updatedAt: string;
  errorMessage?: string;
  draft?: CapturedFlowDraft;
  diagnostics?: CaptureDiagnostics;
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
  assertions: readonly FlowAssertionResult[];
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

export interface GlobalTestRunHistoryItem extends TestRunHistoryItem {
  projectName: string;
}

export interface TestRunDetail extends TestRunHistoryItem {
  errorMessage?: string;
  baselineResult?: PersistedTestResult;
  scenarioResults: readonly PersistedTestResult[];
}

import type {
  FailureOrigin,
  JsonValue,
  LocatorSpec,
  NetworkRequestMatcher,
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

export type ElementStateExpectation =
  | "VISIBLE"
  | "HIDDEN"
  | "ENABLED"
  | "DISABLED"
  | "ATTRIBUTE_EQUALS";

export interface ElementObservation {
  locator: LocatorSpec;
  state: ElementStateExpectation;
  attribute?: string;
  value?: string;
  timeoutMs?: number;
  stableForMs?: number;
}

interface CheckpointScenarioConfig {
  checkpointStepId: string;
}

export interface DoubleActionScenarioConfig {
  family: "DOUBLE_ACTION";
  request?: NetworkRequestMatcher;
  identifierField?: string;
  responseTimeoutMs?: number;
}

export interface ApiFailureScenarioConfig extends CheckpointScenarioConfig {
  family: "API_FAILURE";
  request?: NetworkRequestMatcher;
  statusCode: 500;
  /** Optional: when omitted, the engine uses conservative generic recovery evidence. */
  brokenState?: ElementObservation;
  recoveryState?: ElementObservation;
  assertionTimeoutMs?: number;
}

export interface SlowResponseScenarioConfig extends CheckpointScenarioConfig {
  family: "SLOW_RESPONSE";
  request?: NetworkRequestMatcher;
  delayMs: number;
  repeatabilityObservation?: ElementObservation;
  preventionObservation?: ElementObservation;
}

export interface NavigationScenarioConfig extends CheckpointScenarioConfig {
  family: "REFRESH_BACK_NAVIGATION";
  mode: "REFRESH" | "BACK";
  expectedState: ElementObservation;
  expectedUrl?: string;
}

export type SessionExpiryStrategy =
  | {
      kind: "INTERCEPT_REQUEST";
      request?: NetworkRequestMatcher;
      statusCode: 401;
    }
  | {
      kind: "CLEAR_STORAGE";
      cookieNames?: readonly string[];
      localStorageKeys?: readonly string[];
      sessionStorageKeys?: readonly string[];
    };

export interface SessionExpiryScenarioConfig extends CheckpointScenarioConfig {
  family: "SESSION_EXPIRY";
  strategy: SessionExpiryStrategy;
  brokenState: ElementObservation;
  recoveryState?: ElementObservation;
  assertionTimeoutMs?: number;
}

export type ScenarioConfig =
  | DoubleActionScenarioConfig
  | ApiFailureScenarioConfig
  | SlowResponseScenarioConfig
  | NavigationScenarioConfig
  | SessionExpiryScenarioConfig;

export interface ScenarioDefinition {
  id: string;
  name: string;
  family: ScenarioFamily;
  config: ScenarioConfig;
}

export type BaselineValidationProof =
  | { status: "PASS"; runId: string }
  | { status: "NOT_VALIDATED" };

export interface ScenarioExecutionRequest extends BaseExecutionRequest {
  kind: "SCENARIO";
  baselineValidation: BaselineValidationProof;
  scenario: ScenarioDefinition;
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
  responseIdentifier?: string;
}

export type EvidenceEntryType =
  | "HTTP_REQUEST"
  | "HTTP_RESPONSE"
  | "DUPLICATE_REQUEST"
  | "CONSOLE_ERROR"
  | "PAGE_ERROR"
  | "ASSERTION"
  | "ELEMENT_STATE"
  | "NAVIGATION"
  | "SCENARIO_INJECTION";

export interface EvidenceEntry {
  type: EvidenceEntryType;
  message: string;
  timestamp: string;
  metadata?: Readonly<Record<string, JsonValue>>;
}

export interface ExecutionEvidence {
  finalUrl?: string;
  console: readonly ConsoleObservation[];
  network: readonly NetworkObservation[];
  entries: readonly EvidenceEntry[];
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

export interface FlowAssertionResult extends SuccessAssertionResult {
  id: string;
  afterStepId?: string;
}

export interface ExecutionErrorObservation {
  source: "FLOW_STEP" | "ENGINE";
  name: string;
  message: string;
  stepId?: string;
}

export interface BaseExecutionReport {
  summary: string;
  evidence: ExecutionEvidence;
  artifacts: readonly ArtifactDescriptor[];
  executedSteps: readonly ExecutedStep[];
  /** All evaluated or pending step-bound and final assertions, in flow order. */
  assertions?: readonly FlowAssertionResult[];
  /** The final/last assertion result retained for older API consumers. */
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

interface ScenarioReportContext {
  scenario: Pick<ScenarioDefinition, "id" | "name" | "family">;
}

export type ScenarioExecutionReport =
  | (EngineExecutionReport &
      ScenarioReportContext & { baselineValidation: "VALIDATED" })
  | (BaseExecutionReport &
      ScenarioReportContext & {
        status: "BASELINE_REQUIRED";
        baselineValidation: "REQUIRED";
        failureOrigin?: never;
      });

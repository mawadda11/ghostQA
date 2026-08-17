export const SCENARIO_FAMILIES = [
  "DOUBLE_ACTION",
  "API_FAILURE",
  "SLOW_RESPONSE",
  "REFRESH_BACK_NAVIGATION",
  "SESSION_EXPIRY",
] as const;

export type ScenarioFamily = (typeof SCENARIO_FAMILIES)[number];

export const RESULT_STATUSES = ["PASS", "FAIL", "NEEDS_REVIEW", "ERROR"] as const;

export type ResultStatus = (typeof RESULT_STATUSES)[number];

export const FAILURE_ORIGINS = [
  "TARGET_APP_FAILURE",
  "GHOSTQA_ENGINE_FAILURE",
] as const;

export type FailureOrigin = (typeof FAILURE_ORIGINS)[number];

export const FLOW_STEP_ACTIONS = [
  "NAVIGATE",
  "CLICK",
  "FILL",
  "SELECT_OPTION",
  "PRESS",
  "WAIT_FOR_URL",
  "ASSERT_VISIBLE",
] as const;

export type FlowStepAction = (typeof FLOW_STEP_ACTIONS)[number];

export type JsonPrimitive = boolean | number | string | null;

export type JsonValue =
  | JsonPrimitive
  | { readonly [key: string]: JsonValue }
  | readonly JsonValue[];

export interface Project {
  id: string;
  name: string;
  targetBaseUrl: string;
  createdAt: string;
  updatedAt: string;
}

export interface FlowStep {
  id: string;
  position: number;
  action: FlowStepAction;
  locator?: string;
  value?: string;
  url?: string;
  timeoutMs?: number;
}

export interface CriticalAction {
  stepPosition: number;
}

export type SuccessAssertion =
  | { kind: "URL_MATCHES"; value: string }
  | { kind: "ELEMENT_VISIBLE"; locator: string }
  | { kind: "TEXT_VISIBLE"; text: string; locator?: string };

export interface Flow {
  id: string;
  projectId: string;
  name: string;
  steps: readonly FlowStep[];
  criticalAction: CriticalAction;
  successAssertion: SuccessAssertion;
  createdAt: string;
  updatedAt: string;
}

export interface Scenario {
  id: string;
  projectId: string;
  name: string;
  family: ScenarioFamily;
  enabled: boolean;
  config: Readonly<Record<string, JsonValue>>;
}

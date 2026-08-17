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

export type AriaRole =
  | "button"
  | "checkbox"
  | "dialog"
  | "heading"
  | "link"
  | "listitem"
  | "navigation"
  | "radio"
  | "status"
  | "textbox";

export type LocatorSpec =
  | { kind: "ROLE"; role: AriaRole; name: string; exact?: boolean }
  | { kind: "LABEL"; text: string; exact?: boolean }
  | { kind: "TEXT"; text: string; exact?: boolean }
  | { kind: "TEST_ID"; value: string }
  | { kind: "CSS"; selector: string };

export interface Project {
  id: string;
  name: string;
  targetBaseUrl: string;
  createdAt: string;
  updatedAt: string;
}

interface BaseFlowStep {
  id: string;
  position: number;
  timeoutMs?: number;
}

export type FlowStep =
  | (BaseFlowStep & { action: "NAVIGATE"; path: string })
  | (BaseFlowStep & { action: "CLICK"; locator: LocatorSpec })
  | (BaseFlowStep & { action: "FILL"; locator: LocatorSpec; value: string })
  | (BaseFlowStep & {
      action: "SELECT_OPTION";
      locator: LocatorSpec;
      value: string;
    })
  | (BaseFlowStep & {
      action: "PRESS";
      locator: LocatorSpec;
      key: string;
    })
  | (BaseFlowStep & { action: "WAIT_FOR_URL"; url: string })
  | (BaseFlowStep & { action: "ASSERT_VISIBLE"; locator: LocatorSpec });

export interface NetworkRequestMatcher {
  method: string;
  pathname: string;
}

export interface CriticalAction {
  stepId: string;
  label: string;
  request?: NetworkRequestMatcher;
}

export type SuccessAssertion =
  | { kind: "URL_MATCHES"; value: string; timeoutMs?: number }
  | {
      kind: "ELEMENT_VISIBLE";
      locator: LocatorSpec;
      timeoutMs?: number;
    }
  | {
      kind: "TEXT_VISIBLE";
      text: string;
      locator?: LocatorSpec;
      exact?: boolean;
      timeoutMs?: number;
    };

export interface NormalizedFlow {
  id: string;
  name: string;
  steps: readonly FlowStep[];
  criticalAction: CriticalAction;
  successAssertion: SuccessAssertion;
}

export interface Flow extends NormalizedFlow {
  projectId: string;
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

import type {
  AriaRole,
  CaptureDiagnostics,
  CapturedFlowDraft,
  ExecutionTarget,
} from "@ghostqa/shared";

export interface RawLocatorCandidates {
  role?: { role: AriaRole; name: string; unique: boolean };
  label?: { text: string; unique: boolean };
  testId?: { value: string; unique: boolean };
  text?: { text: string; unique: boolean };
  css?: { selector: string; unique: boolean };
}

interface RawInteractionBase {
  order: number;
  timestampMs: number;
  pageUrl: string;
}

export type RawCaptureEvent =
  | (RawInteractionBase & {
      kind: "CLICK";
      locator: RawLocatorCandidates;
    })
  | (RawInteractionBase & {
      kind: "FILL";
      locator: RawLocatorCandidates;
      value: string;
      sensitive: boolean;
    })
  | (RawInteractionBase & {
      kind: "SELECT_OPTION";
      locator: RawLocatorCandidates;
      value: string;
    })
  | (RawInteractionBase & {
      kind: "NAVIGATION";
      url: string;
    });

export interface RawCaptureNetworkObservation {
  method: string;
  pathname: string;
  timestampMs: number;
  status?: number;
}

export interface NormalizeCaptureInput {
  baseUrl: string;
  suggestedFlowId: string;
  suggestedFlowName: string;
  events: readonly RawCaptureEvent[];
  network: readonly RawCaptureNetworkObservation[];
  finalUrl: string;
  successTextCandidates: readonly string[];
}

export interface CaptureStartRequest {
  target: ExecutionTarget;
  suggestedFlowId: string;
  suggestedFlowName: string;
  onUnexpectedClose: (error: Error) => void;
}

export interface CaptureHandle {
  stop(): Promise<CapturedFlowDraft>;
  cancel(): Promise<void>;
  getDiagnostics?(): CaptureDiagnostics | undefined;
}

export interface CaptureEngine {
  start(request: CaptureStartRequest): Promise<CaptureHandle>;
}

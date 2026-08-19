import type { LocatorSpec } from "@ghostqa/shared";

import type { RawLocatorCandidates } from "./types.js";

export class CaptureNormalizationError extends Error {
  constructor(
    message: string,
    readonly eventOrder?: number,
    readonly eventKind?: "CLICK" | "FILL" | "SELECT_OPTION",
  ) {
    super(message);
    this.name = "CaptureNormalizationError";
  }
}

export const selectStableLocator = (
  candidates: RawLocatorCandidates,
): LocatorSpec => {
  if (candidates.role?.unique === true) {
    return {
      kind: "ROLE",
      role: candidates.role.role,
      name: candidates.role.name,
      exact: true,
    };
  }
  if (candidates.label?.unique === true) {
    return { kind: "LABEL", text: candidates.label.text, exact: true };
  }
  if (candidates.testId?.unique === true) {
    return { kind: "TEST_ID", value: candidates.testId.value };
  }
  if (candidates.text?.unique === true) {
    return { kind: "TEXT", text: candidates.text.text, exact: true };
  }
  if (candidates.css?.unique === true) {
    return { kind: "CSS", selector: candidates.css.selector };
  }
  throw new CaptureNormalizationError(
    "A captured interaction did not have a stable unique locator.",
  );
};

export const capturedActionLabel = (
  action: "CLICK" | "FILL" | "SELECT_OPTION",
  locator: LocatorSpec,
): string => {
  const target =
    locator.kind === "ROLE"
      ? locator.name
      : locator.kind === "LABEL" || locator.kind === "TEXT"
        ? locator.text
        : locator.kind === "TEST_ID"
          ? locator.value
          : locator.selector;
  const verb =
    action === "CLICK" ? "Click" : action === "FILL" ? "Fill" : "Select";
  return `${verb} ${target}`;
};

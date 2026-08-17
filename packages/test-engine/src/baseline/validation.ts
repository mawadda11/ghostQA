import type {
  BaselineExecutionRequest,
  FlowStep,
  LocatorSpec,
} from "@ghostqa/shared";

export class BaselineValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BaselineValidationError";
  }
}

const normalizeHostname = (hostname: string): string =>
  hostname.trim().toLowerCase().replace(/\.$/, "");

const validateLocator = (locator: LocatorSpec, stepId: string): void => {
  const value =
    locator.kind === "ROLE"
      ? locator.name
      : locator.kind === "TEST_ID"
        ? locator.value
        : locator.kind === "CSS"
          ? locator.selector
          : locator.text;

  if (value.trim().length === 0) {
    throw new BaselineValidationError(
      `Flow step "${stepId}" contains an empty locator.`,
    );
  }
};

const locatorForStep = (step: FlowStep): LocatorSpec | undefined => {
  switch (step.action) {
    case "CLICK":
    case "FILL":
    case "SELECT_OPTION":
    case "PRESS":
    case "ASSERT_VISIBLE":
      return step.locator;
    case "NAVIGATE":
    case "WAIT_FOR_URL":
      return undefined;
  }
};

const parseAllowedHosts = (allowedHosts: readonly string[]): Set<string> => {
  if (allowedHosts.length === 0) {
    throw new BaselineValidationError("At least one allowed target host is required.");
  }

  return new Set(
    allowedHosts.map((host) => {
      const normalized = normalizeHostname(host);
      if (
        normalized.length === 0 ||
        normalized.includes("*") ||
        normalized.includes("://") ||
        normalized.includes("/")
      ) {
        throw new BaselineValidationError(
          `Allowed target host "${host}" must be an exact hostname.`,
        );
      }

      return normalized;
    }),
  );
};

const assertUrlAllowed = (rawUrl: string, allowedHosts: Set<string>): URL => {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new BaselineValidationError(
      `Target URL "${rawUrl}" is not a valid absolute URL.`,
    );
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new BaselineValidationError("Target URLs must use HTTP or HTTPS.");
  }

  if (url.username.length > 0 || url.password.length > 0) {
    throw new BaselineValidationError(
      "Target URLs must not contain embedded credentials.",
    );
  }

  if (!allowedHosts.has(normalizeHostname(url.hostname))) {
    throw new BaselineValidationError(
      `Target host "${url.hostname}" is not allowlisted.`,
    );
  }

  return url;
};

export const validateBaselineRequest = (
  request: BaselineExecutionRequest,
): void => {
  const allowedHosts = parseAllowedHosts(request.target.allowedHosts);
  const baseUrl = assertUrlAllowed(request.target.baseUrl, allowedHosts);

  if (request.runId.trim().length === 0) {
    throw new BaselineValidationError("A baseline run ID is required.");
  }

  if (request.artifactDirectory.trim().length === 0) {
    throw new BaselineValidationError("A baseline artifact directory is required.");
  }

  if (request.flow.steps.length === 0) {
    throw new BaselineValidationError("A baseline flow requires at least one step.");
  }

  const stepIds = new Set<string>();
  request.flow.steps.forEach((step, index) => {
    if (step.id.trim().length === 0 || stepIds.has(step.id)) {
      throw new BaselineValidationError(
        `Flow step IDs must be non-empty and unique; received "${step.id}".`,
      );
    }
    stepIds.add(step.id);

    if (step.position !== index) {
      throw new BaselineValidationError(
        `Flow step "${step.id}" must have normalized position ${index}.`,
      );
    }

    const locator = locatorForStep(step);
    if (locator !== undefined) {
      validateLocator(locator, step.id);
    }

    if (step.action === "NAVIGATE") {
      assertUrlAllowed(new URL(step.path, baseUrl).href, allowedHosts);
    }
  });

  const criticalStep = request.flow.steps.find(
    (step) => step.id === request.flow.criticalAction.stepId,
  );
  if (criticalStep?.action !== "CLICK") {
    throw new BaselineValidationError(
      "The critical action must reference a CLICK step in the flow.",
    );
  }

  const requestMatcher = request.flow.criticalAction.request;
  if (
    requestMatcher !== undefined &&
    (requestMatcher.method.trim().length === 0 ||
      !requestMatcher.pathname.startsWith("/"))
  ) {
    throw new BaselineValidationError(
      "Critical request metadata requires a method and absolute pathname.",
    );
  }
};

import type {
  FlowStep,
  LocatorSpec,
  PersistedResultStatus,
  RunSummaryCounts,
  ScenarioFamily,
  SuccessAssertion,
  TestRunStatus,
} from "@ghostqa/shared";

export type DisplayStatus = PersistedResultStatus | TestRunStatus;

export const statusLabel = (status: DisplayStatus): string =>
  status.replaceAll("_", " ");

export const statusClasses = (status: DisplayStatus): string => {
  switch (status) {
    case "PASS":
      return "border-emerald-400/25 bg-emerald-400/10 text-emerald-300";
    case "FAIL":
    case "BASELINE_FAILED":
      return "border-rose-400/25 bg-rose-400/10 text-rose-300";
    case "ERROR":
      return "border-red-500/30 bg-red-500/10 text-red-300";
    case "NEEDS_REVIEW":
    case "BASELINE_REQUIRED":
      return "border-amber-400/25 bg-amber-400/10 text-amber-300";
    case "RUNNING":
      return "border-sky-400/25 bg-sky-400/10 text-sky-300";
    case "COMPLETED":
      return "border-slate-400/20 bg-slate-400/10 text-slate-200";
  }
};

export const formatDateTime = (value?: string): string => {
  if (value === undefined) return "—";
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
};

export const formatDuration = (durationMs?: number): string => {
  if (durationMs === undefined) return "—";
  if (durationMs < 1_000) return `${durationMs} ms`;
  if (durationMs < 60_000) return `${(durationMs / 1_000).toFixed(1)} s`;
  const minutes = Math.floor(durationMs / 60_000);
  const seconds = Math.round((durationMs % 60_000) / 1_000);
  return `${minutes}m ${seconds}s`;
};

export const runDuration = (
  startedAt?: string,
  completedAt?: string,
): string => {
  if (startedAt === undefined || completedAt === undefined) return "—";
  return formatDuration(
    new Date(completedAt).getTime() - new Date(startedAt).getTime(),
  );
};

export const locatorLabel = (locator: LocatorSpec): string => {
  switch (locator.kind) {
    case "ROLE":
      return `${locator.role} “${locator.name}”`;
    case "LABEL":
      return `label “${locator.text}”`;
    case "TEXT":
      return `text “${locator.text}”`;
    case "TEST_ID":
      return `test id “${locator.value}”`;
    case "CSS":
      return `selector “${locator.selector}”`;
  }
};

const locatorSearchText = (locator: LocatorSpec): string => {
  switch (locator.kind) {
    case "ROLE":
      return `${locator.role} ${locator.name}`;
    case "LABEL":
    case "TEXT":
      return locator.text;
    case "TEST_ID":
      return locator.value;
    case "CSS":
      return locator.selector;
  }
};

export const isSensitiveFillStep = (step: FlowStep): boolean =>
  step.action === "FILL" &&
  (step.sensitive === true ||
    /password|passcode|secret|token|credential|api[-_ ]?key/i.test(
      locatorSearchText(step.locator),
    ));

export const describeFlowStep = (step: FlowStep): string => {
  switch (step.action) {
    case "NAVIGATE":
      return step.path;
    case "CLICK":
      return locatorLabel(step.locator);
    case "FILL":
      return `${locatorLabel(step.locator)} with ${
        isSensitiveFillStep(step) ? "••••••••" : `“${step.value}”`
      }`;
    case "SELECT_OPTION":
      return `${locatorLabel(step.locator)} → “${step.value}”`;
    case "PRESS":
      return `${step.key} on ${locatorLabel(step.locator)}`;
    case "WAIT_FOR_URL":
      return step.url;
    case "ASSERT_VISIBLE":
      return locatorLabel(step.locator);
  }
};

export const actionLabel = (action: FlowStep["action"]): string =>
  action.replaceAll("_", " ").toLowerCase().replace(/^./, (value) =>
    value.toUpperCase(),
  );

export const describeSuccessAssertion = (
  assertion: SuccessAssertion,
): { label: string; value: string } => {
  switch (assertion.kind) {
    case "URL_MATCHES":
      return { label: "URL matches", value: assertion.value };
    case "ELEMENT_VISIBLE":
      return { label: "Element visible", value: locatorLabel(assertion.locator) };
    case "TEXT_VISIBLE":
      return { label: "Visible text", value: assertion.text };
  }
};

export const familyLabel = (family: ScenarioFamily): string =>
  family.replaceAll("_", " ").toLowerCase().replace(/\b\w/g, (value) =>
    value.toUpperCase(),
  );

export const scenarioPurpose = (family: ScenarioFamily): string => {
  const descriptions: Record<ScenarioFamily, string> = {
    DOUBLE_ACTION: "Checks whether rapid repeated action causes duplicate mutation.",
    API_FAILURE: "Checks safe behavior when a configured request returns HTTP 500.",
    SLOW_RESPONSE: "Observes behavior while a configured response is delayed.",
    REFRESH_BACK_NAVIGATION:
      "Checks state preservation across refresh or back navigation.",
    SESSION_EXPIRY: "Checks recovery when authenticated state expires.",
  };
  return descriptions[family];
};

export const networkPath = (value: string): string => {
  try {
    const url = new URL(value);
    return `${url.pathname}${url.search}`;
  } catch {
    return value;
  }
};

export const networkDuration = (
  startedAt: string,
  completedAt?: string,
): string => {
  if (completedAt === undefined) return "Pending";
  return formatDuration(
    Math.max(0, new Date(completedAt).getTime() - new Date(startedAt).getTime()),
  );
};

export const totalSummary = (
  summaries: readonly RunSummaryCounts[],
): RunSummaryCounts =>
  summaries.reduce<RunSummaryCounts>(
    (total, summary) => ({
      total: total.total + summary.total,
      passed: total.passed + summary.passed,
      failed: total.failed + summary.failed,
      needsReview: total.needsReview + summary.needsReview,
      errors: total.errors + summary.errors,
    }),
    { total: 0, passed: 0, failed: 0, needsReview: 0, errors: 0 },
  );

import type { PersistedResultStatus, RunSummaryCounts } from "@ghostqa/shared";

export const calculateRunSummary = (
  statuses: readonly PersistedResultStatus[],
): RunSummaryCounts => ({
  total: statuses.length,
  passed: statuses.filter((status) => status === "PASS").length,
  failed: statuses.filter((status) => status === "FAIL").length,
  needsReview: statuses.filter((status) => status === "NEEDS_REVIEW").length,
  errors: statuses.filter(
    (status) => status === "ERROR" || status === "BASELINE_REQUIRED",
  ).length,
});

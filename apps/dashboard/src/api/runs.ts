import type {
  GlobalTestRunHistoryItem,
  PersistedTestResult,
  TestRunDetail,
  TestRunHistoryItem,
} from "@ghostqa/shared";

import { apiClient } from "./client.js";

export const listRuns = (): Promise<GlobalTestRunHistoryItem[]> =>
  apiClient.request<GlobalTestRunHistoryItem[]>("/api/runs");

export const listProjectRuns = (
  projectId: string,
): Promise<TestRunHistoryItem[]> =>
  apiClient.request<TestRunHistoryItem[]>(`/api/projects/${projectId}/runs`);

export const getRun = (runId: string): Promise<TestRunDetail> =>
  apiClient.request<TestRunDetail>(`/api/runs/${runId}`);

export const getResult = (resultId: string): Promise<PersistedTestResult> =>
  apiClient.request<PersistedTestResult>(`/api/results/${resultId}`);

export const artifactUrl = (artifactId: string): string =>
  apiClient.artifactUrl(artifactId);


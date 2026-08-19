import type {
  PersistedFlow,
  PersistedScenario,
  ScenarioDefinition,
  TestPlanRecommendations,
  TestRunDetail,
} from "@ghostqa/shared";

import { apiClient } from "./client.js";

export const getFlow = (flowId: string): Promise<PersistedFlow> =>
  apiClient.request<PersistedFlow>(`/api/flows/${flowId}`);

export const listFlowScenarios = (
  flowId: string,
): Promise<PersistedScenario[]> =>
  apiClient.request<PersistedScenario[]>(`/api/flows/${flowId}/scenarios`);

export const importScenarioPlan = (
  flowId: string,
  scenarios: readonly ScenarioDefinition[],
): Promise<PersistedScenario[]> =>
  apiClient.request<PersistedScenario[]>(
    `/api/flows/${flowId}/scenarios/default`,
    {
      method: "POST",
      body: JSON.stringify({ scenarios }),
    },
  );

export const getTestPlanRecommendations = (
  flowId: string,
): Promise<TestPlanRecommendations> =>
  apiClient.request<TestPlanRecommendations>(
    `/api/flows/${flowId}/test-plan/recommendations`,
  );

export const saveTestPlan = (
  flowId: string,
  scenarios: readonly ScenarioDefinition[],
): Promise<PersistedScenario[]> =>
  apiClient.request<PersistedScenario[]>(`/api/flows/${flowId}/test-plan`, {
    method: "PUT",
    body: JSON.stringify({ scenarios }),
  });

export const updateScenarioEnabled = (
  scenarioId: string,
  enabled: boolean,
): Promise<PersistedScenario> =>
  apiClient.request<PersistedScenario>(`/api/scenarios/${scenarioId}`, {
    method: "PATCH",
    body: JSON.stringify({ enabled }),
  });

export const runFlow = (flowId: string): Promise<TestRunDetail> =>
  apiClient.request<TestRunDetail>(`/api/flows/${flowId}/runs`, {
    method: "POST",
    body: "{}",
  });

export const replayBaseline = (flowId: string): Promise<TestRunDetail> =>
  apiClient.request<TestRunDetail>(`/api/flows/${flowId}/replay`, {
    method: "POST",
    body: "{}",
  });

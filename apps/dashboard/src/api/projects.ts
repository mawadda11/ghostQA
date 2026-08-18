import type {
  FlowSummary,
  HealthResponse,
  NormalizedFlow,
  PersistedFlow,
  ProjectSummary,
} from "@ghostqa/shared";

import { apiClient } from "./client.js";

export interface ProjectDraft {
  name: string;
  description?: string;
  baseUrl: string;
}

export const getHealth = (): Promise<HealthResponse> =>
  apiClient.request<HealthResponse>("/health");

export const listProjects = (): Promise<ProjectSummary[]> =>
  apiClient.request<ProjectSummary[]>("/api/projects");

export const getProject = (projectId: string): Promise<ProjectSummary> =>
  apiClient.request<ProjectSummary>(`/api/projects/${projectId}`);

export const createProject = (input: ProjectDraft): Promise<ProjectSummary> =>
  apiClient.request<ProjectSummary>("/api/projects", {
    method: "POST",
    body: JSON.stringify(input),
  });

export const updateProject = (
  projectId: string,
  input: ProjectDraft,
): Promise<ProjectSummary> =>
  apiClient.request<ProjectSummary>(`/api/projects/${projectId}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });

export const listProjectFlows = (projectId: string): Promise<FlowSummary[]> =>
  apiClient.request<FlowSummary[]>(`/api/projects/${projectId}/flows`);

export const createFlow = (
  projectId: string,
  flow: NormalizedFlow,
): Promise<PersistedFlow> =>
  apiClient.request<PersistedFlow>(`/api/projects/${projectId}/flows`, {
    method: "POST",
    body: JSON.stringify(flow),
  });


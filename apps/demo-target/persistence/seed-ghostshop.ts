import type {
  FlowSummary,
  PersistedFlow,
  PersistedScenario,
  ProjectSummary,
} from "@ghostqa/shared";

import { ghostShopBaselineFlow } from "../baseline/ghostshop-flow.js";
import { ghostShopScenarios } from "../scenarios/ghostshop-scenarios.js";

export interface SeededGhostShop {
  project: ProjectSummary;
  flow: FlowSummary | PersistedFlow;
  scenarios: readonly PersistedScenario[];
}

const apiRequest = async <T>(
  serverUrl: string,
  pathname: string,
  init?: RequestInit,
): Promise<T> => {
  const response = await fetch(new URL(pathname, serverUrl), {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...init?.headers,
    },
  });
  if (!response.ok) {
    throw new Error(
      `GhostQA API ${init?.method ?? "GET"} ${pathname} failed with HTTP ${response.status}: ${await response.text()}`,
    );
  }
  return (await response.json()) as T;
};

export const seedGhostShop = async (
  serverUrl = process.env["GHOSTQA_SERVER_URL"] ?? "http://127.0.0.1:4000",
  targetUrl = process.env["GHOSTSHOP_URL"] ?? "http://127.0.0.1:4173",
): Promise<SeededGhostShop> => {
  const projects = await apiRequest<ProjectSummary[]>(serverUrl, "/api/projects");
  let project = projects.find((candidate) => candidate.name === "GhostShop");
  if (project === undefined) {
    project = await apiRequest<ProjectSummary>(serverUrl, "/api/projects", {
      method: "POST",
      body: JSON.stringify({
        name: "GhostShop",
        baseUrl: targetUrl,
        description: "Local GhostQA demo target",
      }),
    });
  } else if (
    project.baseUrl !== new URL(targetUrl).href ||
    project.description !== "Local GhostQA demo target"
  ) {
    project = await apiRequest<ProjectSummary>(
      serverUrl,
      `/api/projects/${project.id}`,
      {
        method: "PATCH",
        body: JSON.stringify({
          baseUrl: targetUrl,
          description: "Local GhostQA demo target",
        }),
      },
    );
  }

  const flows = await apiRequest<FlowSummary[]>(
    serverUrl,
    `/api/projects/${project.id}/flows`,
  );
  let flow: FlowSummary | PersistedFlow | undefined = flows.find(
    (candidate) => candidate.name === ghostShopBaselineFlow.name,
  );
  if (flow === undefined) {
    flow = await apiRequest<PersistedFlow>(
      serverUrl,
      `/api/projects/${project.id}/flows`,
      { method: "POST", body: JSON.stringify(ghostShopBaselineFlow) },
    );
  }

  const scenarios = await apiRequest<PersistedScenario[]>(
    serverUrl,
    `/api/flows/${flow.id}/scenarios/default`,
    {
      method: "POST",
      body: JSON.stringify({ scenarios: ghostShopScenarios }),
    },
  );
  return { project, flow, scenarios };
};

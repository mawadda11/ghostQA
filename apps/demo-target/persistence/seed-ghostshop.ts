import type {
  FlowSummary,
  PersistedFlow,
  PersistedScenario,
  ProjectSummary,
} from "@ghostqa/shared";

import { ghostShopBaselineFlow } from "../baseline/ghostshop-flow.js";
import { ghostShopScenarios } from "../scenarios/ghostshop-scenarios.js";
import { ghostQaApiRequest } from "../support/ghostqa-api.js";

export interface SeededGhostShop {
  project: ProjectSummary;
  flow: FlowSummary | PersistedFlow;
  scenarios: readonly PersistedScenario[];
}

export const seedGhostShop = async (
  serverUrl = process.env["GHOSTQA_SERVER_URL"] ?? "http://127.0.0.1:4000",
  targetUrl = process.env["GHOSTSHOP_URL"] ?? "http://127.0.0.1:4173",
): Promise<SeededGhostShop> => {
  const projects = await ghostQaApiRequest<ProjectSummary[]>(serverUrl, "/api/projects");
  let project = projects.find((candidate) => candidate.name === "GhostShop");
  if (project === undefined) {
    project = await ghostQaApiRequest<ProjectSummary>(serverUrl, "/api/projects", {
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
    project = await ghostQaApiRequest<ProjectSummary>(
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

  const flows = await ghostQaApiRequest<FlowSummary[]>(
    serverUrl,
    `/api/projects/${project.id}/flows`,
  );
  let flow: FlowSummary | PersistedFlow | undefined = flows.find(
    (candidate) => candidate.name === ghostShopBaselineFlow.name,
  );
  if (flow === undefined) {
    flow = await ghostQaApiRequest<PersistedFlow>(
      serverUrl,
      `/api/projects/${project.id}/flows`,
      { method: "POST", body: JSON.stringify(ghostShopBaselineFlow) },
    );
  }

  const scenarios = await ghostQaApiRequest<PersistedScenario[]>(
    serverUrl,
    `/api/flows/${flow.id}/scenarios/default`,
    {
      method: "POST",
      body: JSON.stringify({ scenarios: ghostShopScenarios }),
    },
  );
  return { project, flow, scenarios };
};

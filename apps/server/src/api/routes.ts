import { stat } from "node:fs/promises";
import path from "node:path";

import type { PrismaClient } from "@prisma/client";
import type {
  NormalizedFlow,
  ScenarioConfig,
  ScenarioDefinition,
} from "@ghostqa/shared";
import { Router } from "express";

import { resolveStoredArtifactPath } from "../artifacts/path-safety.js";
import {
  createFlow,
  getFlow,
  listProjectFlows,
} from "../services/flows.js";
import { RunOrchestrator } from "../services/orchestrator.js";
import {
  createProject,
  deleteProject,
  getProject,
  listProjects,
  updateProject,
} from "../services/projects.js";
import { getResult } from "../services/results.js";
import { getRunDetail, listProjectRuns } from "../services/runs.js";
import {
  listFlowScenarios,
  updateScenario,
  upsertScenarioPlan,
} from "../services/scenarios.js";
import {
  createProjectSchema,
  normalizedFlowSchema,
  scenarioPlanSchema,
  startRunSchema,
  updateProjectSchema,
  updateScenarioSchema,
} from "../validation/schemas.js";
import { notFound } from "./errors.js";

export interface ApiRouterOptions {
  prisma: PrismaClient;
  allowedHosts: ReadonlySet<string>;
  artifactRoot: string;
  orchestrator?: RunOrchestrator;
}

const routeParam = (value: string | undefined, name: string): string => {
  if (value === undefined || value.trim().length === 0) {
    throw notFound(name);
  }
  return value;
};

export const createApiRouter = (options: ApiRouterOptions): Router => {
  const router = Router();
  const orchestrator =
    options.orchestrator ??
    new RunOrchestrator({
      prisma: options.prisma,
      allowedHosts: options.allowedHosts,
      artifactRoot: options.artifactRoot,
    });

  router.post("/projects", async (request, response) => {
    const input = createProjectSchema.parse(request.body);
    response
      .status(201)
      .json(
        await createProject(
          options.prisma,
          {
            name: input.name,
            baseUrl: input.baseUrl,
            ...(input.description === undefined
              ? {}
              : { description: input.description }),
          },
          options.allowedHosts,
        ),
      );
  });

  router.get("/projects", async (_request, response) => {
    response.json(await listProjects(options.prisma));
  });

  router.get("/projects/:projectId", async (request, response) => {
    response.json(
      await getProject(
        options.prisma,
        routeParam(request.params["projectId"], "Project"),
      ),
    );
  });

  router.patch("/projects/:projectId", async (request, response) => {
    const input = updateProjectSchema.parse(request.body);
    response.json(
      await updateProject(
        options.prisma,
        routeParam(request.params["projectId"], "Project"),
        {
          ...(input.name === undefined ? {} : { name: input.name }),
          ...(input.description === undefined
            ? {}
            : { description: input.description }),
          ...(input.baseUrl === undefined ? {} : { baseUrl: input.baseUrl }),
        },
        options.allowedHosts,
      ),
    );
  });

  router.delete("/projects/:projectId", async (request, response) => {
    await deleteProject(
      options.prisma,
      routeParam(request.params["projectId"], "Project"),
    );
    response.sendStatus(204);
  });

  router.post("/projects/:projectId/flows", async (request, response) => {
    const flow = normalizedFlowSchema.parse(request.body) as NormalizedFlow;
    response.status(201).json(
      await createFlow(
        options.prisma,
        routeParam(request.params["projectId"], "Project"),
        flow,
        options.allowedHosts,
      ),
    );
  });

  router.get("/projects/:projectId/flows", async (request, response) => {
    response.json(
      await listProjectFlows(
        options.prisma,
        routeParam(request.params["projectId"], "Project"),
      ),
    );
  });

  router.get("/flows/:flowId", async (request, response) => {
    response.json(
      await getFlow(
        options.prisma,
        routeParam(request.params["flowId"], "Flow"),
      ),
    );
  });

  router.post("/flows/:flowId/scenarios/default", async (request, response) => {
    const body = scenarioPlanSchema.parse(request.body);
    response.status(201).json(
      await upsertScenarioPlan(
        options.prisma,
        routeParam(request.params["flowId"], "Flow"),
        body.scenarios as ScenarioDefinition[],
        options.allowedHosts,
      ),
    );
  });

  router.get("/flows/:flowId/scenarios", async (request, response) => {
    response.json(
      await listFlowScenarios(
        options.prisma,
        routeParam(request.params["flowId"], "Flow"),
      ),
    );
  });

  router.patch("/scenarios/:scenarioId", async (request, response) => {
    const body = updateScenarioSchema.parse(request.body);
    response.json(
      await updateScenario(
        options.prisma,
        routeParam(request.params["scenarioId"], "Scenario"),
        {
          ...(body.enabled === undefined ? {} : { enabled: body.enabled }),
          ...(body.config === undefined
            ? {}
            : { config: body.config as ScenarioConfig }),
        },
        options.allowedHosts,
      ),
    );
  });

  router.post("/flows/:flowId/runs", async (request, response) => {
    const body = startRunSchema.parse(request.body ?? {});
    response.status(201).json(
      await orchestrator.runFlow(
        routeParam(request.params["flowId"], "Flow"),
        body.scenarioIds,
      ),
    );
  });

  router.get("/projects/:projectId/runs", async (request, response) => {
    response.json(
      await listProjectRuns(
        options.prisma,
        routeParam(request.params["projectId"], "Project"),
      ),
    );
  });

  router.get("/runs/:runId", async (request, response) => {
    response.json(
      await getRunDetail(
        options.prisma,
        routeParam(request.params["runId"], "Test run"),
      ),
    );
  });

  router.get("/results/:resultId", async (request, response) => {
    const result = await getResult(
      options.prisma,
      routeParam(request.params["resultId"], "Test result"),
    );
    if (result === undefined) throw notFound("Test result");
    response.json(result);
  });

  router.get("/artifacts/:artifactId", async (request, response) => {
    const artifact = await options.prisma.artifact.findUnique({
      where: {
        id: routeParam(request.params["artifactId"], "Artifact"),
      },
    });
    if (artifact === null) throw notFound("Artifact");
    const absolutePath = resolveStoredArtifactPath(
      options.artifactRoot,
      artifact.relativePath,
    );
    const file = await stat(absolutePath);
    if (!file.isFile()) throw notFound("Artifact file");
    response.type(artifact.mimeType);
    if (artifact.kind === "TRACE") {
      response.attachment(path.basename(absolutePath));
    }
    response.sendFile(absolutePath);
  });

  return router;
};

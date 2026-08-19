import type { Prisma, PrismaClient } from "@prisma/client";
import type {
  PersistedScenario,
  ScenarioConfig,
  ScenarioDefinition,
} from "@ghostqa/shared";
import { validateScenarioRequest } from "@ghostqa/test-engine";

import { ApiError, notFound } from "../api/errors.js";
import {
  parseValidatedJson,
  serializeValidatedJson,
} from "../persistence/json.js";
import { scenarioConfigSchema } from "../validation/schemas.js";
import {
  getFlowExecutionRecord,
  toNormalizedFlow,
} from "./flows.js";

type ScenarioRecord = Prisma.ScenarioGetPayload<Record<string, never>>;

export const toScenarioDefinition = (
  scenario: ScenarioRecord,
): ScenarioDefinition => ({
  id: scenario.id,
  name: scenario.name,
  family: scenario.family,
  config: parseValidatedJson<ScenarioConfig>(
    scenario.configJson,
    scenarioConfigSchema,
    `Scenario ${scenario.id} configuration`,
  ),
});

const toPersistedScenario = (scenario: ScenarioRecord): PersistedScenario => {
  const definition = toScenarioDefinition(scenario);
  return {
    ...definition,
    flowId: scenario.flowId,
    scenarioKey: scenario.scenarioKey,
    enabled: scenario.enabled,
    createdAt: scenario.createdAt.toISOString(),
    updatedAt: scenario.updatedAt.toISOString(),
  };
};

const validateDefinitionForFlow = (
  definition: ScenarioDefinition,
  flow: Awaited<ReturnType<typeof getFlowExecutionRecord>>,
  allowedHosts: ReadonlySet<string>,
): void => {
  validateScenarioRequest({
    kind: "SCENARIO",
    runId: "scenario-validation",
    target: {
      baseUrl: flow.project.targetBaseUrl,
      allowedHosts: [...allowedHosts],
    },
    flow: toNormalizedFlow(flow),
    artifactDirectory: "artifacts/validation",
    baselineValidation: { status: "PASS", runId: "baseline-validation" },
    scenario: definition,
  });
};

export const upsertScenarioPlan = async (
  prisma: PrismaClient,
  flowId: string,
  definitions: readonly ScenarioDefinition[],
  allowedHosts: ReadonlySet<string>,
): Promise<PersistedScenario[]> => {
  const flow = await getFlowExecutionRecord(prisma, flowId);
  const keys = new Set<string>();
  for (const definition of definitions) {
    if (keys.has(definition.id)) {
      throw new ApiError(
        400,
        "INVALID_REQUEST",
        `Scenario key "${definition.id}" must be unique within the plan.`,
      );
    }
    keys.add(definition.id);
    validateDefinitionForFlow(definition, flow, allowedHosts);
  }

  const records = await prisma.$transaction(
    definitions.map((definition) =>
      prisma.scenario.upsert({
        where: {
          flowId_scenarioKey: { flowId, scenarioKey: definition.id },
        },
        create: {
          flowId,
          scenarioKey: definition.id,
          name: definition.name,
          family: definition.family,
          configJson: serializeValidatedJson(
            definition.config,
            scenarioConfigSchema,
            `Scenario ${definition.id} configuration`,
          ),
        },
        update: {
          name: definition.name,
          family: definition.family,
          configJson: serializeValidatedJson(
            definition.config,
            scenarioConfigSchema,
            `Scenario ${definition.id} configuration`,
          ),
        },
      }),
    ),
  );
  return records.map(toPersistedScenario);
};

export const replaceScenarioPlan = async (
  prisma: PrismaClient,
  flowId: string,
  definitions: readonly ScenarioDefinition[],
  allowedHosts: ReadonlySet<string>,
): Promise<PersistedScenario[]> => {
  const flow = await getFlowExecutionRecord(prisma, flowId);
  const keys = new Set<string>();
  for (const definition of definitions) {
    if (keys.has(definition.id)) {
      throw new ApiError(
        400,
        "INVALID_REQUEST",
        `Scenario key "${definition.id}" must be unique within the plan.`,
      );
    }
    keys.add(definition.id);
    validateDefinitionForFlow(definition, flow, allowedHosts);
  }

  const records = await prisma.$transaction([
    prisma.scenario.deleteMany({
      where: { flowId, scenarioKey: { notIn: [...keys] } },
    }),
    ...definitions.map((definition) =>
      prisma.scenario.upsert({
        where: { flowId_scenarioKey: { flowId, scenarioKey: definition.id } },
        create: {
          flowId,
          scenarioKey: definition.id,
          name: definition.name,
          family: definition.family,
          enabled: true,
          configJson: serializeValidatedJson(
            definition.config,
            scenarioConfigSchema,
            `Scenario ${definition.id} configuration`,
          ),
        },
        update: {
          name: definition.name,
          family: definition.family,
          enabled: true,
          configJson: serializeValidatedJson(
            definition.config,
            scenarioConfigSchema,
            `Scenario ${definition.id} configuration`,
          ),
        },
      }),
    ),
  ]);
  return records.slice(1).map((record) => toPersistedScenario(record as ScenarioRecord));
};

export const listFlowScenarios = async (
  prisma: PrismaClient,
  flowId: string,
): Promise<PersistedScenario[]> => {
  const flow = await prisma.flow.findUnique({ where: { id: flowId } });
  if (flow === null) throw notFound("Flow");
  return (
    await prisma.scenario.findMany({
      where: { flowId },
      orderBy: { createdAt: "asc" },
    })
  ).map(toPersistedScenario);
};

export const updateScenario = async (
  prisma: PrismaClient,
  scenarioId: string,
  input: { enabled?: boolean; config?: ScenarioConfig },
  allowedHosts: ReadonlySet<string>,
): Promise<PersistedScenario> => {
  const existing = await prisma.scenario.findUnique({
    where: { id: scenarioId },
  });
  if (existing === null) throw notFound("Scenario");
  if (input.config !== undefined && input.config.family !== existing.family) {
    throw new ApiError(
      400,
      "INVALID_REQUEST",
      "Scenario configuration family cannot be changed.",
    );
  }

  if (input.config !== undefined) {
    const flow = await getFlowExecutionRecord(prisma, existing.flowId);
    validateDefinitionForFlow(
      {
        id: existing.id,
        name: existing.name,
        family: existing.family,
        config: input.config,
      },
      flow,
      allowedHosts,
    );
  }

  const scenario = await prisma.scenario.update({
    where: { id: scenarioId },
    data: {
      ...(input.enabled === undefined ? {} : { enabled: input.enabled }),
      ...(input.config === undefined
        ? {}
        : {
            configJson: serializeValidatedJson(
              input.config,
              scenarioConfigSchema,
              `Scenario ${scenarioId} configuration`,
            ),
          }),
    },
  });
  return toPersistedScenario(scenario);
};

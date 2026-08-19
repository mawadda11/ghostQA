import type { Prisma, PrismaClient } from "@prisma/client";
import type {
  CriticalAction,
  FlowAssertion,
  FlowStep,
  FlowSummary,
  NormalizedFlow,
  PersistedFlow,
  SuccessAssertion,
} from "@ghostqa/shared";
import { validateBaselineRequest } from "@ghostqa/test-engine";

import { notFound } from "../api/errors.js";
import {
  parseValidatedJson,
  serializeValidatedJson,
} from "../persistence/json.js";
import {
  criticalActionSchema,
  flowAssertionsSchema,
  flowStepSchema,
  successAssertionSchema,
} from "../validation/schemas.js";

export const flowExecutionInclude = {
  project: true,
  steps: { orderBy: { position: "asc" as const } },
  scenarios: { orderBy: { createdAt: "asc" as const } },
} as const;

export type FlowExecutionRecord = Prisma.FlowGetPayload<{
  include: typeof flowExecutionInclude;
}>;

const serializeStep = (step: FlowStep): string =>
  serializeValidatedJson(step, flowStepSchema, `Flow step ${step.id}`);

const deserializeStep = (
  record: FlowExecutionRecord["steps"][number],
): FlowStep => {
  const step = parseValidatedJson<FlowStep>(
    record.configJson,
    flowStepSchema,
    `Flow step ${record.id}`,
  );
  if (
    step.id !== record.stepKey ||
    step.position !== record.position ||
    step.action !== record.action
  ) {
    throw new Error(`Persisted flow step ${record.id} metadata is inconsistent.`);
  }
  return step;
};

export const toNormalizedFlow = (
  record: Pick<
    FlowExecutionRecord,
    | "id"
    | "name"
    | "steps"
    | "criticalActionJson"
    | "successAssertionJson"
    | "assertionsJson"
  >,
): NormalizedFlow => {
  const criticalAction =
    record.criticalActionJson === null
      ? undefined
      : parseValidatedJson<CriticalAction>(
          record.criticalActionJson,
          criticalActionSchema,
          `Flow ${record.id} critical action`,
        );
  const successAssertion =
    record.successAssertionJson === null
      ? undefined
      : parseValidatedJson<SuccessAssertion>(
          record.successAssertionJson,
          successAssertionSchema,
          `Flow ${record.id} success assertion`,
        );
  const assertions = parseValidatedJson<FlowAssertion[]>(
    record.assertionsJson,
    flowAssertionsSchema,
    `Flow ${record.id} assertions`,
  );
  return {
    id: record.id,
    name: record.name,
    steps: record.steps.map(deserializeStep),
    ...(criticalAction === undefined ? {} : { criticalAction }),
    ...(successAssertion === undefined ? {} : { successAssertion }),
    ...(assertions.length === 0 ? {} : { assertions }),
  };
};

const toPersistedFlow = (record: FlowExecutionRecord): PersistedFlow => {
  const flow = toNormalizedFlow(record);
  return {
    ...flow,
    projectId: record.projectId,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
};

const validateFlowTarget = (
  flow: NormalizedFlow,
  targetBaseUrl: string,
  allowedHosts: ReadonlySet<string>,
): void => {
  validateBaselineRequest({
    kind: "BASELINE",
    runId: "flow-validation",
    target: {
      baseUrl: targetBaseUrl,
      allowedHosts: [...allowedHosts],
    },
    flow,
    artifactDirectory: "artifacts/validation",
  });
};

const flowCreateData = (
  projectId: string,
  flow: NormalizedFlow,
  id?: string,
): Prisma.FlowCreateInput => ({
  ...(id === undefined ? {} : { id }),
  name: flow.name,
  project: { connect: { id: projectId } },
  criticalActionJson:
    flow.criticalAction === undefined
      ? null
      : serializeValidatedJson(
          flow.criticalAction,
          criticalActionSchema,
          "Critical action",
        ),
  successAssertionJson:
    flow.successAssertion === undefined
      ? null
      : serializeValidatedJson(
          flow.successAssertion,
          successAssertionSchema,
          "Success assertion",
        ),
  assertionsJson: serializeValidatedJson(
    flow.assertions ?? [],
    flowAssertionsSchema,
    "Flow assertions",
  ),
  steps: {
    create: flow.steps.map((step) => ({
      stepKey: step.id,
      position: step.position,
      action: step.action,
      configJson: serializeStep(step),
      ...(step.timeoutMs === undefined ? {} : { timeoutMs: step.timeoutMs }),
    })),
  },
});

export const createFlow = async (
  prisma: PrismaClient,
  projectId: string,
  flow: NormalizedFlow,
  allowedHosts: ReadonlySet<string>,
): Promise<PersistedFlow> => {
  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (project === null) throw notFound("Project");
  validateFlowTarget(flow, project.targetBaseUrl, allowedHosts);
  const created = await prisma.flow.create({
    data: flowCreateData(projectId, flow),
    include: flowExecutionInclude,
  });
  return toPersistedFlow(created);
};

export const upsertFlow = async (
  prisma: PrismaClient,
  databaseId: string,
  projectId: string,
  flow: NormalizedFlow,
  allowedHosts: ReadonlySet<string>,
): Promise<PersistedFlow> => {
  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (project === null) throw notFound("Project");
  validateFlowTarget(flow, project.targetBaseUrl, allowedHosts);

  const existing = await prisma.flow.findUnique({ where: { id: databaseId } });
  if (existing !== null && existing.projectId !== projectId) {
    throw new Error("The deterministic flow ID belongs to another project.");
  }
  const record = await prisma.$transaction(async (transaction) => {
    if (existing === null) {
      return transaction.flow.create({
        data: flowCreateData(projectId, flow, databaseId),
        include: flowExecutionInclude,
      });
    }
    await transaction.flowStep.deleteMany({ where: { flowId: databaseId } });
    return transaction.flow.update({
      where: { id: databaseId },
      data: {
        name: flow.name,
        criticalActionJson:
          flow.criticalAction === undefined
            ? null
            : serializeValidatedJson(
                flow.criticalAction,
                criticalActionSchema,
                "Critical action",
              ),
        successAssertionJson:
          flow.successAssertion === undefined
            ? null
            : serializeValidatedJson(
                flow.successAssertion,
                successAssertionSchema,
                "Success assertion",
              ),
        assertionsJson: serializeValidatedJson(
          flow.assertions ?? [],
          flowAssertionsSchema,
          "Flow assertions",
        ),
        steps: {
          create: flow.steps.map((step) => ({
            stepKey: step.id,
            position: step.position,
            action: step.action,
            configJson: serializeStep(step),
            ...(step.timeoutMs === undefined
              ? {}
              : { timeoutMs: step.timeoutMs }),
          })),
        },
      },
      include: flowExecutionInclude,
    });
  });
  return toPersistedFlow(record);
};

export const getFlowExecutionRecord = async (
  prisma: PrismaClient,
  flowId: string,
): Promise<FlowExecutionRecord> => {
  const flow = await prisma.flow.findUnique({
    where: { id: flowId },
    include: flowExecutionInclude,
  });
  if (flow === null) throw notFound("Flow");
  return flow;
};

export const getFlow = async (
  prisma: PrismaClient,
  flowId: string,
): Promise<PersistedFlow> => toPersistedFlow(await getFlowExecutionRecord(prisma, flowId));

export const listProjectFlows = async (
  prisma: PrismaClient,
  projectId: string,
): Promise<FlowSummary[]> => {
  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (project === null) throw notFound("Project");
  const flows = await prisma.flow.findMany({
    where: { projectId },
    include: { _count: { select: { steps: true, scenarios: true } } },
    orderBy: { createdAt: "desc" },
  });
  return flows.map((flow) => ({
    id: flow.id,
    projectId: flow.projectId,
    name: flow.name,
    stepCount: flow._count.steps,
    scenarioCount: flow._count.scenarios,
    createdAt: flow.createdAt.toISOString(),
    updatedAt: flow.updatedAt.toISOString(),
  }));
};

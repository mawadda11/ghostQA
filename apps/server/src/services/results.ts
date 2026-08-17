import type { Prisma, PrismaClient } from "@prisma/client";
import type {
  EngineExecutionReport,
  ExecutionErrorObservation,
  PersistedExecutionEvidence,
  PersistedTestResult,
  ScenarioExecutionReport,
  ScenarioFamily,
} from "@ghostqa/shared";

import { toStoredArtifactPath } from "../artifacts/path-safety.js";
import {
  parseValidatedJson,
  serializeValidatedJson,
} from "../persistence/json.js";
import {
  executionErrorSchema,
  executionEvidenceSchema,
  resultObservationsSchema,
} from "../validation/schemas.js";

export const resultDetailInclude = { artifacts: true } as const;
export type TestResultRecord = Prisma.TestResultGetPayload<{
  include: typeof resultDetailInclude;
}>;

type ExecutionReport = EngineExecutionReport | ScenarioExecutionReport;

interface PersistReportInput {
  testRunId: string;
  scenarioId?: string;
  kind: "BASELINE" | "SCENARIO";
  scenarioFamily?: ScenarioFamily;
  title: string;
  report: ExecutionReport;
  artifactRoot: string;
}

export const persistExecutionReport = async (
  prisma: PrismaClient,
  input: PersistReportInput,
): Promise<PersistedTestResult> => {
  const executionErrorJson =
    input.report.executionError === undefined
      ? undefined
      : serializeValidatedJson(
          input.report.executionError,
          executionErrorSchema,
          "Execution error",
        );
  const record = await prisma.testResult.create({
    data: {
      testRunId: input.testRunId,
      ...(input.scenarioId === undefined
        ? {}
        : { scenarioId: input.scenarioId }),
      kind: input.kind,
      ...(input.scenarioFamily === undefined
        ? {}
        : { scenarioFamily: input.scenarioFamily }),
      status: input.report.status,
      ...(input.report.failureOrigin === undefined
        ? {}
        : { failureOrigin: input.report.failureOrigin }),
      title: input.title,
      summary: input.report.summary,
      durationMs: input.report.durationMs,
      ...(input.report.evidence.finalUrl === undefined
        ? {}
        : { finalUrl: input.report.evidence.finalUrl }),
      startedAt: new Date(input.report.startedAt),
      completedAt: new Date(input.report.completedAt),
      ...(executionErrorJson === undefined ? {} : { executionErrorJson }),
      evidenceJson: serializeValidatedJson(
        input.report.evidence,
        executionEvidenceSchema,
        "Execution evidence",
      ),
      observationsJson: serializeValidatedJson(
        {
          executedSteps: input.report.executedSteps,
          assertion: input.report.assertion,
        },
        resultObservationsSchema,
        "Execution observations",
      ),
      artifacts: {
        create: input.report.artifacts.map((artifact) => ({
          kind: artifact.kind,
          relativePath: toStoredArtifactPath(
            input.artifactRoot,
            artifact.path,
          ),
          mimeType: artifact.mimeType,
        })),
      },
    },
    include: resultDetailInclude,
  });
  return toPersistedTestResult(record);
};

export const toPersistedTestResult = (
  record: TestResultRecord,
): PersistedTestResult => {
  const evidence = parseValidatedJson<PersistedExecutionEvidence>(
    record.evidenceJson,
    executionEvidenceSchema,
    `Result ${record.id} evidence`,
  );
  const observations = parseValidatedJson<{
    executedSteps: PersistedTestResult["executedSteps"];
    assertion: PersistedTestResult["assertion"];
  }>(
    record.observationsJson,
    resultObservationsSchema,
    `Result ${record.id} observations`,
  );
  const executionError =
    record.executionErrorJson === null
      ? undefined
      : parseValidatedJson<ExecutionErrorObservation>(
          record.executionErrorJson,
          executionErrorSchema,
          `Result ${record.id} execution error`,
        );

  return {
    id: record.id,
    testRunId: record.testRunId,
    ...(record.scenarioId === null ? {} : { scenarioId: record.scenarioId }),
    kind: record.kind,
    ...(record.scenarioFamily === null
      ? {}
      : { scenarioFamily: record.scenarioFamily }),
    status: record.status,
    ...(record.failureOrigin === null
      ? {}
      : { failureOrigin: record.failureOrigin }),
    title: record.title,
    summary: record.summary,
    durationMs: record.durationMs,
    ...(record.finalUrl === null ? {} : { finalUrl: record.finalUrl }),
    startedAt: record.startedAt.toISOString(),
    completedAt: record.completedAt.toISOString(),
    ...(executionError === undefined ? {} : { executionError }),
    evidence,
    executedSteps: observations.executedSteps,
    assertion: observations.assertion,
    artifacts: record.artifacts.map((artifact) => ({
      id: artifact.id,
      kind: artifact.kind,
      mimeType: artifact.mimeType,
      downloadUrl: `/api/artifacts/${artifact.id}`,
      createdAt: artifact.createdAt.toISOString(),
    })),
  };
};

export const getResult = async (
  prisma: PrismaClient,
  resultId: string,
): Promise<PersistedTestResult | undefined> => {
  const record = await prisma.testResult.findUnique({
    where: { id: resultId },
    include: resultDetailInclude,
  });
  return record === null ? undefined : toPersistedTestResult(record);
};

import type { Prisma, PrismaClient } from "@prisma/client";
import type {
  GlobalTestRunHistoryItem,
  TestRunDetail,
  TestRunHistoryItem,
} from "@ghostqa/shared";

import { notFound } from "../api/errors.js";
import {
  resultDetailInclude,
  toPersistedTestResult,
} from "./results.js";

const runDetailInclude = {
  flow: true,
  results: {
    include: resultDetailInclude,
    orderBy: { createdAt: "asc" as const },
  },
} as const;

type RunDetailRecord = Prisma.TestRunGetPayload<{
  include: typeof runDetailInclude;
}>;

const summaryFromRecord = (run: RunDetailRecord | Prisma.TestRunGetPayload<{
  include: { flow: true };
}>) => ({
  total: run.totalScenarios,
  passed: run.passedCount,
  failed: run.failedCount,
  needsReview: run.needsReviewCount,
  errors: run.errorCount,
});

export const toRunHistoryItem = (
  run: Prisma.TestRunGetPayload<{ include: { flow: true } }>,
): TestRunHistoryItem => ({
  id: run.id,
  projectId: run.projectId,
  flowId: run.flowId,
  flowName: run.flow.name,
  status: run.status,
  ...(run.baselineStatus === null
    ? {}
    : { baselineStatus: run.baselineStatus }),
  summary: summaryFromRecord(run),
  ...(run.startedAt === null ? {} : { startedAt: run.startedAt.toISOString() }),
  ...(run.completedAt === null
    ? {}
    : { completedAt: run.completedAt.toISOString() }),
});

export const toRunDetail = (run: RunDetailRecord): TestRunDetail => {
  const results = run.results.map(toPersistedTestResult);
  const baselineResult = results.find((result) => result.kind === "BASELINE");
  return {
    ...toRunHistoryItem(run),
    ...(run.errorMessage === null ? {} : { errorMessage: run.errorMessage }),
    ...(baselineResult === undefined ? {} : { baselineResult }),
    scenarioResults: results.filter((result) => result.kind === "SCENARIO"),
  };
};

export const listProjectRuns = async (
  prisma: PrismaClient,
  projectId: string,
): Promise<TestRunHistoryItem[]> => {
  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (project === null) throw notFound("Project");
  return (
    await prisma.testRun.findMany({
      where: { projectId },
      include: { flow: true },
      orderBy: { createdAt: "desc" },
    })
  ).map(toRunHistoryItem);
};

export const listRuns = async (
  prisma: PrismaClient,
): Promise<GlobalTestRunHistoryItem[]> =>
  (
    await prisma.testRun.findMany({
      include: { flow: true, project: true },
      orderBy: { createdAt: "desc" },
    })
  ).map((run) => ({
    ...toRunHistoryItem(run),
    projectName: run.project.name,
  }));

export const getRunDetail = async (
  prisma: PrismaClient,
  runId: string,
): Promise<TestRunDetail> => {
  const run = await prisma.testRun.findUnique({
    where: { id: runId },
    include: runDetailInclude,
  });
  if (run === null) throw notFound("Test run");
  return toRunDetail(run);
};

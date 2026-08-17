import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import type {
  EngineExecutionReport,
  NormalizedFlow,
  ScenarioExecutionReport,
  ScenarioExecutionRequest,
} from "@ghostqa/shared";
import type { ScenarioTestEngine, TestEngine } from "@ghostqa/test-engine";
import { afterAll, describe, expect, it } from "vitest";

import { prisma } from "../db/prisma.js";
import { createFlow, getFlow } from "./flows.js";
import { RunOrchestrator } from "./orchestrator.js";
import { createProject, deleteProject } from "./projects.js";
import { getResult, persistExecutionReport } from "./results.js";
import { listFlowScenarios, upsertScenarioPlan } from "./scenarios.js";

const allowedHosts = new Set(["localhost", "127.0.0.1"]);

const createFixtureFlow = (): NormalizedFlow => ({
  id: "input-flow",
  name: "Persistence fixture flow",
  steps: [
    { id: "open", position: 0, action: "NAVIGATE", path: "/" },
    {
      id: "submit",
      position: 1,
      action: "CLICK",
      locator: { kind: "TEST_ID", value: "submit" },
    },
  ],
  criticalAction: {
    stepId: "submit",
    label: "Submit",
    request: { method: "POST", pathname: "/api/submit" },
  },
  successAssertion: { kind: "TEXT_VISIBLE", text: "Complete" },
});

const reportFields = (flow: NormalizedFlow) => {
  const startedAt = new Date().toISOString();
  return {
    summary: "Fixture execution report.",
    evidence: {
      finalUrl: "http://127.0.0.1:4173/complete",
      console: [],
      network: [
        {
          method: "POST",
          url: "http://127.0.0.1:4173/api/submit",
          status: 201,
          startedAt,
          completedAt: startedAt,
        },
      ],
      entries: [],
    },
    artifacts: [],
    executedSteps: [],
    assertion: {
      assertion: flow.successAssertion,
      status: "PASSED" as const,
      detail: "Passed.",
    },
    startedAt,
    completedAt: startedAt,
    durationMs: 5,
  };
};

const passingBaseline = (flow: NormalizedFlow): EngineExecutionReport => ({
  ...reportFields(flow),
  status: "PASS",
});

const failingBaseline = (flow: NormalizedFlow): EngineExecutionReport => ({
  ...reportFields(flow),
  status: "FAIL",
  failureOrigin: "TARGET_APP_FAILURE",
  assertion: {
    assertion: flow.successAssertion,
    status: "FAILED",
    detail: "Expected success state was absent.",
  },
});

const passingScenario = (
  request: ScenarioExecutionRequest,
): ScenarioExecutionReport => ({
  ...reportFields(request.flow),
  scenario: {
    id: request.scenario.id,
    name: request.scenario.name,
    family: request.scenario.family,
  },
  baselineValidation: "VALIDATED",
  status: "PASS",
});

const createPersistedFixture = async () => {
  const project = await createProject(
    prisma,
    {
      name: `Persistence ${randomUUID()}`,
      description: "Integration fixture",
      baseUrl: "http://127.0.0.1:4173",
    },
    allowedHosts,
  );
  const flow = await createFlow(
    prisma,
    project.id,
    createFixtureFlow(),
    allowedHosts,
  );
  const scenarios = await upsertScenarioPlan(
    prisma,
    flow.id,
    [
      {
        id: "double-action",
        name: "Double Action",
        family: "DOUBLE_ACTION",
        config: { family: "DOUBLE_ACTION", identifierField: "id" },
      },
    ],
    allowedHosts,
  );
  return { project, flow, scenario: scenarios[0]! };
};

afterAll(async () => {
  await prisma.$disconnect();
});

describe.sequential("Phase 4 persistence and orchestration", () => {
  it("round-trips projects, normalized flows, scenarios, reports, evidence, and artifacts", async () => {
    const fixture = await createPersistedFixture();
    try {
      const flow = await getFlow(prisma, fixture.flow.id);
      expect(flow.steps).toEqual(createFixtureFlow().steps);
      expect(flow.criticalAction).toEqual(createFixtureFlow().criticalAction);

      const secondUpsert = await upsertScenarioPlan(
        prisma,
        flow.id,
        [
          {
            id: "double-action",
            name: "Double Action",
            family: "DOUBLE_ACTION",
            config: { family: "DOUBLE_ACTION", identifierField: "id" },
          },
        ],
        allowedHosts,
      );
      expect(secondUpsert[0]?.id).toBe(fixture.scenario.id);
      expect((await listFlowScenarios(prisma, flow.id))).toHaveLength(1);

      const run = await prisma.testRun.create({
        data: {
          projectId: fixture.project.id,
          flowId: flow.id,
          status: "RUNNING",
          startedAt: new Date(),
        },
      });
      const artifactRoot = path.resolve(
        "..",
        "..",
        "artifacts",
        "tests",
        randomUUID(),
      );
      const tracePath = path.join(artifactRoot, "trace.zip");
      await mkdir(artifactRoot, { recursive: true });
      await writeFile(tracePath, "real test artifact");
      const report: EngineExecutionReport = {
        ...passingBaseline(flow),
        evidence: {
          ...passingBaseline(flow).evidence,
          entries: [
            {
              type: "ASSERTION",
              message: "Round-trip evidence",
              timestamp: new Date().toISOString(),
              metadata: { passed: true },
            },
          ],
        },
        artifacts: [
          { kind: "TRACE", path: tracePath, mimeType: "application/zip" },
        ],
      };
      const persisted = await persistExecutionReport(prisma, {
        testRunId: run.id,
        kind: "BASELINE",
        title: "Baseline",
        report,
        artifactRoot,
      });
      const readBack = await getResult(prisma, persisted.id);
      expect(readBack?.evidence.entries[0]?.message).toBe(
        "Round-trip evidence",
      );
      expect(readBack?.evidence.network[0]?.status).toBe(201);
      expect(readBack?.artifacts).toHaveLength(1);
      const artifact = await prisma.artifact.findFirst({
        where: { testResultId: persisted.id },
      });
      expect(artifact?.relativePath).toBe("trace.zip");
    } finally {
      await deleteProject(prisma, fixture.project.id);
    }
  });

  it("persists a failed baseline and skips every scenario", async () => {
    const fixture = await createPersistedFixture();
    let scenarioExecutions = 0;
    const baselineEngine: TestEngine = {
      execute: async (request) => failingBaseline(request.flow),
    };
    const scenarioEngine: ScenarioTestEngine = {
      execute: async (request) => {
        scenarioExecutions += 1;
        return passingScenario(request);
      },
    };
    try {
      const detail = await new RunOrchestrator({
        prisma,
        allowedHosts,
        artifactRoot: path.resolve("artifacts"),
        baselineEngine,
        scenarioEngine,
      }).runFlow(fixture.flow.id);
      expect(detail.status).toBe("BASELINE_FAILED");
      expect(detail.baselineResult?.status).toBe("FAIL");
      expect(detail.scenarioResults).toHaveLength(0);
      expect(scenarioExecutions).toBe(0);
    } finally {
      await deleteProject(prisma, fixture.project.id);
    }
  });

  it("marks an already-created run as ERROR when the engine throws", async () => {
    const fixture = await createPersistedFixture();
    const baselineEngine: TestEngine = {
      execute: async () => {
        throw new Error("Synthetic engine failure");
      },
    };
    const scenarioEngine: ScenarioTestEngine = {
      execute: async (request) => passingScenario(request),
    };
    try {
      await expect(
        new RunOrchestrator({
          prisma,
          allowedHosts,
          artifactRoot: path.resolve("..", "..", "artifacts"),
          baselineEngine,
          scenarioEngine,
        }).runFlow(fixture.flow.id),
      ).rejects.toMatchObject({ code: "RUN_EXECUTION_ERROR" });

      const failedRun = await prisma.testRun.findFirstOrThrow({
        where: { projectId: fixture.project.id },
        orderBy: { startedAt: "desc" },
      });
      expect(failedRun.status).toBe("ERROR");
      expect(failedRun.completedAt).not.toBeNull();
      expect(failedRun.errorMessage).toContain("Synthetic engine failure");
    } finally {
      await deleteProject(prisma, fixture.project.id);
    }
  });

  it("persists a completed sequential run and calculates its summary", async () => {
    const fixture = await createPersistedFixture();
    const executionOrder: string[] = [];
    const baselineEngine: TestEngine = {
      execute: async (request) => {
        executionOrder.push("baseline");
        return passingBaseline(request.flow);
      },
    };
    const scenarioEngine: ScenarioTestEngine = {
      execute: async (request) => {
        executionOrder.push(request.scenario.name);
        return passingScenario(request);
      },
    };
    try {
      const detail = await new RunOrchestrator({
        prisma,
        allowedHosts,
        artifactRoot: path.resolve("artifacts"),
        baselineEngine,
        scenarioEngine,
      }).runFlow(fixture.flow.id);
      expect(detail.status).toBe("COMPLETED");
      expect(detail.summary).toEqual({
        total: 1,
        passed: 1,
        failed: 0,
        needsReview: 0,
        errors: 0,
      });
      expect(detail.scenarioResults).toHaveLength(1);
      expect(executionOrder).toEqual(["baseline", "Double Action"]);
      expect(await prisma.testResult.count({ where: { testRunId: detail.id } })).toBe(2);
    } finally {
      await deleteProject(prisma, fixture.project.id);
    }
  });
});

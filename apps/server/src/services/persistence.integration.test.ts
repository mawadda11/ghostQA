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
import { createFlow, getFlow, listProjectFlows } from "./flows.js";
import { RunOrchestrator } from "./orchestrator.js";
import { createProject, deleteProject, getProject } from "./projects.js";
import { getResult, persistExecutionReport } from "./results.js";
import { getRunDetail, listProjectRuns, listRuns } from "./runs.js";
import {
  listFlowScenarios,
  replaceScenarioPlan,
  upsertScenarioPlan,
} from "./scenarios.js";

const allowedHosts = new Set(["localhost", "127.0.0.1"]);
const isolatedArtifactRoot = process.env["ARTIFACTS_ROOT"];
if (isolatedArtifactRoot === undefined) {
  throw new Error("Persistence tests require the isolated test artifact root.");
}

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
  const finalAssertion = flow.successAssertion;
  if (finalAssertion === undefined) throw new Error("Fixture requires final assertion.");
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
      assertion: finalAssertion,
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
    assertion: flow.successAssertion ?? { kind: "TEXT_VISIBLE", text: "Invalid fixture" },
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

describe.sequential("persistence and orchestration", () => {
  it("keeps multiple flows, plans, and runs isolated inside one project", async () => {
    const project = await createProject(
      prisma,
      {
        name: `Multi-flow ${randomUUID()}`,
        description: "Integration fixture",
        baseUrl: "http://127.0.0.1:4173",
      },
      allowedHosts,
    );
    try {
      const first = await createFlow(
        prisma,
        project.id,
        { ...createFixtureFlow(), name: "First journey" },
        allowedHosts,
      );
      await replaceScenarioPlan(
        prisma,
        first.id,
        [{ id: "double-action", name: "Double Action", family: "DOUBLE_ACTION", config: { family: "DOUBLE_ACTION" } }],
        allowedHosts,
      );
      const firstBefore = await getFlow(prisma, first.id);
      const firstPlanBefore = await listFlowScenarios(prisma, first.id);

      const second = await createFlow(
        prisma,
        project.id,
        { ...createFixtureFlow(), id: "second-input", name: "Second journey" },
        allowedHosts,
      );
      await replaceScenarioPlan(
        prisma,
        second.id,
        [{ id: "slow-response", name: "Slow Response", family: "SLOW_RESPONSE", config: { family: "SLOW_RESPONSE", checkpointStepId: "open", delayMs: 100 } }],
        allowedHosts,
      );
      const orchestrator = new RunOrchestrator({
        prisma,
        allowedHosts,
        artifactRoot: isolatedArtifactRoot,
        baselineEngine: { execute: async (request) => passingBaseline(request.flow) },
        scenarioEngine: { execute: async (request) => passingScenario(request) },
      });
      const firstRun = await orchestrator.runFlow(first.id);
      const secondRun = await orchestrator.runFlow(second.id);

      expect(await getFlow(prisma, first.id)).toEqual(firstBefore);
      expect(await listFlowScenarios(prisma, first.id)).toEqual(firstPlanBefore);
      expect((await listProjectFlows(prisma, project.id)).map(({ id }) => id)).toEqual(
        expect.arrayContaining([first.id, second.id]),
      );
      expect((await getProject(prisma, project.id)).flowCount).toBe(2);
      expect((await listProjectRuns(prisma, project.id)).map(({ flowId }) => flowId)).toEqual(
        expect.arrayContaining([firstRun.flowId, secondRun.flowId]),
      );
      expect(firstRun.flowId).toBe(first.id);
      expect(secondRun.flowId).toBe(second.id);
    } finally {
      await deleteProject(prisma, project.id);
    }
  });

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
      const artifactRoot = path.join(
        isolatedArtifactRoot,
        "persistence",
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

  it("round-trips a read-only flow with step assertions and replaces its visual test plan", async () => {
    const project = await createProject(
      prisma,
      {
        name: `Read only ${randomUUID()}`,
        baseUrl: "http://127.0.0.1:4173",
      },
      allowedHosts,
    );
    try {
      const readOnlyFlow: NormalizedFlow = {
        id: "read-only-input",
        name: "Read-only journey",
        steps: [
          { id: "start", position: 0, action: "NAVIGATE", path: "/" },
          { id: "result", position: 1, action: "WAIT_FOR_URL", url: "**/result" },
        ],
        assertions: [
          {
            id: "ready",
            afterStepId: "start",
            assertion: { kind: "TEXT_VISIBLE", text: "Ready" },
          },
          {
            id: "result-url",
            afterStepId: "result",
            assertion: { kind: "URL_MATCHES", value: "**/result" },
          },
        ],
      };
      const created = await createFlow(
        prisma,
        project.id,
        readOnlyFlow,
        allowedHosts,
      );
      const readBack = await getFlow(prisma, created.id);
      expect(readBack.criticalAction).toBeUndefined();
      expect(readBack.successAssertion).toBeUndefined();
      expect(readBack.assertions).toEqual(readOnlyFlow.assertions);

      await replaceScenarioPlan(
        prisma,
        created.id,
        [{
          id: "refresh",
          name: "Refresh",
          family: "REFRESH_BACK_NAVIGATION",
          config: {
            family: "REFRESH_BACK_NAVIGATION",
            mode: "REFRESH",
            checkpointStepId: "start",
            expectedState: {
              locator: { kind: "TEXT", text: "Ready" },
              state: "VISIBLE",
            },
          },
        }],
        allowedHosts,
      );
      await replaceScenarioPlan(
        prisma,
        created.id,
        [{
          id: "back",
          name: "Back Navigation",
          family: "REFRESH_BACK_NAVIGATION",
          config: {
            family: "REFRESH_BACK_NAVIGATION",
            mode: "BACK",
            checkpointStepId: "result",
            expectedState: {
              locator: { kind: "TEXT", text: "Ready" },
              state: "VISIBLE",
            },
          },
        }],
        allowedHosts,
      );
      expect(await listFlowScenarios(prisma, created.id)).toMatchObject([
        { scenarioKey: "back", family: "REFRESH_BACK_NAVIGATION" },
      ]);
    } finally {
      await deleteProject(prisma, project.id);
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
        artifactRoot: isolatedArtifactRoot,
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
          artifactRoot: isolatedArtifactRoot,
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

  it("rejects malformed persisted flow data before creating a run", async () => {
    const fixture = await createPersistedFixture();
    await prisma.flowStep.updateMany({
      where: { flowId: fixture.flow.id, stepKey: "open" },
      data: { configJson: "not-json" },
    });
    try {
      await expect(
        new RunOrchestrator({
          prisma,
          allowedHosts,
          artifactRoot: isolatedArtifactRoot,
          baselineEngine: {
            execute: async (request) => passingBaseline(request.flow),
          },
          scenarioEngine: {
            execute: async (request) => passingScenario(request),
          },
        }).runFlow(fixture.flow.id),
      ).rejects.toThrow(/malformed JSON/);
      expect(
        await prisma.testRun.count({
          where: { projectId: fixture.project.id },
        }),
      ).toBe(0);
    } finally {
      await deleteProject(prisma, fixture.project.id);
    }
  });

  it("rechecks target authorization before creating a run", async () => {
    const fixture = await createPersistedFixture();
    try {
      await expect(
        new RunOrchestrator({
          prisma,
          allowedHosts: new Set(["localhost"]),
          artifactRoot: isolatedArtifactRoot,
          baselineEngine: {
            execute: async (request) => passingBaseline(request.flow),
          },
          scenarioEngine: {
            execute: async (request) => passingScenario(request),
          },
        }).runFlow(fixture.flow.id),
      ).rejects.toMatchObject({ code: "HOST_NOT_ALLOWED" });
      expect(
        await prisma.testRun.count({
          where: { projectId: fixture.project.id },
        }),
      ).toBe(0);
    } finally {
      await deleteProject(prisma, fixture.project.id);
    }
  });

  it("finalizes ERROR after a malformed persisted scenario configuration", async () => {
    const fixture = await createPersistedFixture();
    await prisma.scenario.update({
      where: { id: fixture.scenario.id },
      data: { configJson: "{}" },
    });
    try {
      await expect(
        new RunOrchestrator({
          prisma,
          allowedHosts,
          artifactRoot: isolatedArtifactRoot,
          baselineEngine: {
            execute: async (request) => passingBaseline(request.flow),
          },
          scenarioEngine: {
            execute: async (request) => passingScenario(request),
          },
        }).runFlow(fixture.flow.id),
      ).rejects.toMatchObject({ code: "RUN_EXECUTION_ERROR" });

      const failedRun = await prisma.testRun.findFirstOrThrow({
        where: { projectId: fixture.project.id },
      });
      const detail = await getRunDetail(prisma, failedRun.id);
      expect(detail.status).toBe("ERROR");
      expect(detail.baselineStatus).toBe("PASS");
      expect(detail.baselineResult?.status).toBe("PASS");
      expect(detail.scenarioResults).toHaveLength(0);
    } finally {
      await deleteProject(prisma, fixture.project.id);
    }
  });

  it("preserves completed results and summary counts when a later scenario throws", async () => {
    const fixture = await createPersistedFixture();
    await upsertScenarioPlan(
      prisma,
      fixture.flow.id,
      [
        {
          id: "api-failure",
          name: "API Failure",
          family: "API_FAILURE",
          config: {
            family: "API_FAILURE",
            checkpointStepId: "open",
            statusCode: 500,
            brokenState: {
              locator: { kind: "TEST_ID", value: "submit" },
              state: "VISIBLE",
            },
          },
        },
      ],
      allowedHosts,
    );
    let scenarioNumber = 0;
    const baselineEngine: TestEngine = {
      execute: async (request) => passingBaseline(request.flow),
    };
    const scenarioEngine: ScenarioTestEngine = {
      execute: async (request) => passingScenario(request),
    };
    try {
      await expect(
        new RunOrchestrator({
          prisma,
          allowedHosts,
          artifactRoot: isolatedArtifactRoot,
          baselineEngine,
          scenarioEngine,
          hooks: {
            beforeScenario: async () => {
              scenarioNumber += 1;
              if (scenarioNumber === 2) {
                throw new Error("Synthetic later-scenario failure");
              }
            },
          },
        }).runFlow(fixture.flow.id),
      ).rejects.toMatchObject({ code: "RUN_EXECUTION_ERROR" });

      const failedRun = await prisma.testRun.findFirstOrThrow({
        where: { projectId: fixture.project.id },
        orderBy: { startedAt: "desc" },
      });
      const detail = await getRunDetail(prisma, failedRun.id);
      expect(detail.status).toBe("ERROR");
      expect(detail.baselineStatus).toBe("PASS");
      expect(detail.summary).toEqual({
        total: 1,
        passed: 1,
        failed: 0,
        needsReview: 0,
        errors: 0,
      });
      expect(detail.scenarioResults).toHaveLength(1);
      expect(detail.errorMessage).toContain("Synthetic later-scenario failure");
    } finally {
      await deleteProject(prisma, fixture.project.id);
    }
  });

  it("completes a baseline-only run when no scenarios are enabled", async () => {
    const fixture = await createPersistedFixture();
    await prisma.scenario.update({
      where: { id: fixture.scenario.id },
      data: { enabled: false },
    });
    let scenarioExecutions = 0;
    const baselineEngine: TestEngine = {
      execute: async (request) => passingBaseline(request.flow),
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
        artifactRoot: isolatedArtifactRoot,
        baselineEngine,
        scenarioEngine,
      }).runFlow(fixture.flow.id);
      expect(detail.status).toBe("COMPLETED");
      expect(detail.baselineStatus).toBe("PASS");
      expect(detail.summary).toEqual({
        total: 0,
        passed: 0,
        failed: 0,
        needsReview: 0,
        errors: 0,
      });
      expect(scenarioExecutions).toBe(0);
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
        artifactRoot: isolatedArtifactRoot,
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
      expect(await listRuns(prisma)).toContainEqual(
        expect.objectContaining({
          id: detail.id,
          projectName: fixture.project.name,
          flowName: fixture.flow.name,
        }),
      );
    } finally {
      await deleteProject(prisma, fixture.project.id);
    }
  });
});

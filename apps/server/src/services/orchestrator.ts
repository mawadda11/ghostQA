import path from "node:path";

import type { PrismaClient } from "@prisma/client";
import type {
  BaselineExecutionRequest,
  EngineExecutionReport,
  ScenarioExecutionReport,
  ScenarioExecutionRequest,
  TestRunDetail,
} from "@ghostqa/shared";
import type { ScenarioTestEngine, TestEngine } from "@ghostqa/test-engine";
import {
  PlaywrightBaselineEngine,
  PlaywrightScenarioEngine,
} from "@ghostqa/test-engine";

import { ApiError } from "../api/errors.js";
import { assertTargetUrlAllowed } from "../safety/target-hosts.js";
import {
  getFlowExecutionRecord,
  toNormalizedFlow,
} from "./flows.js";
import { persistExecutionReport } from "./results.js";
import { calculateRunSummary } from "./run-summary.js";
import { getRunDetail } from "./runs.js";
import { toScenarioDefinition } from "./scenarios.js";

export interface RunExecutionHooks {
  beforeBaseline?: () => Promise<void>;
  beforeScenario?: (scenarioId: string) => Promise<void>;
}

export interface RunOrchestratorOptions {
  prisma: PrismaClient;
  allowedHosts: ReadonlySet<string>;
  artifactRoot: string;
  baselineEngine?: TestEngine;
  scenarioEngine?: ScenarioTestEngine;
  hooks?: RunExecutionHooks;
}

export class RunOrchestrator {
  readonly #prisma: PrismaClient;
  readonly #allowedHosts: ReadonlySet<string>;
  readonly #artifactRoot: string;
  readonly #baselineEngine: TestEngine;
  readonly #scenarioEngine: ScenarioTestEngine;
  readonly #hooks: RunExecutionHooks;

  constructor(options: RunOrchestratorOptions) {
    this.#prisma = options.prisma;
    this.#allowedHosts = options.allowedHosts;
    this.#artifactRoot = path.resolve(options.artifactRoot);
    this.#baselineEngine = options.baselineEngine ?? new PlaywrightBaselineEngine();
    this.#scenarioEngine = options.scenarioEngine ?? new PlaywrightScenarioEngine();
    this.#hooks = options.hooks ?? {};
  }

  async runFlow(
    flowId: string,
    selectedScenarioIds?: readonly string[],
  ): Promise<TestRunDetail> {
    const record = await getFlowExecutionRecord(this.#prisma, flowId);
    const targetUrl = assertTargetUrlAllowed(
      record.project.targetBaseUrl,
      this.#allowedHosts,
    );
    const enabledScenarios = record.scenarios.filter((scenario) => scenario.enabled);
    const selected =
      selectedScenarioIds === undefined
        ? enabledScenarios
        : enabledScenarios.filter((scenario) =>
            selectedScenarioIds.includes(scenario.id),
          );
    if (
      selectedScenarioIds !== undefined &&
      (new Set(selectedScenarioIds).size !== selectedScenarioIds.length ||
        selected.length !== selectedScenarioIds.length)
    ) {
      throw new ApiError(
        400,
        "INVALID_REQUEST",
        "Selected scenarios must be unique, enabled, and belong to the flow.",
      );
    }

    const run = await this.#prisma.testRun.create({
      data: {
        projectId: record.projectId,
        flowId: record.id,
        status: "RUNNING",
        startedAt: new Date(),
        totalScenarios: selected.length,
      },
    });
    const flow = toNormalizedFlow(record);
    const target = {
      baseUrl: targetUrl.href,
      allowedHosts: [...this.#allowedHosts],
    };
    const runArtifactDirectory = path.join(this.#artifactRoot, "runs", run.id);

    try {
      await this.#hooks.beforeBaseline?.();
      const baselineRequest: BaselineExecutionRequest = {
        kind: "BASELINE",
        runId: run.id,
        target,
        flow,
        artifactDirectory: path.join(runArtifactDirectory, "baseline"),
      };
      const baseline = await this.#baselineEngine.execute(baselineRequest);
      await persistExecutionReport(this.#prisma, {
        testRunId: run.id,
        kind: "BASELINE",
        title: "Baseline",
        report: baseline,
        artifactRoot: this.#artifactRoot,
      });

      if (baseline.status !== "PASS") {
        await this.#prisma.testRun.update({
          where: { id: run.id },
          data: {
            status: baseline.status === "ERROR" ? "ERROR" : "BASELINE_FAILED",
            baselineStatus: baseline.status,
            totalScenarios: 0,
            completedAt: new Date(),
            ...(baseline.status === "ERROR"
              ? { errorMessage: baseline.summary }
              : {}),
          },
        });
        return getRunDetail(this.#prisma, run.id);
      }

      const scenarioReports: ScenarioExecutionReport[] = [];
      for (const scenario of selected) {
        await this.#hooks.beforeScenario?.(scenario.id);
        const scenarioRequest: ScenarioExecutionRequest = {
          kind: "SCENARIO",
          runId: run.id,
          target,
          flow,
          artifactDirectory: path.join(runArtifactDirectory, scenario.id),
          baselineValidation: { status: "PASS", runId: run.id },
          scenario: toScenarioDefinition(scenario),
        };
        const report = await this.#scenarioEngine.execute(scenarioRequest);
        scenarioReports.push(report);
        await persistExecutionReport(this.#prisma, {
          testRunId: run.id,
          scenarioId: scenario.id,
          kind: "SCENARIO",
          scenarioFamily: scenario.family,
          title: scenario.name,
          report,
          artifactRoot: this.#artifactRoot,
        });
      }

      const summary = calculateRunSummary(
        scenarioReports.map((report) => report.status),
      );
      await this.#prisma.testRun.update({
        where: { id: run.id },
        data: {
          status: "COMPLETED",
          baselineStatus: baseline.status,
          completedAt: new Date(),
          totalScenarios: summary.total,
          passedCount: summary.passed,
          failedCount: summary.failed,
          needsReviewCount: summary.needsReview,
          errorCount: summary.errors,
        },
      });
      return getRunDetail(this.#prisma, run.id);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await this.#prisma.testRun.update({
        where: { id: run.id },
        data: {
          status: "ERROR",
          completedAt: new Date(),
          errorMessage: message.slice(0, 20_000),
        },
      });
      throw new ApiError(
        500,
        "RUN_EXECUTION_ERROR",
        `Run ${run.id} stopped because GhostQA could not complete execution.`,
      );
    }
  }
}

export type { EngineExecutionReport, ScenarioExecutionReport };

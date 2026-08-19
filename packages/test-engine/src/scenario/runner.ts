import { mkdir } from "node:fs/promises";

import type {
  ArtifactDescriptor,
  EvidenceEntry,
  ExecutionErrorObservation,
  ExecutedStep,
  ScenarioExecutionReport,
  ScenarioExecutionRequest,
  SuccessAssertionResult,
} from "@ghostqa/shared";
import { chromium } from "playwright";
import type { Browser, BrowserContext, Page } from "playwright";

import { createExecutionArtifactPaths } from "../baseline/artifacts.js";
import { primaryFlowAssertion } from "../baseline/flow-assertions.js";
import { BrowserEvidenceCollector } from "../runtime/browser-evidence.js";
import { ApiFailureExecutor } from "./api-failure.js";
import { consoleEvidenceEntries } from "./evidence.js";
import { ScenarioFlowStepError } from "./flow.js";
import { DoubleActionExecutor } from "./double-action.js";
import { NavigationExecutor } from "./navigation.js";
import { SessionExpiryExecutor } from "./session-expiry.js";
import { SlowResponseExecutor } from "./slow-response.js";
import type { ScenarioExecutor, ScenarioOutcome } from "./types.js";
import { validateScenarioRequest } from "./validation.js";

const nowIso = (): string => new Date().toISOString();

const executorFor = (request: ScenarioExecutionRequest): ScenarioExecutor => {
  switch (request.scenario.config.family) {
    case "DOUBLE_ACTION":
      return new DoubleActionExecutor();
    case "API_FAILURE":
      return new ApiFailureExecutor();
    case "SLOW_RESPONSE":
      return new SlowResponseExecutor();
    case "REFRESH_BACK_NAVIGATION":
      return new NavigationExecutor();
    case "SESSION_EXPIRY":
      return new SessionExpiryExecutor();
  }
};

const notEvaluatedAssertion = (
  request: ScenarioExecutionRequest,
  detail = "The success assertion was not evaluated.",
): SuccessAssertionResult => ({
  assertion: primaryFlowAssertion(request.flow),
  status: "NOT_EVALUATED",
  detail,
});

const toExecutionError = (error: unknown): ExecutionErrorObservation => {
  const normalized =
    error instanceof Error
      ? { name: error.name, message: error.message }
      : { name: "Error", message: String(error) };
  return {
    source: error instanceof ScenarioFlowStepError ? "FLOW_STEP" : "ENGINE",
    ...normalized,
    ...(error instanceof ScenarioFlowStepError
      ? { stepId: error.stepId }
      : {}),
  };
};

const baselineRequiredReport = (
  request: ScenarioExecutionRequest,
  startedAt: string,
  startedAtMs: number,
): ScenarioExecutionReport => ({
  scenario: {
    id: request.scenario.id,
    name: request.scenario.name,
    family: request.scenario.family,
  },
  status: "BASELINE_REQUIRED",
  baselineValidation: "REQUIRED",
  summary: "A passing baseline validation is required before scenario execution.",
  evidence: { console: [], network: [], entries: [] },
  artifacts: [],
  executedSteps: [],
  assertion: notEvaluatedAssertion(request, "Scenario execution was skipped."),
  startedAt,
  completedAt: nowIso(),
  durationMs: Date.now() - startedAtMs,
});

export class PlaywrightScenarioEngine {
  async execute(
    request: ScenarioExecutionRequest,
  ): Promise<ScenarioExecutionReport> {
    const startedAt = nowIso();
    const startedAtMs = Date.now();
    const collector = new BrowserEvidenceCollector();
    const evidence: EvidenceEntry[] = [];
    const artifacts: ArtifactDescriptor[] = [];
    const executedSteps: ExecutedStep[] = [];
    let assertion = notEvaluatedAssertion(request);
    let executionError: ExecutionErrorObservation | undefined;
    let outcome: ScenarioOutcome | undefined;
    let browser: Browser | undefined;
    let context: BrowserContext | undefined;
    let page: Page | undefined;
    let finalUrl: string | undefined;
    let tracingStarted = false;
    let engineError = false;
    let artifactPaths:
      | ReturnType<typeof createExecutionArtifactPaths>
      | undefined;

    try {
      validateScenarioRequest(request);
      if (request.baselineValidation.status !== "PASS") {
        return baselineRequiredReport(request, startedAt, startedAtMs);
      }

      artifactPaths = createExecutionArtifactPaths(request.artifactDirectory);
      await mkdir(artifactPaths.directory, { recursive: true });
      browser = await chromium.launch({ headless: true });
      context = await browser.newContext();
      await context.tracing.start({
        screenshots: true,
        snapshots: true,
        sources: true,
      });
      tracingStarted = true;
      page = await context.newPage();
      collector.attach(page);

      outcome = await executorFor(request).execute({
        request,
        page,
        browserContext: context,
        collector,
        executedSteps,
        evidence,
      });
      assertion = outcome.assertion;
      finalUrl = page.url();
    } catch (error) {
      engineError = true;
      executionError = toExecutionError(error);
      finalUrl = page?.url();
    } finally {
      if (
        page !== undefined &&
        artifactPaths !== undefined &&
        (outcome?.classification.status === "FAIL" ||
          outcome?.classification.status === "NEEDS_REVIEW")
      ) {
        try {
          await page.screenshot({
            path: artifactPaths.screenshot,
            fullPage: true,
          });
          artifacts.push({
            kind: "SCREENSHOT",
            path: artifactPaths.screenshot,
            mimeType: "image/png",
          });
        } catch (error) {
          engineError = true;
          executionError ??= toExecutionError(error);
        }
      }

      if (
        context !== undefined &&
        tracingStarted &&
        artifactPaths !== undefined
      ) {
        try {
          await context.tracing.stop({ path: artifactPaths.trace });
          artifacts.push({
            kind: "TRACE",
            path: artifactPaths.trace,
            mimeType: "application/zip",
          });
        } catch (error) {
          engineError = true;
          executionError ??= toExecutionError(error);
        }
      }

      try {
        await context?.close();
      } catch (error) {
        engineError = true;
        executionError ??= toExecutionError(error);
      }
      try {
        await browser?.close();
      } catch (error) {
        engineError = true;
        executionError ??= toExecutionError(error);
      }
    }

    evidence.push(...consoleEvidenceEntries(collector.console));
    const completedAt = nowIso();
    const reportBase = {
      scenario: {
        id: request.scenario.id,
        name: request.scenario.name,
        family: request.scenario.family,
      },
      baselineValidation: "VALIDATED" as const,
      evidence: {
        ...(finalUrl === undefined ? {} : { finalUrl }),
        console: collector.console,
        network: collector.network,
        entries: evidence,
      },
      artifacts,
      executedSteps,
      assertion,
      ...(executionError === undefined ? {} : { executionError }),
      startedAt,
      completedAt,
      durationMs: Date.now() - startedAtMs,
    };

    if (engineError || outcome === undefined) {
      return {
        ...reportBase,
        status: "ERROR",
        failureOrigin: "GHOSTQA_ENGINE_FAILURE",
        summary: `GhostQA could not execute the scenario: ${executionError?.message ?? "unknown engine error"}`,
      };
    }

    switch (outcome.classification.status) {
      case "PASS":
        return {
          ...reportBase,
          status: "PASS",
          summary: outcome.classification.summary,
        };
      case "FAIL":
        return {
          ...reportBase,
          status: "FAIL",
          failureOrigin: "TARGET_APP_FAILURE",
          summary: outcome.classification.summary,
        };
      case "NEEDS_REVIEW":
        return {
          ...reportBase,
          status: "NEEDS_REVIEW",
          summary: outcome.classification.summary,
        };
    }
  }
}

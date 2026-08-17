import { mkdir } from "node:fs/promises";

import type {
  ArtifactDescriptor,
  BaselineExecutionRequest,
  ConsoleObservation,
  EngineExecutionReport,
  ExecutedStep,
  ExecutionErrorObservation,
  NetworkObservation,
  SuccessAssertionResult,
} from "@ghostqa/shared";
import { chromium } from "playwright";
import type { Browser, BrowserContext, Page, Request } from "playwright";

import { createBaselineArtifactPaths } from "./artifacts.js";
import { classifyBaselineResult } from "./classification.js";
import { executeFlowStep } from "./steps.js";
import { evaluateSuccessAssertion } from "./success-assertion.js";
import { validateBaselineRequest } from "./validation.js";

const nowIso = (): string => new Date().toISOString();

const toExecutionError = (
  source: ExecutionErrorObservation["source"],
  error: unknown,
  stepId?: string,
): ExecutionErrorObservation => {
  const normalized =
    error instanceof Error
      ? { name: error.name, message: error.message }
      : { name: "Error", message: String(error) };

  return {
    source,
    ...normalized,
    ...(stepId === undefined ? {} : { stepId }),
  };
};

const attachObservers = (
  page: Page,
  network: NetworkObservation[],
  consoleErrors: ConsoleObservation[],
): void => {
  const requestStartTimes = new Map<Request, string>();

  page.on("request", (request) => {
    requestStartTimes.set(request, nowIso());
  });

  page.on("response", (response) => {
    const request = response.request();
    network.push({
      method: request.method(),
      url: request.url(),
      status: response.status(),
      startedAt: requestStartTimes.get(request) ?? nowIso(),
      completedAt: nowIso(),
    });
    requestStartTimes.delete(request);
  });

  page.on("requestfailed", (request) => {
    network.push({
      method: request.method(),
      url: request.url(),
      failureText: request.failure()?.errorText ?? "Request failed",
      startedAt: requestStartTimes.get(request) ?? nowIso(),
      completedAt: nowIso(),
    });
    requestStartTimes.delete(request);
  });

  page.on("console", (message) => {
    if (message.type() === "error") {
      consoleErrors.push({
        source: "CONSOLE",
        level: "error",
        text: message.text(),
        timestamp: nowIso(),
      });
    }
  });

  page.on("pageerror", (error) => {
    consoleErrors.push({
      source: "PAGE_ERROR",
      level: "error",
      text: error.message,
      timestamp: nowIso(),
    });
  });
};

const summaryFor = (
  status: "PASS" | "FAIL" | "ERROR",
  assertion: SuccessAssertionResult,
  executionError: ExecutionErrorObservation | undefined,
): string => {
  if (status === "PASS") {
    return "Baseline completed and the configured success assertion passed.";
  }

  if (status === "FAIL") {
    return executionError?.source === "FLOW_STEP"
      ? `Baseline flow step failed: ${executionError.message}`
      : `Baseline success assertion failed: ${assertion.detail}`;
  }

  return `GhostQA could not execute the baseline: ${executionError?.message ?? "unknown engine error"}`;
};

export class PlaywrightBaselineEngine {
  async execute(
    request: BaselineExecutionRequest,
  ): Promise<EngineExecutionReport> {
    const startedAt = nowIso();
    const startedAtMs = Date.now();
    const network: NetworkObservation[] = [];
    const consoleErrors: ConsoleObservation[] = [];
    const artifacts: ArtifactDescriptor[] = [];
    const executedSteps: ExecutedStep[] = [];
    let assertion: SuccessAssertionResult = {
      assertion: request.flow.successAssertion,
      status: "NOT_EVALUATED",
      detail: "The success assertion was not evaluated.",
    };
    let executionError: ExecutionErrorObservation | undefined;
    let engineError = false;
    let browser: Browser | undefined;
    let context: BrowserContext | undefined;
    let page: Page | undefined;
    let tracingStarted = false;
    let artifactPaths: ReturnType<typeof createBaselineArtifactPaths> | undefined;

    try {
      validateBaselineRequest(request);
      artifactPaths = createBaselineArtifactPaths(request.artifactDirectory);
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
      attachObservers(page, network, consoleErrors);

      for (const step of request.flow.steps) {
        const stepStartedAt = nowIso();
        try {
          await executeFlowStep(page, request.target.baseUrl, step);
          executedSteps.push({
            stepId: step.id,
            position: step.position,
            action: step.action,
            status: "PASSED",
            startedAt: stepStartedAt,
            completedAt: nowIso(),
          });
        } catch (error) {
          executionError = toExecutionError("FLOW_STEP", error, step.id);
          executedSteps.push({
            stepId: step.id,
            position: step.position,
            action: step.action,
            status: "FAILED",
            startedAt: stepStartedAt,
            completedAt: nowIso(),
            error: executionError.message,
          });
          break;
        }
      }

      if (executionError === undefined) {
        assertion = await evaluateSuccessAssertion(
          page,
          request.flow.successAssertion,
        );
      }
    } catch (error) {
      engineError = true;
      executionError = toExecutionError("ENGINE", error);
    } finally {
      if (page !== undefined && artifactPaths !== undefined) {
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
          executionError ??= toExecutionError("ENGINE", error);
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
          executionError ??= toExecutionError("ENGINE", error);
        }
      }

      try {
        await context?.close();
      } catch (error) {
        engineError = true;
        executionError ??= toExecutionError("ENGINE", error);
      }

      try {
        await browser?.close();
      } catch (error) {
        engineError = true;
        executionError ??= toExecutionError("ENGINE", error);
      }
    }

    const classification = classifyBaselineResult({
      assertionStatus: assertion.status,
      stepFailed: executionError?.source === "FLOW_STEP",
      engineError,
    });
    const completedAt = nowIso();
    const baseReport = {
      summary: summaryFor(
        classification.status,
        assertion,
        executionError,
      ),
      evidence: {
        ...(page === undefined ? {} : { finalUrl: page.url() }),
        console: consoleErrors,
        network,
      },
      artifacts,
      executedSteps,
      assertion,
      ...(executionError === undefined ? {} : { executionError }),
      startedAt,
      completedAt,
      durationMs: Date.now() - startedAtMs,
    };

    return {
      ...baseReport,
      ...classification,
    };
  }
}

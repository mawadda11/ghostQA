import { mkdir } from "node:fs/promises";

import type {
  ArtifactDescriptor,
  BaselineExecutionRequest,
  EngineExecutionReport,
  EvidenceEntry,
  ExecutedStep,
  ExecutionErrorObservation,
  FlowAssertionResult,
  SuccessAssertionResult,
} from "@ghostqa/shared";
import { chromium } from "playwright";
import type { Browser, BrowserContext, Page } from "playwright";

import { BrowserEvidenceCollector } from "../runtime/browser-evidence.js";
import { createBaselineArtifactPaths } from "./artifacts.js";
import { classifyBaselineResult } from "./classification.js";
import { executeFlowStep } from "./steps.js";
import { evaluateSuccessAssertion } from "./success-assertion.js";
import { validateBaselineRequest } from "./validation.js";
import {
  assertionsAfterStep,
  orderedFlowAssertions,
  primaryFlowAssertion,
} from "./flow-assertions.js";

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

const summaryFor = (
  status: "PASS" | "FAIL" | "ERROR",
  assertion: SuccessAssertionResult,
  executionError: ExecutionErrorObservation | undefined,
): string => {
  if (status === "PASS") {
    return "Baseline completed and all configured flow assertions passed.";
  }

  if (status === "FAIL") {
    return executionError?.source === "FLOW_STEP"
      ? `Baseline flow step failed: ${executionError.message}`
      : `Baseline assertion failed: ${assertion.detail}`;
  }

  return `GhostQA could not execute the baseline: ${executionError?.message ?? "unknown engine error"}`;
};

export class PlaywrightBaselineEngine {
  async execute(
    request: BaselineExecutionRequest,
  ): Promise<EngineExecutionReport> {
    const startedAt = nowIso();
    const startedAtMs = Date.now();
    const collector = new BrowserEvidenceCollector();
    const artifacts: ArtifactDescriptor[] = [];
    const executedSteps: ExecutedStep[] = [];
    const evidenceEntries: EvidenceEntry[] = [];
    const assertionDefinitions = orderedFlowAssertions(request.flow);
    let assertions: FlowAssertionResult[] = assertionDefinitions.map(
      (definition) => ({
        id: definition.id,
        ...(definition.afterStepId === undefined
          ? {}
          : { afterStepId: definition.afterStepId }),
        assertion: definition.assertion,
        status: "NOT_EVALUATED",
        detail: "The assertion was not evaluated.",
      }),
    );
    const initialAssertion =
      request.flow.successAssertion ??
      request.flow.assertions?.[request.flow.assertions.length - 1]?.assertion ??
      ({ kind: "TEXT_VISIBLE", text: "Invalid flow assertion" } as const);
    let assertion: SuccessAssertionResult = {
      assertion: initialAssertion,
      status: "NOT_EVALUATED",
      detail: "The flow assertion was not evaluated.",
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
      collector.attach(page);

      let attachedAssertionFailed = false;
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
          for (const attached of assertionsAfterStep(
            request.flow.assertions,
            step.id,
          )) {
            const evaluated = await evaluateSuccessAssertion(
              page,
              attached.assertion,
            );
            const result: FlowAssertionResult = {
              id: attached.id,
              afterStepId: attached.afterStepId,
              ...evaluated,
            };
            assertions = assertions.map((candidate) =>
              candidate.id === attached.id ? result : candidate,
            );
            assertion = evaluated;
            evidenceEntries.push({
              type: "ASSERTION",
              message: `Flow assertion "${attached.id}" ${evaluated.status.toLowerCase()}.`,
              timestamp: nowIso(),
              metadata: {
                assertionId: attached.id,
                afterStepId: attached.afterStepId,
                status: evaluated.status,
              },
            });
            if (evaluated.status === "FAILED") {
              attachedAssertionFailed = true;
              break;
            }
          }
          if (attachedAssertionFailed) break;
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

      if (
        executionError === undefined &&
        !attachedAssertionFailed &&
        request.flow.successAssertion !== undefined
      ) {
        assertion = await evaluateSuccessAssertion(
          page,
          request.flow.successAssertion,
        );
        const finalResult: FlowAssertionResult = {
          id: "final-success-assertion",
          ...assertion,
        };
        assertions = assertions.map((candidate) =>
          candidate.id === finalResult.id ? finalResult : candidate,
        );
        evidenceEntries.push({
          type: "ASSERTION",
          message: `Final flow assertion ${assertion.status.toLowerCase()}.`,
          timestamp: nowIso(),
          metadata: { status: assertion.status },
        });
      } else if (
        executionError === undefined &&
        !attachedAssertionFailed &&
        request.flow.successAssertion === undefined
      ) {
        assertion = {
          assertion: primaryFlowAssertion(request.flow),
          status: assertions.every(({ status }) => status === "PASSED")
            ? "PASSED"
            : "NOT_EVALUATED",
          detail: "All configured step-bound assertions were satisfied.",
        };
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
        console: collector.console,
        network: collector.network,
        entries: evidenceEntries,
      },
      artifacts,
      executedSteps,
      assertions,
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

import type {
  EvidenceEntry,
  FlowStep,
  NetworkRequestMatcher,
  SuccessAssertion,
  SuccessAssertionResult,
} from "@ghostqa/shared";
import type { Page, Response } from "playwright";

import { evaluateSuccessAssertion } from "../baseline/success-assertion.js";
import { createEvidenceEntry } from "./evidence.js";
import { executeSteps } from "./flow.js";
import { requestMatches } from "./request-matching.js";
import type { ScenarioExecutionContext } from "./types.js";

export interface TimedResponse {
  response: Response;
  observedAtMs: number;
}

export const criticalStep = (context: ScenarioExecutionContext): FlowStep => {
  const step = context.request.flow.steps.find(
    (candidate) =>
      candidate.id === context.request.flow.criticalAction.stepId,
  );
  if (step?.action !== "CLICK") {
    throw new Error("The configured critical action is not a CLICK step.");
  }
  return step;
};

export const replayBeforeCritical = async (
  context: ScenarioExecutionContext,
): Promise<void> => {
  const criticalIndex = context.request.flow.steps.findIndex(
    (step) => step.id === context.request.flow.criticalAction.stepId,
  );
  await executeSteps(
    context.page,
    context.request.target.baseUrl,
    context.request.flow.steps.slice(0, criticalIndex),
    context.executedSteps,
  );
};

export const replayThroughCheckpoint = async (
  context: ScenarioExecutionContext,
  checkpointStepId: string,
): Promise<void> => {
  const checkpointIndex = context.request.flow.steps.findIndex(
    (step) => step.id === checkpointStepId,
  );
  await executeSteps(
    context.page,
    context.request.target.baseUrl,
    context.request.flow.steps.slice(0, checkpointIndex + 1),
    context.executedSteps,
  );
};

export const executeCriticalStep = async (
  context: ScenarioExecutionContext,
  options?: { clickNoWaitAfter?: boolean },
): Promise<void> => {
  await executeSteps(
    context.page,
    context.request.target.baseUrl,
    [criticalStep(context)],
    context.executedSteps,
    options,
  );
};

const assertionWithTimeout = (
  assertion: SuccessAssertion,
  timeoutMs: number | undefined,
): SuccessAssertion =>
  timeoutMs === undefined ? assertion : { ...assertion, timeoutMs };

export const evaluateAndRecordAssertion = async (
  context: ScenarioExecutionContext,
  timeoutMs?: number,
): Promise<SuccessAssertionResult> => {
  const result = await evaluateSuccessAssertion(
    context.page,
    assertionWithTimeout(context.request.flow.successAssertion, timeoutMs),
  );
  context.evidence.push(
    createEvidenceEntry(
      "ASSERTION",
      `Success assertion ${result.status.toLowerCase()}.`,
      { status: result.status, detail: result.detail },
    ),
  );
  return result;
};

export const notEvaluatedAssertion = (
  context: ScenarioExecutionContext,
): SuccessAssertionResult => ({
  assertion: context.request.flow.successAssertion,
  status: "NOT_EVALUATED",
  detail: "The baseline success assertion does not apply at this scenario checkpoint.",
});

export const collectMatchingResponses = (
  page: Page,
  matcher: NetworkRequestMatcher,
  expectedCount: number,
  timeoutMs: number,
): Promise<readonly TimedResponse[]> =>
  new Promise((resolve) => {
    const collected: TimedResponse[] = [];
    const finish = (): void => {
      clearTimeout(timer);
      page.off("response", listener);
      resolve(collected);
    };
    const listener = (response: Response): void => {
      const request = response.request();
      if (requestMatches(request.method(), request.url(), matcher)) {
        collected.push({ response, observedAtMs: Date.now() });
        if (collected.length >= expectedCount) finish();
      }
    };
    const timer = setTimeout(finish, timeoutMs);
    page.on("response", listener);
  });

export const responseEvidence = (
  matcher: NetworkRequestMatcher,
  responses: readonly TimedResponse[],
): EvidenceEntry[] =>
  responses.flatMap(({ response, observedAtMs }) => [
    createEvidenceEntry("HTTP_REQUEST", "Configured HTTP request observed.", {
      method: response.request().method(),
      pathname: new URL(response.url()).pathname,
      observedAtMs,
    }),
    createEvidenceEntry("HTTP_RESPONSE", "Configured HTTP response observed.", {
      method: matcher.method.toUpperCase(),
      pathname: matcher.pathname,
      status: response.status(),
    }),
  ]);

export const successfulResponses = (
  responses: readonly TimedResponse[],
): readonly TimedResponse[] =>
  responses.filter(
    ({ response }) => response.status() >= 200 && response.status() < 300,
  );

export const extractResponseIdentifier = async (
  response: Response,
  field: string | undefined,
): Promise<string | undefined> => {
  if (field === undefined) return undefined;
  try {
    const body: unknown = await response.json();
    if (typeof body !== "object" || body === null || Array.isArray(body)) {
      return undefined;
    }
    const value = (body as Record<string, unknown>)[field];
    return typeof value === "string" || typeof value === "number"
      ? String(value).slice(0, 128)
      : undefined;
  } catch {
    return undefined;
  }
};

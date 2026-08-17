import type { SlowResponseScenarioConfig } from "@ghostqa/shared";
import type { Route } from "playwright";

import { classifySlowResponse } from "./classification.js";
import { createEvidenceEntry } from "./evidence.js";
import {
  collectMatchingResponses,
  evaluateAndRecordAssertion,
  executeCriticalStep,
  replayThroughCheckpoint,
  responseEvidence,
  successfulResponses,
} from "./execution-helpers.js";
import { observeElement } from "./observations.js";
import { requestMatches } from "./request-matching.js";
import type {
  ScenarioExecutionContext,
  ScenarioExecutor,
  ScenarioOutcome,
} from "./types.js";
import { resolveScenarioRequestMatcher } from "./validation.js";

const waitForSignal = async (
  signal: Promise<void>,
  timeoutMs: number,
): Promise<void> => {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([
      signal,
      new Promise<never>((_, reject) => {
        timeout = setTimeout(
          () => reject(new Error("Timed out waiting for the delayed request.")),
          timeoutMs,
        );
      }),
    ]);
  } finally {
    if (timeout !== undefined) clearTimeout(timeout);
  }
};

export class SlowResponseExecutor implements ScenarioExecutor {
  async execute(context: ScenarioExecutionContext): Promise<ScenarioOutcome> {
    const config = context.request.scenario.config as SlowResponseScenarioConfig;
    const matcher = resolveScenarioRequestMatcher(context.request);
    if (matcher === undefined) throw new Error("Slow Response request is missing.");

    await replayThroughCheckpoint(context, config.checkpointStepId);
    let releaseInjection: (() => void) | undefined;
    const injectionStarted = new Promise<void>((resolve) => {
      releaseInjection = resolve;
    });
    let injectionCount = 0;
    const handler = async (route: Route): Promise<void> => {
      const request = route.request();
      if (
        injectionCount === 0 &&
        requestMatches(request.method(), request.url(), matcher)
      ) {
        injectionCount += 1;
        context.evidence.push(
          createEvidenceEntry(
            "SCENARIO_INJECTION",
            `Delayed the configured request by ${config.delayMs} ms.`,
            {
              method: matcher.method.toUpperCase(),
              pathname: matcher.pathname,
              delayMs: config.delayMs,
            },
          ),
        );
        releaseInjection?.();
        await new Promise<void>((resolve) => setTimeout(resolve, config.delayMs));
        await route.continue();
        return;
      }
      await route.continue();
    };
    await context.page.route("**/*", handler);
    const responsesPromise = collectMatchingResponses(
      context.page,
      matcher,
      2,
      config.delayMs + 4_000,
    );
    try {
      await executeCriticalStep(context);
      await waitForSignal(injectionStarted, 2_000);
      const repeatability =
        config.repeatabilityObservation === undefined
          ? undefined
          : await observeElement(
              context.page,
              config.repeatabilityObservation,
            );
      if (repeatability !== undefined) context.evidence.push(repeatability.evidence);
      const prevention =
        config.preventionObservation === undefined
          ? undefined
          : await observeElement(context.page, config.preventionObservation);
      if (prevention !== undefined) context.evidence.push(prevention.evidence);

      const responses = await responsesPromise;
      context.evidence.push(...responseEvidence(matcher, responses));
      const successful = successfulResponses(responses);
      context.evidence.push(
        createEvidenceEntry(
          "DUPLICATE_REQUEST",
          `${successful.length} successful matching request(s) completed during the delay scenario.`,
          { count: responses.length, successfulCount: successful.length },
        ),
      );
      const assertion = await evaluateAndRecordAssertion(context);
      return {
        classification: classifySlowResponse({
          successfulMutationCount: successful.length,
          assertionPassed: assertion.status === "PASSED",
          repeatabilityMatched: repeatability?.matched ?? false,
          preventionMatched: prevention?.matched ?? false,
        }),
        assertion,
      };
    } finally {
      await context.page.unroute("**/*", handler);
    }
  }
}

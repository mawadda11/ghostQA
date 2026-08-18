import type { DoubleActionScenarioConfig } from "@ghostqa/shared";

import { classifyDoubleAction } from "./classification.js";
import { createEvidenceEntry } from "./evidence.js";
import {
  collectMatchingResponses,
  criticalStep,
  evaluateAndRecordAssertion,
  executeRapidCriticalClicks,
  extractResponseIdentifier,
  replayBeforeCritical,
  responseEvidence,
  successfulResponses,
} from "./execution-helpers.js";
import type {
  ScenarioExecutionContext,
  ScenarioExecutor,
  ScenarioOutcome,
} from "./types.js";
import { resolveScenarioRequestMatcher } from "./validation.js";

export class DoubleActionExecutor implements ScenarioExecutor {
  async execute(context: ScenarioExecutionContext): Promise<ScenarioOutcome> {
    const config = context.request.scenario.config as DoubleActionScenarioConfig;
    const matcher = resolveScenarioRequestMatcher(context.request);
    if (matcher === undefined) throw new Error("Double Action request is missing.");

    await replayBeforeCritical(context);
    const step = criticalStep(context);
    if (step.action !== "CLICK") throw new Error("Critical step must be CLICK.");

    const responsesPromise = collectMatchingResponses(
      context.page,
      matcher,
      2,
      config.responseTimeoutMs ?? 4_000,
    );
    context.evidence.push(
      createEvidenceEntry(
        "SCENARIO_INJECTION",
        "Critical action triggered twice in rapid succession.",
        { stepId: step.id },
      ),
    );

    await executeRapidCriticalClicks(context, 2);
    const responses = await responsesPromise;
    context.evidence.push(...responseEvidence(matcher, responses));

    const successful = successfulResponses(responses);
    const identifiers = (
      await Promise.all(
        successful.map(({ response }) =>
          extractResponseIdentifier(response, config.identifierField),
        ),
      )
    ).filter((value): value is string => value !== undefined);
    const distinctIdentifiers = new Set(identifiers);
    const firstResponse = responses[0];
    const lastResponse = responses.at(-1);
    const observedWindowMs =
      firstResponse === undefined || lastResponse === undefined
        ? undefined
        : lastResponse.observedAtMs - firstResponse.observedAtMs;
    context.evidence.push(
      createEvidenceEntry(
        "DUPLICATE_REQUEST",
        `${successful.length} successful matching mutation request(s) observed.`,
        {
          count: responses.length,
          successfulCount: successful.length,
          identifiers,
          distinctIdentifierCount: distinctIdentifiers.size,
          ...(observedWindowMs === undefined ? {} : { observedWindowMs }),
        },
      ),
    );

    const assertion = await evaluateAndRecordAssertion(context);
    return {
      classification: classifyDoubleAction({
        successfulMutationCount: successful.length,
        distinctIdentifierCount: distinctIdentifiers.size,
        assertionPassed: assertion.status === "PASSED",
      }),
      assertion,
    };
  }
}

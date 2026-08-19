import type { DoubleActionScenarioConfig } from "@ghostqa/shared";

import { classifyDoubleAction } from "./classification.js";
import { createEvidenceEntry } from "./evidence.js";
import {
  collectMatchingResponses,
  criticalStep,
  evaluateAndRecordAssertion,
  executeRapidCriticalClicks,
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
import { inspectResponseIdentifiers } from "./response-identifiers.js";

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
    const identifierProof = await inspectResponseIdentifiers(
      successful.map(({ response }) => response),
      {
        ...(config.identifierField === undefined
          ? {}
          : { configuredField: config.identifierField }),
        capturedInputValues: context.request.flow.steps.flatMap((flowStep) =>
          flowStep.action === "FILL" || flowStep.action === "SELECT_OPTION"
            ? [flowStep.value]
            : [],
        ),
      },
    );
    const firstResponse = responses[0];
    const lastResponse = responses.at(-1);
    const observedWindowMs =
      firstResponse === undefined || lastResponse === undefined
        ? undefined
        : lastResponse.observedAtMs - firstResponse.observedAtMs;
    context.evidence.push(
      createEvidenceEntry(
        "DUPLICATE_REQUEST",
        identifierProof.distinctCount >= 2
          ? `${successful.length} successful matching mutation requests produced distinct fingerprinted identifiers.`
          : `${successful.length} successful matching mutation request(s) observed; distinct outcomes were not proven.`,
        {
          count: responses.length,
          successfulCount: successful.length,
          distinctIdentifierCount: identifierProof.distinctCount,
          ...(identifierProof.field === undefined
            ? {}
            : { identifierField: identifierProof.field }),
          ...(identifierProof.source === undefined
            ? {}
            : { identifierSource: identifierProof.source }),
          ...(identifierProof.fingerprints.length === 0
            ? {}
            : { identifierFingerprints: identifierProof.fingerprints }),
          ...(observedWindowMs === undefined ? {} : { observedWindowMs }),
        },
      ),
    );

    const assertion = await evaluateAndRecordAssertion(context);
    return {
      classification: classifyDoubleAction({
        successfulMutationCount: successful.length,
        distinctIdentifierCount: identifierProof.distinctCount,
        assertionPassed: assertion.status === "PASSED",
      }),
      assertion,
    };
  }
}

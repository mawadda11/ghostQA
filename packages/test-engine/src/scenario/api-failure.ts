import type { ApiFailureScenarioConfig } from "@ghostqa/shared";
import type { Route } from "playwright";

import { classifyApiFailure } from "./classification.js";
import { createEvidenceEntry } from "./evidence.js";
import {
  collectMatchingResponses,
  criticalStep,
  evaluateAndRecordAssertion,
  executeCriticalStep,
  replayThroughCheckpoint,
  responseEvidence,
} from "./execution-helpers.js";
import {
  controlStateEvidence,
  isStablePendingControl,
  observeAutomaticStatus,
  prepareCriticalControlProbe,
  snapshotCriticalControl,
} from "./control-observation.js";
import { observeElement } from "./observations.js";
import { requestMatches } from "./request-matching.js";
import type {
  ScenarioExecutionContext,
  ScenarioExecutor,
  ScenarioOutcome,
} from "./types.js";
import { resolveScenarioRequestMatcher } from "./validation.js";

export class ApiFailureExecutor implements ScenarioExecutor {
  async execute(context: ScenarioExecutionContext): Promise<ScenarioOutcome> {
    const config = context.request.scenario.config as ApiFailureScenarioConfig;
    const matcher = resolveScenarioRequestMatcher(context.request);
    if (matcher === undefined) throw new Error("API Failure request is missing.");

    await replayThroughCheckpoint(context, config.checkpointStepId);
    const critical = criticalStep(context);
    if (critical.action !== "CLICK") throw new Error("Critical step must be CLICK.");
    const controlProbe = await prepareCriticalControlProbe(
      context.page,
      critical.locator,
    );
    const beforeControl = await snapshotCriticalControl(context.page, controlProbe);
    let injectionCount = 0;
    const handler = async (route: Route): Promise<void> => {
      const request = route.request();
      if (
        injectionCount === 0 &&
        requestMatches(request.method(), request.url(), matcher)
      ) {
        injectionCount += 1;
        context.evidence.push(
          createEvidenceEntry("SCENARIO_INJECTION", "Injected HTTP 500 response.", {
            method: matcher.method.toUpperCase(),
            pathname: matcher.pathname,
            status: config.statusCode,
          }),
        );
        await route.fulfill({
          status: config.statusCode,
          contentType: "application/json",
          body: JSON.stringify({ error: "GhostQA injected API failure" }),
        });
        return;
      }
      await route.continue();
    };
    await context.page.route("**/*", handler);
    const responsesPromise = collectMatchingResponses(context.page, matcher, 1, 3_000);
    try {
      await executeCriticalStep(context);
      const responses = await responsesPromise;
      context.evidence.push(...responseEvidence(matcher, responses));
      const duringControl = await snapshotCriticalControl(context.page, controlProbe);
      const broken =
        config.brokenState === undefined
          ? undefined
          : await observeElement(context.page, config.brokenState);
      if (broken !== undefined) context.evidence.push(broken.evidence);
      const recovery =
        config.recoveryState === undefined
          ? undefined
          : await observeElement(context.page, config.recoveryState);
      if (recovery !== undefined) context.evidence.push(recovery.evidence);
      const assertion = await evaluateAndRecordAssertion(
        context,
        config.assertionTimeoutMs ?? 500,
      );
      const afterControl = await snapshotCriticalControl(context.page, controlProbe);
      const automaticStatus = await observeAutomaticStatus(context.page);
      const browserErrorCount = context.collector.console.filter(
        ({ level }) => level === "error",
      ).length;
      const unexpectedPageErrorCount = context.collector.console.filter(
        ({ source, level, text }) =>
          level === "error" &&
          (source === "PAGE_ERROR" || !text.startsWith("Failed to load resource:")),
      ).length;
      const controlStuck =
        assertion.status !== "PASSED" &&
        isStablePendingControl(duringControl) &&
        isStablePendingControl(afterControl);
      const controlRecovered =
        afterControl.attached &&
        afterControl.visible &&
        afterControl.enabled &&
        !afterControl.ariaBusy;
      context.evidence.push(
        controlStateEvidence(
          "Observed the critical control and generic status feedback after the injected HTTP failure.",
          beforeControl,
          duringControl,
          afterControl,
          {
            controlStuck,
            controlRecovered,
            visibleStatusCount: automaticStatus.visibleCount,
            browserErrorCount,
            unexpectedPageErrorCount,
          },
        ),
      );
      return {
        classification: classifyApiFailure({
          injectedFailureObserved: responses.some(
            ({ response }) => response.status() === config.statusCode,
          ),
          ...(broken === undefined
            ? {}
            : { brokenStateMatched: broken.matched }),
          recoveryStateMatched: recovery?.matched ?? false,
          assertionPassed: assertion.status === "PASSED",
          ...(config.brokenState !== undefined || config.recoveryState !== undefined
            ? {}
            : {
                automaticObservation: {
                  controlStuck,
                  controlRecovered,
                  statusVisible: automaticStatus.visibleCount > 0,
                  pageErrorCount: unexpectedPageErrorCount,
                },
              }),
        }),
        assertion,
      };
    } finally {
      await context.page.unroute("**/*", handler);
    }
  }
}

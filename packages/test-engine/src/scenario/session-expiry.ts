import type { SessionExpiryScenarioConfig } from "@ghostqa/shared";
import type { Route } from "playwright";

import { classifySessionExpiry } from "./classification.js";
import { createEvidenceEntry } from "./evidence.js";
import {
  collectMatchingResponses,
  evaluateAndRecordAssertion,
  executeCriticalStep,
  replayThroughCheckpoint,
  responseEvidence,
} from "./execution-helpers.js";
import type { TimedResponse } from "./execution-helpers.js";
import { observeElement } from "./observations.js";
import { requestMatches } from "./request-matching.js";
import type {
  ScenarioExecutionContext,
  ScenarioExecutor,
  ScenarioOutcome,
} from "./types.js";
import { resolveScenarioRequestMatcher } from "./validation.js";

export class SessionExpiryExecutor implements ScenarioExecutor {
  async execute(context: ScenarioExecutionContext): Promise<ScenarioOutcome> {
    const config = context.request.scenario.config as SessionExpiryScenarioConfig;
    await replayThroughCheckpoint(context, config.checkpointStepId);

    let invalidationObserved = false;
    let handler: ((route: Route) => Promise<void>) | undefined;
    let responsesPromise: Promise<readonly TimedResponse[]> = Promise.resolve(
      [],
    );
    const matcher = resolveScenarioRequestMatcher(context.request);

    if (config.strategy.kind === "INTERCEPT_REQUEST") {
      const strategy = config.strategy;
      if (matcher === undefined) throw new Error("Session Expiry request is missing.");
      let injectionCount = 0;
      handler = async (route: Route): Promise<void> => {
        const request = route.request();
        if (
          injectionCount === 0 &&
          requestMatches(request.method(), request.url(), matcher)
        ) {
          injectionCount += 1;
          invalidationObserved = true;
          context.evidence.push(
            createEvidenceEntry(
              "SCENARIO_INJECTION",
              "Injected HTTP 401 response to simulate session expiry.",
              {
                method: matcher.method.toUpperCase(),
                pathname: matcher.pathname,
                status: strategy.statusCode,
              },
            ),
          );
          await route.fulfill({
            status: strategy.statusCode,
            contentType: "application/json",
            body: JSON.stringify({ error: "GhostQA injected session expiry" }),
          });
          return;
        }
        await route.continue();
      };
      await context.page.route("**/*", handler);
      responsesPromise = collectMatchingResponses(context.page, matcher, 1, 3_000);
    } else {
      for (const cookieName of config.strategy.cookieNames ?? []) {
        await context.browserContext.clearCookies({ name: cookieName });
      }
      await context.page.evaluate(
        ({ localKeys, sessionKeys }) => {
          for (const key of localKeys) localStorage.removeItem(key);
          for (const key of sessionKeys) sessionStorage.removeItem(key);
        },
        {
          localKeys: [...(config.strategy.localStorageKeys ?? [])],
          sessionKeys: [...(config.strategy.sessionStorageKeys ?? [])],
        },
      );
      invalidationObserved = true;
      context.evidence.push(
        createEvidenceEntry(
          "SCENARIO_INJECTION",
          "Cleared the configured client authentication state.",
          {
            cookieCount: config.strategy.cookieNames?.length ?? 0,
            localStorageKeyCount:
              config.strategy.localStorageKeys?.length ?? 0,
            sessionStorageKeyCount:
              config.strategy.sessionStorageKeys?.length ?? 0,
          },
        ),
      );
    }

    try {
      await executeCriticalStep(context);
      const responses = await responsesPromise;
      if (matcher !== undefined) {
        context.evidence.push(...responseEvidence(matcher, responses));
      }
      const broken = await observeElement(context.page, config.brokenState);
      context.evidence.push(broken.evidence);
      const recovery =
        config.recoveryState === undefined
          ? undefined
          : await observeElement(context.page, config.recoveryState);
      if (recovery !== undefined) context.evidence.push(recovery.evidence);
      const assertion = await evaluateAndRecordAssertion(
        context,
        config.assertionTimeoutMs ?? 500,
      );
      return {
        classification: classifySessionExpiry({
          invalidationObserved,
          unauthorizedObserved: responses.some(
            ({ response }) => response.status() === 401,
          ),
          brokenStateMatched: broken.matched,
          recoveryStateMatched: recovery?.matched ?? false,
          assertionPassed: assertion.status === "PASSED",
        }),
        assertion,
      };
    } finally {
      if (handler !== undefined) await context.page.unroute("**/*", handler);
    }
  }
}

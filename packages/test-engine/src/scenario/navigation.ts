import type { NavigationScenarioConfig } from "@ghostqa/shared";

import { classifyNavigation } from "./classification.js";
import { createEvidenceEntry } from "./evidence.js";
import {
  notEvaluatedAssertion,
  replayThroughCheckpoint,
} from "./execution-helpers.js";
import { observeElement } from "./observations.js";
import { requestMatches } from "./request-matching.js";
import type {
  ScenarioExecutionContext,
  ScenarioExecutor,
  ScenarioOutcome,
} from "./types.js";

const urlMatches = async (
  context: ScenarioExecutionContext,
  expectedUrl: string | undefined,
): Promise<boolean> => {
  if (expectedUrl === undefined) return true;
  try {
    await context.page.waitForURL(expectedUrl, { timeout: 1_000 });
    return true;
  } catch {
    return false;
  }
};

export class NavigationExecutor implements ScenarioExecutor {
  async execute(context: ScenarioExecutionContext): Promise<ScenarioOutcome> {
    const config = context.request.scenario.config as NavigationScenarioConfig;
    await replayThroughCheckpoint(context, config.checkpointStepId);

    const before = await observeElement(context.page, config.expectedState);
    context.evidence.push(before.evidence);
    if (!before.matched) {
      throw new Error(
        "The configured navigation state was not present before injection.",
      );
    }

    const mutationMatcher = context.request.flow.criticalAction.request;
    const mutationCountBefore =
      mutationMatcher === undefined
        ? 0
        : context.collector.network.filter((entry) =>
            requestMatches(entry.method, entry.url, mutationMatcher),
          ).length;
    const fromUrl = context.page.url();
    if (config.mode === "REFRESH") {
      await context.page.reload({ waitUntil: "domcontentloaded" });
    } else {
      await context.page.goBack({ waitUntil: "domcontentloaded" });
    }
    const toUrl = context.page.url();
    context.evidence.push(
      createEvidenceEntry(
        "SCENARIO_INJECTION",
        config.mode === "REFRESH"
          ? "Reloaded the page at the configured checkpoint."
          : "Performed browser back navigation at the configured checkpoint.",
        { mode: config.mode },
      ),
      createEvidenceEntry("NAVIGATION", "Navigation result observed.", {
        mode: config.mode,
        fromUrl,
        toUrl,
      }),
    );

    const after = await observeElement(context.page, config.expectedState);
    context.evidence.push(after.evidence);
    const expectedUrlMatched = await urlMatches(context, config.expectedUrl);
    const mutationCountAfter =
      mutationMatcher === undefined
        ? 0
        : context.collector.network.filter((entry) =>
            requestMatches(entry.method, entry.url, mutationMatcher),
          ).length;
    const assertion = notEvaluatedAssertion(context);
    context.evidence.push(
      createEvidenceEntry(
        "ASSERTION",
        after.matched
          ? "Configured post-navigation state passed."
          : "Configured post-navigation state failed.",
        { stateMatched: after.matched, urlMatched: expectedUrlMatched },
      ),
    );

    return {
      classification: classifyNavigation({
        stateMatched: after.matched,
        urlMatched: expectedUrlMatched,
        mutationCount: mutationCountAfter - mutationCountBefore,
        mode: config.mode,
      }),
      assertion,
    };
  }
}

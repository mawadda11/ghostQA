import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import type {
  EngineExecutionReport,
  ScenarioExecutionReport,
} from "@ghostqa/shared";
import {
  PlaywrightBaselineEngine,
  PlaywrightScenarioEngine,
} from "@ghostqa/test-engine";

import { ghostShopBaselineFlow } from "../baseline/ghostshop-flow.js";
import { ghostShopScenarios } from "./ghostshop-scenarios.js";

export interface GhostShopScenarioRun {
  runId: string;
  artifactRoot: string;
  baseline: EngineExecutionReport;
  scenarios: readonly ScenarioExecutionReport[];
}

const repositoryRootFromModule = (): string => {
  const candidates = [
    fileURLToPath(new URL("../../../../", import.meta.url)),
    fileURLToPath(new URL("../../../", import.meta.url)),
  ];
  const root = candidates.find((candidate) =>
    existsSync(path.join(candidate, "package-lock.json")),
  );
  if (root === undefined) {
    throw new Error("Could not resolve the GhostQA repository root.");
  }
  return root;
};

const resetGhostShop = async (targetUrl: string): Promise<void> => {
  const response = await fetch(new URL("/api/test/reset", targetUrl), {
    method: "POST",
  });
  if (!response.ok) {
    throw new Error(
      `GhostShop reset failed with HTTP ${response.status}. Is npm run demo:dev running?`,
    );
  }
};

export const runGhostShopScenarios = async (
  targetUrl = process.env["GHOSTSHOP_URL"] ?? "http://127.0.0.1:4173",
): Promise<GhostShopScenarioRun> => {
  const repositoryRoot = repositoryRootFromModule();
  const runId = `scenarios-${new Date().toISOString().replace(/[:.]/g, "-")}`;
  const artifactRoot = path.join(
    repositoryRoot,
    "artifacts",
    "ghostshop",
    runId,
  );
  const target = {
    baseUrl: targetUrl,
    allowedHosts: ["localhost", "127.0.0.1"],
  } as const;

  await resetGhostShop(targetUrl);
  const baseline = await new PlaywrightBaselineEngine().execute({
    kind: "BASELINE",
    runId: `${runId}-baseline`,
    target,
    flow: ghostShopBaselineFlow,
    artifactDirectory: path.join(artifactRoot, "baseline"),
  });

  if (baseline.status !== "PASS") {
    return { runId, artifactRoot, baseline, scenarios: [] };
  }

  const engine = new PlaywrightScenarioEngine();
  const scenarios: ScenarioExecutionReport[] = [];
  for (const scenario of ghostShopScenarios) {
    await resetGhostShop(targetUrl);
    scenarios.push(
      await engine.execute({
        kind: "SCENARIO",
        runId: `${runId}-${scenario.id}`,
        target,
        flow: ghostShopBaselineFlow,
        artifactDirectory: path.join(artifactRoot, scenario.id),
        baselineValidation: { status: "PASS", runId: `${runId}-baseline` },
        scenario,
      }),
    );
  }

  return { runId, artifactRoot, baseline, scenarios };
};

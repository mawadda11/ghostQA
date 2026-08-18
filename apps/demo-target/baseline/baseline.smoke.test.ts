import assert from "node:assert/strict";
import { access } from "node:fs/promises";
import path from "node:path";
import { test } from "node:test";

import { PlaywrightBaselineEngine } from "@ghostqa/test-engine";

import { ghostShopBaselineFlow } from "./ghostshop-flow.js";
import { repositoryRootFromModule } from "../support/repository-root.js";

test(
  "the real GhostShop checkout baseline passes in Chromium",
  { timeout: 30_000 },
  async () => {
    const targetUrl =
      process.env["GHOSTSHOP_URL"] ?? "http://127.0.0.1:4173";
    const resetResponse = await fetch(new URL("/api/test/reset", targetUrl), {
      method: "POST",
    });
    assert.equal(resetResponse.status, 200);

    const repositoryRoot = repositoryRootFromModule();
    const runId = `smoke-${new Date().toISOString().replace(/[:.]/g, "-")}`;
    const artifactDirectory = path.join(
      repositoryRoot,
      "artifacts",
      "ghostshop",
      runId,
      "baseline",
    );

    const report = await new PlaywrightBaselineEngine().execute({
      kind: "BASELINE",
      runId,
      target: {
        baseUrl: targetUrl,
        allowedHosts: ["localhost", "127.0.0.1"],
      },
      flow: ghostShopBaselineFlow,
      artifactDirectory,
    });

    assert.equal(report.status, "PASS");
    assert.equal(report.assertion.status, "PASSED");
    assert.equal(report.evidence.console.length, 0);
    assert.match(report.evidence.finalUrl ?? "", /\/confirmation\/GS-1001$/);

    const orderObservation = report.evidence.network.find(
      (observation) =>
        observation.method === "POST" &&
        new URL(observation.url).pathname === "/api/orders",
    );
    assert.equal(orderObservation?.status, 201);

    const screenshot = report.artifacts.find(
      (artifact) => artifact.kind === "SCREENSHOT",
    );
    const trace = report.artifacts.find(
      (artifact) => artifact.kind === "TRACE",
    );
    assert.ok(screenshot);
    assert.ok(trace);
    await Promise.all([access(screenshot.path), access(trace.path)]);
  },
);

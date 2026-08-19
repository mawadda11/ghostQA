import assert from "node:assert/strict";
import { access } from "node:fs/promises";
import { test } from "node:test";

import type { ScenarioExecutionReport } from "@ghostqa/shared";

import { runGhostShopScenarios } from "./run-ghostshop-scenarios.js";

const byId = (
  reports: readonly ScenarioExecutionReport[],
  id: string,
): ScenarioExecutionReport => {
  const report = reports.find((candidate) => candidate.scenario.id === id);
  assert.ok(report, `Expected scenario report ${id}`);
  return report;
};

test(
  "all seeded GhostShop scenarios execute in real isolated Chromium contexts",
  { timeout: 120_000 },
  async () => {
    const run = await runGhostShopScenarios();
    assert.equal(run.baseline.status, "PASS");
    assert.equal(run.scenarios.length, 6);

    const doubleAction = byId(run.scenarios, "double-action");
    assert.equal(doubleAction.status, "FAIL", doubleAction.summary);
    const duplicateEvidence = doubleAction.evidence.entries.find(
      (entry) => entry.type === "DUPLICATE_REQUEST",
    );
    assert.equal(duplicateEvidence?.metadata?.["successfulCount"], 2);
    assert.equal(duplicateEvidence?.metadata?.["distinctIdentifierCount"], 2);
    assert.equal(
      Array.isArray(duplicateEvidence?.metadata?.["identifierFingerprints"]),
      true,
    );
    assert.equal("identifiers" in (duplicateEvidence?.metadata ?? {}), false);

    const apiFailure = byId(run.scenarios, "api-failure");
    assert.equal(apiFailure.status, "FAIL", apiFailure.summary);
    assert.ok(
      apiFailure.evidence.entries.some(
        (entry) =>
          entry.type === "HTTP_RESPONSE" &&
          entry.metadata?.["status"] === 500,
      ),
    );

    const slowResponse = byId(run.scenarios, "slow-response");
    assert.ok(
      slowResponse.status === "PASS" ||
        slowResponse.status === "NEEDS_REVIEW",
    );
    const controlEvidence = slowResponse.evidence.entries.find(
      (entry) =>
        entry.type === "ELEMENT_STATE" &&
        entry.message.includes("critical control"),
    );
    assert.equal(controlEvidence?.metadata?.["duringAttached"], true);
    assert.equal(
      typeof controlEvidence?.metadata?.["duringEnabled"],
      "boolean",
    );

    const refresh = byId(run.scenarios, "refresh");
    assert.equal(refresh.status, "FAIL", refresh.summary);
    assert.ok(
      refresh.evidence.entries.some(
        (entry) =>
          entry.type === "ELEMENT_STATE" &&
          entry.metadata?.["matched"] === false,
      ),
    );

    const back = byId(run.scenarios, "back");
    assert.ok(back.status === "PASS" || back.status === "NEEDS_REVIEW");

    const sessionExpiry = byId(run.scenarios, "session-expiry");
    assert.equal(sessionExpiry.status, "FAIL", sessionExpiry.summary);
    assert.ok(
      sessionExpiry.evidence.entries.some(
        (entry) =>
          entry.type === "HTTP_RESPONSE" &&
          entry.metadata?.["status"] === 401,
      ),
    );

    for (const report of run.scenarios) {
      const trace = report.artifacts.find(
        (artifact) => artifact.kind === "TRACE",
      );
      assert.ok(trace, `${report.scenario.name} should save a trace`);
      await access(trace.path);
      if (report.status === "FAIL" || report.status === "NEEDS_REVIEW") {
        const screenshot = report.artifacts.find(
          (artifact) => artifact.kind === "SCREENSHOT",
        );
        assert.ok(
          screenshot,
          `${report.scenario.name} should save a screenshot`,
        );
        await access(screenshot.path);
      }
    }
  },
);

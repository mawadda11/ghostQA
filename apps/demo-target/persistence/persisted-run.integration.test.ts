import assert from "node:assert/strict";
import { test } from "node:test";

import { runPersistedGhostShop } from "./run-persisted-ghostshop.js";

test(
  "a real GhostShop Chromium run survives the SQLite and API round-trip",
  { timeout: 180_000 },
  async () => {
    assert.equal(
      process.env["GHOSTQA_TEST_DATABASE"],
      "isolated",
      "Run this integration test through the isolated GhostQA E2E harness.",
    );
    const serverUrl =
      process.env["GHOSTQA_SERVER_URL"] ?? "http://127.0.0.1:4000";
    const run = await runPersistedGhostShop();
    assert.equal(run.status, "COMPLETED");
    assert.equal(run.baselineResult?.status, "PASS");
    assert.equal(run.scenarioResults.length, 6);

    const statuses = new Map(
      run.scenarioResults.map((result) => [result.title, result.status]),
    );
    assert.equal(statuses.get("Double Action"), "FAIL");
    assert.equal(statuses.get("API Failure"), "FAIL");
    assert.equal(statuses.get("Slow Response"), "PASS");
    assert.equal(statuses.get("Refresh"), "FAIL");
    assert.equal(statuses.get("Back"), "PASS");
    assert.equal(statuses.get("Session Expiry"), "FAIL");
    assert.deepEqual(run.summary, {
      total: 6,
      passed: 2,
      failed: 4,
      needsReview: 0,
      errors: 0,
    });

    const results = [run.baselineResult, ...run.scenarioResults].filter(
      (result) => result !== undefined,
    );
    assert.equal(results.length, 7);
    assert.ok(
      run.scenarioResults.some((result) => result.evidence.entries.length > 0),
      "Expected structured evidence read back from SQLite",
    );
    const artifacts = results.flatMap((result) => result.artifacts);
    assert.equal(artifacts.filter((artifact) => artifact.kind === "TRACE").length, 7);
    assert.ok(
      artifacts.some((artifact) => artifact.kind === "SCREENSHOT"),
      "Expected screenshot metadata read back from SQLite",
    );
    for (const artifact of artifacts) {
      const response = await fetch(new URL(artifact.downloadUrl, serverUrl));
      assert.equal(response.status, 200);
      assert.ok((await response.arrayBuffer()).byteLength > 0);
    }
  },
);

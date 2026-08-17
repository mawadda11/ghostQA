import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { PlaywrightBaselineEngine } from "@ghostqa/test-engine";

import { ghostShopBaselineFlow } from "./ghostshop-flow.js";

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

const targetUrl = process.env["GHOSTSHOP_URL"] ?? "http://127.0.0.1:4173";
const repositoryRoot = repositoryRootFromModule();
const runId = `baseline-${new Date().toISOString().replace(/[:.]/g, "-")}`;
const artifactDirectory = path.join(
  repositoryRoot,
  "artifacts",
  "ghostshop",
  runId,
  "baseline",
);

const resetResponse = await fetch(new URL("/api/test/reset", targetUrl), {
  method: "POST",
});
if (!resetResponse.ok) {
  throw new Error(
    `GhostShop reset failed with HTTP ${resetResponse.status}. Is npm run demo:dev running?`,
  );
}

const engine = new PlaywrightBaselineEngine();
const report = await engine.execute({
  kind: "BASELINE",
  runId,
  target: {
    baseUrl: targetUrl,
    allowedHosts: ["localhost", "127.0.0.1"],
  },
  flow: ghostShopBaselineFlow,
  artifactDirectory,
});

const requestMatcher = ghostShopBaselineFlow.criticalAction.request;
const orderObservation = report.evidence.network.find((observation) => {
  if (requestMatcher === undefined) {
    return false;
  }

  return (
    observation.method.toUpperCase() === requestMatcher.method.toUpperCase() &&
    new URL(observation.url).pathname === requestMatcher.pathname
  );
});
const screenshot = report.artifacts.find(
  (artifact) => artifact.kind === "SCREENSHOT",
);
const trace = report.artifacts.find((artifact) => artifact.kind === "TRACE");

console.log("GhostShop baseline");
console.log(report.status);
console.log("");
console.log(`Final URL: ${report.evidence.finalUrl ?? "not available"}`);
console.log(
  `Success assertion: ${report.assertion.status === "PASSED" ? "passed" : "failed"}`,
);
console.log(
  `Order request: ${
    orderObservation === undefined
      ? "not observed"
      : `${orderObservation.method} ${new URL(orderObservation.url).pathname} -> ${orderObservation.status ?? "failed"}`
  }`,
);
console.log(`Console/page errors: ${report.evidence.console.length}`);
console.log(`Screenshot: ${screenshot?.path ?? "not created"}`);
console.log(`Trace: ${trace?.path ?? "not created"}`);

if (report.assertion.status !== "PASSED") {
  console.log(`Assertion detail: ${report.assertion.detail}`);
}
for (const observation of report.evidence.console) {
  console.log(`${observation.source}: ${observation.text}`);
}

if (
  report.status !== "PASS" ||
  orderObservation?.status !== 201 ||
  screenshot === undefined ||
  trace === undefined
) {
  process.exitCode = 1;
}

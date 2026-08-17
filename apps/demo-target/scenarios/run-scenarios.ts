import { runGhostShopScenarios } from "./run-ghostshop-scenarios.js";

const run = await runGhostShopScenarios();

console.log("GhostQA Scenario Run");
console.log("");
console.log(`Baseline: ${run.baseline.status}`);
if (run.baseline.status !== "PASS") {
  console.log(run.baseline.summary);
  process.exitCode = 1;
} else {
  for (const report of run.scenarios) {
    console.log("");
    console.log(report.scenario.name);
    console.log(report.status);
    console.log(report.summary);
    for (const entry of report.evidence.entries) {
      if (
        entry.type === "SCENARIO_INJECTION" ||
        entry.type === "DUPLICATE_REQUEST" ||
        entry.type === "ELEMENT_STATE"
      ) {
        console.log(`- ${entry.message}`);
      }
    }
    const screenshot = report.artifacts.find(
      (artifact) => artifact.kind === "SCREENSHOT",
    );
    const trace = report.artifacts.find((artifact) => artifact.kind === "TRACE");
    console.log(`Screenshot: ${screenshot?.path ?? "not created"}`);
    console.log(`Trace: ${trace?.path ?? "not created"}`);
  }
}

console.log("");
console.log(`Artifacts: ${run.artifactRoot}`);

if (
  run.baseline.status !== "PASS" ||
  run.scenarios.some(
    (report) =>
      report.status === "ERROR" || report.status === "BASELINE_REQUIRED",
  )
) {
  process.exitCode = 1;
}

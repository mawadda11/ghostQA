import { runPersistedGhostShop } from "./run-persisted-ghostshop.js";

const run = await runPersistedGhostShop();
console.log("GhostQA Persisted Run");
console.log("");
console.log("Project: GhostShop");
console.log(`Baseline: ${run.baselineResult?.status ?? "not persisted"}`);
console.log("");
for (const result of run.scenarioResults) {
  console.log(`${result.title}: ${result.status}`);
}
console.log("");
console.log(`Persisted run: ${run.id}`);
console.log(
  `Results persisted: ${run.scenarioResults.length + (run.baselineResult === undefined ? 0 : 1)}`,
);
console.log(
  `Artifacts persisted: ${[
    ...(run.baselineResult?.artifacts ?? []),
    ...run.scenarioResults.flatMap((result) => result.artifacts),
  ].length}`,
);

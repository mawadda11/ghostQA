import type { TestRunDetail } from "@ghostqa/shared";

import { seedGhostShop } from "./seed-ghostshop.js";
import { ghostQaApiRequest } from "../support/ghostqa-api.js";

export const runPersistedGhostShop = async (
  serverUrl = process.env["GHOSTQA_SERVER_URL"] ?? "http://127.0.0.1:4000",
  targetUrl = process.env["GHOSTSHOP_URL"] ?? "http://127.0.0.1:4173",
): Promise<TestRunDetail> => {
  const seeded = await seedGhostShop(serverUrl, targetUrl);
  const reset = await fetch(new URL("/api/test/reset", targetUrl), {
    method: "POST",
  });
  if (!reset.ok) {
    throw new Error(`GhostShop reset failed with HTTP ${reset.status}.`);
  }
  const executed = await ghostQaApiRequest<TestRunDetail>(
    serverUrl,
    `/api/flows/${seeded.flow.id}/runs`,
    { method: "POST", body: "{}" },
  );
  return ghostQaApiRequest<TestRunDetail>(
    serverUrl,
    `/api/runs/${executed.id}`,
  );
};

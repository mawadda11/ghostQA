import type { TestRunDetail } from "@ghostqa/shared";

import { seedGhostShop } from "./seed-ghostshop.js";

const apiRequest = async <T>(
  serverUrl: string,
  pathname: string,
  init?: RequestInit,
): Promise<T> => {
  const response = await fetch(new URL(pathname, serverUrl), {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
  if (!response.ok) {
    throw new Error(
      `GhostQA API ${init?.method ?? "GET"} ${pathname} failed with HTTP ${response.status}: ${await response.text()}`,
    );
  }
  return (await response.json()) as T;
};

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
  const executed = await apiRequest<TestRunDetail>(
    serverUrl,
    `/api/flows/${seeded.flow.id}/runs`,
    { method: "POST", body: "{}" },
  );
  return apiRequest<TestRunDetail>(serverUrl, `/api/runs/${executed.id}`);
};

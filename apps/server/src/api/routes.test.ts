import { randomUUID } from "node:crypto";
import type { AddressInfo } from "node:net";

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Server } from "node:http";

import { createApp } from "../app.js";
import { prisma } from "../db/prisma.js";

const orchestratorCalls: Array<{
  flowId: string;
  selectedScenarioIds: readonly string[] | undefined;
}> = [];

const captureSession = {
  id: "capture-route-test",
  projectId: "project-route-test",
  status: "ACTIVE" as const,
  targetUrl: "http://127.0.0.1:4173/",
  startedAt: new Date(0).toISOString(),
  updatedAt: new Date(0).toISOString(),
};

const isolatedArtifactRoot = process.env["ARTIFACTS_ROOT"];
if (isolatedArtifactRoot === undefined) {
  throw new Error("API route tests require the isolated test artifact root.");
}

describe("API validation errors", () => {
  let server: Server;
  let baseUrl: string;

  beforeAll(async () => {
    const app = createApp({
      prisma,
      allowedHosts: new Set(["localhost", "127.0.0.1"]),
      dashboardOrigins: new Set(["http://localhost:5173"]),
      artifactRoot: isolatedArtifactRoot,
      orchestrator: {
        runFlow: async (flowId, selectedScenarioIds) => {
          orchestratorCalls.push({ flowId, selectedScenarioIds });
          return {
            id: "baseline-replay-run",
            projectId: "project-route-test",
            flowId,
            flowName: "Captured flow",
            status: "COMPLETED",
            baselineStatus: "PASS",
            summary: {
              total: 0,
              passed: 0,
              failed: 0,
              needsReview: 0,
              errors: 0,
            },
            startedAt: new Date(0).toISOString(),
            completedAt: new Date(1).toISOString(),
            scenarioResults: [],
          };
        },
      },
      captureService: {
        start: async (projectId) => ({ ...captureSession, projectId }),
        get: (captureId) => ({ ...captureSession, id: captureId }),
        stop: async (captureId) => ({
          ...captureSession,
          id: captureId,
          status: "READY",
        }),
        cancel: async (captureId) => ({
          ...captureSession,
          id: captureId,
          status: "CANCELLED",
        }),
      },
    });
    await new Promise<void>((resolve, reject) => {
      server = app.listen(0, "127.0.0.1", (error) =>
        error === undefined ? resolve() : reject(error),
      );
    });
    const address = server.address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  afterAll(async () => {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error === undefined ? resolve() : reject(error)));
    });
  });

  it("returns a consistent INVALID_REQUEST body", async () => {
    const response = await fetch(`${baseUrl}/api/projects`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "", baseUrl: "not-a-url" }),
    });
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({
      error: { code: "INVALID_REQUEST" },
    });
  });

  it("replays only the baseline without requiring scenarios", async () => {
    const response = await fetch(`${baseUrl}/api/flows/captured-flow/replay`, {
      method: "POST",
    });
    expect(response.status).toBe(201);
    expect(await response.json()).toMatchObject({
      id: "baseline-replay-run",
      baselineStatus: "PASS",
      summary: { total: 0 },
    });
    expect(orchestratorCalls.at(-1)).toEqual({
      flowId: "captured-flow",
      selectedScenarioIds: [],
    });
  });

  it("returns INVALID_REQUEST for malformed JSON without exposing parser details", async () => {
    const response = await fetch(`${baseUrl}/api/projects`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: '{"name":',
    });
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: {
        code: "INVALID_REQUEST",
        message: "The request body must contain valid JSON.",
      },
    });
  });

  it("separates target authorization failures", async () => {
    const response = await fetch(`${baseUrl}/api/projects`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Disallowed",
        baseUrl: "https://example.com",
      }),
    });
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({
      error: { code: "TARGET_NOT_ALLOWED" },
    });
  });

  it("allows only the configured dashboard CORS origin", async () => {
    const allowed = await fetch(`${baseUrl}/health`, {
      headers: { Origin: "http://localhost:5173" },
    });
    expect(allowed.headers.get("access-control-allow-origin")).toBe(
      "http://localhost:5173",
    );
    expect(allowed.headers.get("access-control-allow-methods")).toContain("PUT");
    const denied = await fetch(`${baseUrl}/health`, {
      headers: { Origin: "https://example.com" },
    });
    expect(denied.headers.get("access-control-allow-origin")).toBeNull();
  });

  it("returns NOT_FOUND when persisted artifact metadata points to a missing file", async () => {
    const suffix = randomUUID();
    const project = await prisma.project.create({
      data: {
        name: `Missing artifact ${suffix}`,
        targetBaseUrl: "http://127.0.0.1:4173/",
      },
    });
    const flow = await prisma.flow.create({
      data: {
        projectId: project.id,
        name: "Artifact route fixture",
        criticalActionJson: "{}",
        successAssertionJson: "{}",
      },
    });
    const run = await prisma.testRun.create({
      data: {
        projectId: project.id,
        flowId: flow.id,
        status: "COMPLETED",
      },
    });
    const result = await prisma.testResult.create({
      data: {
        testRunId: run.id,
        kind: "BASELINE",
        status: "PASS",
        title: "Baseline",
        summary: "Fixture result",
        durationMs: 1,
        startedAt: new Date(),
        completedAt: new Date(),
        evidenceJson: "{}",
        observationsJson: "{}",
      },
    });
    const artifact = await prisma.artifact.create({
      data: {
        testResultId: result.id,
        kind: "SCREENSHOT",
        relativePath: `missing/${suffix}.png`,
        mimeType: "image/png",
      },
    });

    try {
      const response = await fetch(
        `${baseUrl}/api/artifacts/${artifact.id}`,
      );
      expect(response.status).toBe(404);
      expect(await response.json()).toEqual({
        error: {
          code: "NOT_FOUND",
          message: "Artifact file was not found.",
        },
      });
    } finally {
      await prisma.testRun.deleteMany({ where: { projectId: project.id } });
      await prisma.project.delete({ where: { id: project.id } });
    }
  });

  it("exposes the capture session lifecycle through dedicated endpoints", async () => {
    const started = await fetch(
      `${baseUrl}/api/projects/project-route-test/capture/start`,
      { method: "POST" },
    );
    expect(started.status).toBe(201);
    expect(await started.json()).toMatchObject({
      id: captureSession.id,
      projectId: "project-route-test",
      status: "ACTIVE",
    });

    const status = await fetch(
      `${baseUrl}/api/capture/${captureSession.id}`,
    );
    expect(await status.json()).toMatchObject({ status: "ACTIVE" });

    const stopped = await fetch(
      `${baseUrl}/api/capture/${captureSession.id}/stop`,
      { method: "POST" },
    );
    expect(await stopped.json()).toMatchObject({ status: "READY" });

    const cancelled = await fetch(
      `${baseUrl}/api/capture/${captureSession.id}/cancel`,
      { method: "POST" },
    );
    expect(await cancelled.json()).toMatchObject({ status: "CANCELLED" });
  });
});

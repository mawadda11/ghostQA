import { randomUUID } from "node:crypto";

import type { CaptureDiagnostics, CapturedFlowDraft } from "@ghostqa/shared";
import { CaptureBrowserError } from "@ghostqa/test-engine";
import type {
  CaptureEngine,
  CaptureHandle,
  CaptureStartRequest,
} from "@ghostqa/test-engine";
import { afterAll, afterEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "../api/errors.js";
import { prisma } from "../db/prisma.js";
import { CaptureSessionService } from "./capture.js";

const allowedHosts = new Set(["localhost", "127.0.0.1"]);

const capturedDraft = (): CapturedFlowDraft => ({
  suggestedId: "captured-test",
  suggestedName: "Captured baseline",
  steps: [
    { id: "navigate-start", position: 0, action: "NAVIGATE", path: "/" },
    {
      id: "click-submit",
      position: 1,
      action: "CLICK",
      locator: { kind: "ROLE", role: "button", name: "Submit", exact: true },
    },
  ],
  criticalActionCandidates: [
    {
      stepId: "click-submit",
      label: "Submit",
      request: { method: "POST", pathname: "/api/submissions" },
      reason: "A mutation request occurred immediately after this action.",
    },
  ],
  successTextCandidates: ["Complete"],
  finalUrl: "http://127.0.0.1:4173/complete",
  network: [],
});

const safeDiagnostics = (): CaptureDiagnostics => ({
  stage: "NORMALIZING",
  errorMessage: "Captured click event 7 had no stable unique locator.",
  events: [
    {
      order: 1,
      kind: "FILL",
      timestamp: "2026-01-01T00:00:00.000Z",
      pathname: "/",
      locator: {
        label: { text: "Password", unique: true },
      },
      sensitive: true,
    },
    {
      order: 7,
      kind: "CLICK",
      timestamp: "2026-01-01T00:00:01.000Z",
      pathname: "/review",
      locator: {},
    },
  ],
  network: [],
  finalPathname: "/review",
});

const createProject = async (baseUrl = "http://127.0.0.1:4173/") =>
  prisma.project.create({
    data: {
      name: `Capture ${randomUUID()}`,
      targetBaseUrl: baseUrl,
    },
  });

const fakeEngine = (handle: CaptureHandle) => {
  let startRequest: CaptureStartRequest | undefined;
  const engine: CaptureEngine = {
    start: async (request) => {
      startRequest = request;
      return handle;
    },
  };
  return { engine, getStartRequest: () => startRequest };
};

afterEach(() => {
  vi.useRealTimers();
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe.sequential("capture session lifecycle", () => {
  it("starts, returns a review draft, and rejects a second stop", async () => {
    const project = await createProject();
    const handle: CaptureHandle = {
      stop: async () => capturedDraft(),
      cancel: async () => undefined,
    };
    const fake = fakeEngine(handle);
    const service = new CaptureSessionService({
      prisma,
      allowedHosts,
      engine: fake.engine,
    });
    try {
      const active = await service.start(project.id);
      expect(active.status).toBe("ACTIVE");
      expect(fake.getStartRequest()?.target.baseUrl).toBe(project.targetBaseUrl);
      const ready = await service.stop(active.id);
      expect(ready.status).toBe("READY");
      expect(ready.draft).toEqual(capturedDraft());
      await expect(service.stop(active.id)).rejects.toMatchObject({
        code: "CAPTURE_NOT_ACTIVE",
      });
      expect((await service.cancel(active.id)).status).toBe("CANCELLED");
      expect(service.get(active.id).draft).toBeUndefined();
    } finally {
      await service.shutdown();
      await prisma.project.delete({ where: { id: project.id } });
    }
  });

  it("cancels the browser and records a terminal session", async () => {
    const project = await createProject();
    let cancelled = 0;
    const fake = fakeEngine({
      stop: async () => capturedDraft(),
      cancel: async () => {
        cancelled += 1;
      },
    });
    const service = new CaptureSessionService({
      prisma,
      allowedHosts,
      engine: fake.engine,
    });
    try {
      const active = await service.start(project.id);
      expect((await service.cancel(active.id)).status).toBe("CANCELLED");
      expect(cancelled).toBe(1);
    } finally {
      await service.shutdown();
      await prisma.project.delete({ where: { id: project.id } });
    }
  });

  it("moves to ERROR when the user closes Chromium manually", async () => {
    const project = await createProject();
    const fake = fakeEngine({
      stop: async () => capturedDraft(),
      cancel: async () => undefined,
    });
    const service = new CaptureSessionService({
      prisma,
      allowedHosts,
      engine: fake.engine,
    });
    try {
      const active = await service.start(project.id);
      fake
        .getStartRequest()
        ?.onUnexpectedClose(
          new CaptureBrowserError("The capture browser was closed."),
        );
      expect(service.get(active.id)).toMatchObject({
        status: "ERROR",
        errorMessage: "The capture browser was closed.",
      });
    } finally {
      await service.shutdown();
      await prisma.project.delete({ where: { id: project.id } });
    }
  });

  it("expires a stale active capture and cleans its browser", async () => {
    vi.useFakeTimers();
    const project = await createProject();
    let cancelled = 0;
    const fake = fakeEngine({
      stop: async () => capturedDraft(),
      cancel: async () => {
        cancelled += 1;
      },
    });
    const service = new CaptureSessionService({
      prisma,
      allowedHosts,
      engine: fake.engine,
      activeTtlMs: 100,
    });
    try {
      const active = await service.start(project.id);
      await vi.advanceTimersByTimeAsync(100);
      expect(cancelled).toBe(1);
      expect(service.get(active.id)).toMatchObject({
        status: "ERROR",
        errorMessage: expect.stringContaining("expired"),
      });
    } finally {
      await service.shutdown();
      await prisma.project.delete({ where: { id: project.id } });
    }
  });

  it("rechecks target authorization before launching Chromium", async () => {
    const project = await createProject("http://example.com/");
    let starts = 0;
    const service = new CaptureSessionService({
      prisma,
      allowedHosts,
      engine: {
        start: async () => {
          starts += 1;
          throw new Error("should not start");
        },
      },
    });
    try {
      await expect(service.start(project.id)).rejects.toMatchObject({
        code: "HOST_NOT_ALLOWED",
      });
      expect(starts).toBe(0);
    } finally {
      await service.shutdown();
      await prisma.project.delete({ where: { id: project.id } });
    }
  });

  it("converts browser launch failures into a safe capture API error", async () => {
    const project = await createProject();
    const service = new CaptureSessionService({
      prisma,
      allowedHosts,
      engine: {
        start: async () => {
          throw new CaptureBrowserError("Chromium executable is unavailable.\nstack");
        },
      },
    });
    try {
      const error = await service.start(project.id).catch((caught) => caught);
      expect(error).toBeInstanceOf(ApiError);
      expect(error).toMatchObject({
        code: "CAPTURE_FAILED",
        message: "Chromium executable is unavailable.",
      });
    } finally {
      await service.shutdown();
      await prisma.project.delete({ where: { id: project.id } });
    }
  });

  it("retains redacted raw event diagnostics when normalization fails", async () => {
    const project = await createProject();
    const diagnostics = safeDiagnostics();
    const service = new CaptureSessionService({
      prisma,
      allowedHosts,
      engine: fakeEngine({
        stop: async () => {
          throw new CaptureBrowserError(
            diagnostics.errorMessage,
            diagnostics,
          );
        },
        cancel: async () => undefined,
        getDiagnostics: () => diagnostics,
      }).engine,
    });
    try {
      const active = await service.start(project.id);
      await expect(service.stop(active.id)).rejects.toMatchObject({
        code: "CAPTURE_FAILED",
        message: diagnostics.errorMessage,
      });
      const failed = service.get(active.id);
      expect(failed.status).toBe("ERROR");
      expect(failed.diagnostics).toEqual(diagnostics);
      expect(JSON.stringify(failed.diagnostics)).not.toContain("secret-value");
      expect(failed.diagnostics?.events[0]?.valueLength).toBeUndefined();
    } finally {
      await service.shutdown();
      await prisma.project.delete({ where: { id: project.id } });
    }
  });
});

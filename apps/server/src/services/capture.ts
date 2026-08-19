import { randomUUID } from "node:crypto";

import type { PrismaClient } from "@prisma/client";
import type {
  CaptureDiagnostics,
  CapturedFlowDraft,
  CaptureSession,
  CaptureSessionStatus,
} from "@ghostqa/shared";
import {
  CaptureBrowserError,
  PlaywrightCaptureEngine,
} from "@ghostqa/test-engine";
import type { CaptureEngine, CaptureHandle } from "@ghostqa/test-engine";

import { ApiError, notFound } from "../api/errors.js";
import { assertTargetUrlAllowed } from "../safety/target-hosts.js";

const DEFAULT_ACTIVE_TTL_MS = 30 * 60 * 1_000;
const DEFAULT_TERMINAL_RETENTION_MS = 60 * 60 * 1_000;

interface CaptureSessionRecord {
  id: string;
  projectId: string;
  status: CaptureSessionStatus;
  targetUrl: string;
  startedAt: Date;
  updatedAt: Date;
  errorMessage?: string;
  draft?: CapturedFlowDraft;
  diagnostics?: CaptureDiagnostics;
  handle?: CaptureHandle;
  expiryTimer?: NodeJS.Timeout;
  retentionTimer?: NodeJS.Timeout;
}

export interface CaptureSessionManager {
  start(projectId: string): Promise<CaptureSession>;
  get(captureId: string): CaptureSession;
  stop(captureId: string): Promise<CaptureSession>;
  cancel(captureId: string): Promise<CaptureSession>;
}

export interface CaptureSessionServiceOptions {
  prisma: PrismaClient;
  allowedHosts: ReadonlySet<string>;
  engine?: CaptureEngine;
  activeTtlMs?: number;
  terminalRetentionMs?: number;
  now?: () => Date;
}

const safeCaptureMessage = (error: unknown, fallback: string): string => {
  if (!(error instanceof CaptureBrowserError)) return fallback;
  const firstLine = error.message.split(/\r?\n/, 1)[0]?.trim();
  return firstLine === undefined || firstLine.length === 0
    ? fallback
    : firstLine.slice(0, 500);
};

const toCaptureSession = (record: CaptureSessionRecord): CaptureSession => ({
  id: record.id,
  projectId: record.projectId,
  status: record.status,
  targetUrl: record.targetUrl,
  startedAt: record.startedAt.toISOString(),
  updatedAt: record.updatedAt.toISOString(),
  ...(record.errorMessage === undefined
    ? {}
    : { errorMessage: record.errorMessage }),
  ...(record.draft === undefined ? {} : { draft: record.draft }),
  ...(record.diagnostics === undefined
    ? {}
    : { diagnostics: record.diagnostics }),
});

export class CaptureSessionService implements CaptureSessionManager {
  private readonly sessions = new Map<string, CaptureSessionRecord>();
  private readonly engine: CaptureEngine;
  private readonly activeTtlMs: number;
  private readonly terminalRetentionMs: number;
  private readonly now: () => Date;

  constructor(private readonly options: CaptureSessionServiceOptions) {
    this.engine = options.engine ?? new PlaywrightCaptureEngine();
    this.activeTtlMs = options.activeTtlMs ?? DEFAULT_ACTIVE_TTL_MS;
    this.terminalRetentionMs =
      options.terminalRetentionMs ?? DEFAULT_TERMINAL_RETENTION_MS;
    this.now = options.now ?? (() => new Date());
  }

  private require(captureId: string): CaptureSessionRecord {
    const record = this.sessions.get(captureId);
    if (record === undefined) throw notFound("Capture session");
    return record;
  }

  private scheduleRetention(record: CaptureSessionRecord): void {
    if (record.retentionTimer !== undefined) clearTimeout(record.retentionTimer);
    record.retentionTimer = setTimeout(() => {
      this.sessions.delete(record.id);
    }, this.terminalRetentionMs);
    record.retentionTimer.unref();
  }

  private completeWithError(
    record: CaptureSessionRecord,
    message: string,
    diagnostics?: CaptureDiagnostics,
  ): void {
    if (record.status !== "ACTIVE") return;
    if (record.expiryTimer !== undefined) clearTimeout(record.expiryTimer);
    record.status = "ERROR";
    record.errorMessage = message;
    if (diagnostics !== undefined) record.diagnostics = diagnostics;
    record.updatedAt = this.now();
    delete record.handle;
    this.scheduleRetention(record);
  }

  private requireActive(record: CaptureSessionRecord): CaptureHandle {
    if (record.status !== "ACTIVE" || record.handle === undefined) {
      throw new ApiError(
        409,
        "CAPTURE_NOT_ACTIVE",
        "This capture session is no longer active.",
      );
    }
    return record.handle;
  }

  async start(projectId: string): Promise<CaptureSession> {
    const project = await this.options.prisma.project.findUnique({
      where: { id: projectId },
    });
    if (project === null) throw notFound("Project");
    const target = assertTargetUrlAllowed(
      project.targetBaseUrl,
      this.options.allowedHosts,
    );
    const id = randomUUID();
    const startedAt = this.now();
    const record: CaptureSessionRecord = {
      id,
      projectId,
      status: "ACTIVE",
      targetUrl: target.href,
      startedAt,
      updatedAt: startedAt,
    };
    this.sessions.set(id, record);

    try {
      const handle = await this.engine.start({
        target: {
          baseUrl: target.href,
          allowedHosts: [...this.options.allowedHosts],
        },
        suggestedFlowId: `captured-${id.slice(0, 12)}`,
        suggestedFlowName: `${project.name} captured baseline`,
        onUnexpectedClose: (error) => {
          this.completeWithError(
            record,
            safeCaptureMessage(
              error,
              "The capture browser closed unexpectedly.",
            ),
            error instanceof CaptureBrowserError
              ? error.diagnostics
              : undefined,
          );
        },
      });
      if (record.status !== "ACTIVE") {
        throw new CaptureBrowserError(
          record.errorMessage ?? "The capture browser closed unexpectedly.",
        );
      }
      record.handle = handle;
      record.expiryTimer = setTimeout(() => {
        if (record.status !== "ACTIVE" || record.handle === undefined) return;
        const activeHandle = record.handle;
        void activeHandle.cancel().finally(() => {
          this.completeWithError(
            record,
            "The capture session expired and its browser was closed.",
          );
        });
      }, this.activeTtlMs);
      record.expiryTimer.unref();
      return toCaptureSession(record);
    } catch (error) {
      this.completeWithError(
        record,
        safeCaptureMessage(
          error,
          "GhostQA could not start the capture browser.",
        ),
      );
      throw new ApiError(
        500,
        "CAPTURE_FAILED",
        record.errorMessage ?? "GhostQA could not start the capture browser.",
      );
    }
  }

  get(captureId: string): CaptureSession {
    return toCaptureSession(this.require(captureId));
  }

  async stop(captureId: string): Promise<CaptureSession> {
    const record = this.require(captureId);
    const handle = this.requireActive(record);
    if (record.expiryTimer !== undefined) clearTimeout(record.expiryTimer);
    try {
      record.draft = await handle.stop();
      record.status = "READY";
      record.updatedAt = this.now();
      delete record.handle;
      this.scheduleRetention(record);
      return toCaptureSession(record);
    } catch (error) {
      this.completeWithError(
        record,
        safeCaptureMessage(error, "GhostQA could not normalize this capture."),
        error instanceof CaptureBrowserError
          ? error.diagnostics
          : handle.getDiagnostics?.(),
      );
      throw new ApiError(
        422,
        "CAPTURE_FAILED",
        record.errorMessage ?? "GhostQA could not normalize this capture.",
      );
    }
  }

  async cancel(captureId: string): Promise<CaptureSession> {
    const record = this.require(captureId);
    if (record.status === "READY") {
      record.status = "CANCELLED";
      record.updatedAt = this.now();
      delete record.draft;
      delete record.diagnostics;
      this.scheduleRetention(record);
      return toCaptureSession(record);
    }
    const handle = this.requireActive(record);
    if (record.expiryTimer !== undefined) clearTimeout(record.expiryTimer);
    try {
      await handle.cancel();
      record.status = "CANCELLED";
      record.updatedAt = this.now();
      delete record.handle;
      this.scheduleRetention(record);
      return toCaptureSession(record);
    } catch (error) {
      this.completeWithError(
        record,
        safeCaptureMessage(error, "GhostQA could not close the capture browser."),
      );
      throw new ApiError(
        500,
        "CAPTURE_FAILED",
        record.errorMessage ?? "GhostQA could not close the capture browser.",
      );
    }
  }

  async shutdown(): Promise<void> {
    await Promise.all(
      [...this.sessions.values()].map(async (record) => {
        if (record.expiryTimer !== undefined) clearTimeout(record.expiryTimer);
        if (record.retentionTimer !== undefined) clearTimeout(record.retentionTimer);
        if (record.status === "ACTIVE" && record.handle !== undefined) {
          try {
            await record.handle.cancel();
          } catch {
            // Process shutdown still continues if Chromium already exited.
          }
        }
      }),
    );
    this.sessions.clear();
  }
}

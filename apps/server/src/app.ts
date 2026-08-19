import type { HealthResponse } from "@ghostqa/shared";
import type { PrismaClient } from "@prisma/client";
import express from "express";

import { createCorsMiddleware } from "./api/cors.js";
import { errorHandler } from "./api/errors.js";
import { createApiRouter } from "./api/routes.js";
import { environment } from "./config/environment.js";
import { prisma } from "./db/prisma.js";
import type { RunOrchestrator } from "./services/orchestrator.js";
import {
  CaptureSessionService,
} from "./services/capture.js";
import type { CaptureSessionManager } from "./services/capture.js";

export interface AppOptions {
  prisma?: PrismaClient;
  allowedHosts?: ReadonlySet<string>;
  artifactRoot?: string;
  dashboardOrigins?: ReadonlySet<string>;
  orchestrator?: Pick<RunOrchestrator, "runFlow">;
  captureService?: CaptureSessionManager;
}

export const createApp = (options: AppOptions = {}): express.Express => {
  const app = express();
  const database = options.prisma ?? prisma;
  const allowedHosts = options.allowedHosts ?? environment.allowedTargetHosts;
  const artifactRoot = options.artifactRoot ?? environment.artifactRoot;
  const captureService =
    options.captureService ??
    new CaptureSessionService({ prisma: database, allowedHosts });

  app.disable("x-powered-by");
  app.use(
    createCorsMiddleware(
      options.dashboardOrigins ?? environment.dashboardOrigins,
    ),
  );
  app.use(express.json({ limit: "1mb" }));

  app.get("/health", (_request, response) => {
    const body: HealthResponse = {
      status: "ok",
      service: "ghostqa-server",
    };

    response.status(200).json(body);
  });

  app.use(
    "/api",
    createApiRouter({
      prisma: database,
      allowedHosts,
      artifactRoot,
      captureService,
      ...(options.orchestrator === undefined
        ? {}
        : { orchestrator: options.orchestrator }),
    }),
  );

  app.use(errorHandler);

  return app;
};

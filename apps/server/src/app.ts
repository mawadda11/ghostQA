import type { HealthResponse } from "@ghostqa/shared";
import express from "express";

export const createApp = (): express.Express => {
  const app = express();

  app.disable("x-powered-by");
  app.use(express.json());

  app.get("/health", (_request, response) => {
    const body: HealthResponse = {
      status: "ok",
      service: "ghostqa-server",
    };

    response.status(200).json(body);
  });

  return app;
};

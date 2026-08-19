import type { RequestHandler } from "express";

export const createCorsMiddleware = (
  allowedOrigins: ReadonlySet<string>,
): RequestHandler => (request, response, next) => {
  const origin = request.get("origin");
  if (origin !== undefined && allowedOrigins.has(origin)) {
    response.setHeader("Access-Control-Allow-Origin", origin);
    response.setHeader("Vary", "Origin");
    response.setHeader(
      "Access-Control-Allow-Methods",
      "GET,POST,PUT,PATCH,DELETE,OPTIONS",
    );
    response.setHeader("Access-Control-Allow-Headers", "Content-Type");
  }

  if (request.method === "OPTIONS") {
    if (origin !== undefined && allowedOrigins.has(origin)) {
      response.sendStatus(204);
    } else {
      response.status(403).json({
        error: {
          code: "INVALID_REQUEST",
          message: "The request origin is not allowed.",
        },
      });
    }
    return;
  }
  next();
};

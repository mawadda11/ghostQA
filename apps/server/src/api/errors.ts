import type { ApiErrorCode, ApiErrorResponse } from "@ghostqa/shared";
import { Prisma } from "@prisma/client";
import type { ErrorRequestHandler } from "express";
import {
  BaselineValidationError,
  ScenarioValidationError,
} from "@ghostqa/test-engine";
import { ZodError } from "zod";

import { TargetUrlError } from "../safety/target-hosts.js";

export class ApiError extends Error {
  constructor(
    readonly statusCode: number,
    readonly code: ApiErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export const notFound = (resource: string): ApiError =>
  new ApiError(404, "NOT_FOUND", `${resource} was not found.`);

const invalidRequestMessage = (error: ZodError): string => {
  const issue = error.issues[0];
  if (issue === undefined) return "The request body is invalid.";
  const path = issue.path.length === 0 ? "request" : issue.path.join(".");
  return `${path}: ${issue.message}`;
};

export const errorHandler: ErrorRequestHandler = (
  error: unknown,
  _request,
  response,
  _next,
) => {
  let apiError: ApiError;
  if (error instanceof ApiError) {
    apiError = error;
  } else if (error instanceof ZodError) {
    apiError = new ApiError(
      400,
      "INVALID_REQUEST",
      invalidRequestMessage(error),
    );
  } else if (error instanceof TargetUrlError) {
    apiError = new ApiError(400, "TARGET_NOT_ALLOWED", error.message);
  } else if (
    error instanceof BaselineValidationError ||
    error instanceof ScenarioValidationError
  ) {
    apiError = new ApiError(400, "INVALID_REQUEST", error.message);
  } else if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  ) {
    apiError = new ApiError(
      409,
      "INVALID_REQUEST",
      "A record with the same unique identifier already exists.",
    );
  } else if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2025"
  ) {
    apiError = notFound("Record");
  } else {
    apiError = new ApiError(
      500,
      "RUN_EXECUTION_ERROR",
      "GhostQA could not complete the request.",
    );
  }

  const body: ApiErrorResponse = {
    error: { code: apiError.code, message: apiError.message },
  };
  response.status(apiError.statusCode).json(body);
};

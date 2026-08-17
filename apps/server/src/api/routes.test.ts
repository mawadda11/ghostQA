import type { AddressInfo } from "node:net";

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Server } from "node:http";

import { createApp } from "../app.js";
import { prisma } from "../db/prisma.js";

describe("API validation errors", () => {
  let server: Server;
  let baseUrl: string;

  beforeAll(async () => {
    const app = createApp({
      prisma,
      allowedHosts: new Set(["localhost", "127.0.0.1"]),
      dashboardOrigins: new Set(["http://localhost:5173"]),
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
    const denied = await fetch(`${baseUrl}/health`, {
      headers: { Origin: "https://example.com" },
    });
    expect(denied.headers.get("access-control-allow-origin")).toBeNull();
  });
});

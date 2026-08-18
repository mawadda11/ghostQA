import { describe, expect, it } from "vitest";

import { parseDashboardOrigins } from "./environment.js";

describe("dashboard origin configuration", () => {
  it("defaults to the two local Vite origins", () => {
    expect([...parseDashboardOrigins(undefined)]).toEqual([
      "http://localhost:5173",
      "http://127.0.0.1:5173",
    ]);
  });

  it("accepts exact HTTP(S) origins", () => {
    expect(
      [...parseDashboardOrigins("https://dashboard.example.test:8443")],
    ).toEqual(["https://dashboard.example.test:8443"]);
  });

  it.each([
    "file:///dashboard",
    "https://user:secret@dashboard.example.test",
    "https://dashboard.example.test/path",
  ])("rejects unsafe or non-origin CORS configuration: %s", (origin) => {
    expect(() => parseDashboardOrigins(origin)).toThrow();
  });
});

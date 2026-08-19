import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  developmentDatabasePath,
  resolveDatabaseUrl,
  sqliteUrlForPath,
} from "./database-url.js";

describe("database URL isolation", () => {
  it("uses the development database outside test mode", () => {
    expect(resolveDatabaseUrl({ NODE_ENV: "development" })).toBe(
      sqliteUrlForPath(developmentDatabasePath),
    );
  });

  it("requires the isolated test harness and an absolute non-development path", () => {
    expect(() => resolveDatabaseUrl({ NODE_ENV: "test" })).toThrow(
      /isolated GhostQA test harness/,
    );
    expect(() =>
      resolveDatabaseUrl({
        NODE_ENV: "test",
        GHOSTQA_TEST_DATABASE: "isolated",
      }),
    ).toThrow(/must set DATABASE_URL/);
    expect(() =>
      resolveDatabaseUrl({
        NODE_ENV: "test",
        GHOSTQA_TEST_DATABASE: "isolated",
        DATABASE_URL: "file:./relative-test.db",
      }),
    ).toThrow(/absolute SQLite DATABASE_URL/);
    expect(() =>
      resolveDatabaseUrl({
        NODE_ENV: "test",
        GHOSTQA_TEST_DATABASE: "isolated",
        DATABASE_URL: sqliteUrlForPath(developmentDatabasePath),
      }),
    ).toThrow(/must not use.*development database/);
  });

  it("accepts a distinct absolute SQLite path from the test harness", () => {
    const testPath = path.join(path.dirname(developmentDatabasePath), "test.db");
    expect(
      resolveDatabaseUrl({
        NODE_ENV: "test",
        GHOSTQA_TEST_DATABASE: "isolated",
        DATABASE_URL: sqliteUrlForPath(testPath),
      }),
    ).toBe(sqliteUrlForPath(testPath));
  });
});


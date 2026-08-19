import path from "node:path";
import { fileURLToPath } from "node:url";

export const developmentDatabasePath = fileURLToPath(
  new URL("../../prisma/dev.db", import.meta.url),
);

export const sqliteUrlForPath = (databasePath: string): string =>
  `file:${path.resolve(databasePath).replaceAll("\\", "/")}`;

const configuredDatabaseUrl = (
  environment: NodeJS.ProcessEnv,
): string | undefined => {
  const value = environment["DATABASE_URL"]?.trim();
  return value === undefined || value.length === 0 ? undefined : value;
};

const testDatabasePath = (databaseUrl: string): string => {
  if (!databaseUrl.startsWith("file:")) {
    throw new Error("GhostQA integration tests require a SQLite DATABASE_URL.");
  }
  const candidate = databaseUrl.slice("file:".length);
  if (!path.isAbsolute(candidate)) {
    throw new Error(
      "GhostQA integration tests require an absolute SQLite DATABASE_URL.",
    );
  }
  return path.resolve(candidate);
};

export const resolveDatabaseUrl = (
  environment: NodeJS.ProcessEnv = process.env,
): string => {
  const configured = configuredDatabaseUrl(environment);
  if (environment["NODE_ENV"] !== "test") {
    return configured ?? sqliteUrlForPath(developmentDatabasePath);
  }

  if (environment["GHOSTQA_TEST_DATABASE"] !== "isolated") {
    throw new Error(
      "Test-mode database access requires the isolated GhostQA test harness.",
    );
  }
  if (configured === undefined) {
    throw new Error("The isolated GhostQA test harness must set DATABASE_URL.");
  }

  const configuredPath = testDatabasePath(configured);
  if (
    configuredPath.localeCompare(developmentDatabasePath, undefined, {
      sensitivity: "accent",
    }) === 0
  ) {
    throw new Error("Automated tests must not use the GhostQA development database.");
  }
  return sqliteUrlForPath(configuredPath);
};

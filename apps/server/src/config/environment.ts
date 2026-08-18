import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { parseAllowedTargetHosts } from "../safety/target-hosts.js";

const repositoryEnvironmentPath = fileURLToPath(
  new URL("../../../../.env", import.meta.url),
);
const repositoryRoot = fileURLToPath(new URL("../../../../", import.meta.url));

dotenv.config({ path: repositoryEnvironmentPath });

const parsePort = (value: string | undefined): number => {
  if (value === undefined) {
    return 4000;
  }

  const port = Number(value);
  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new Error(`PORT must be an integer between 1 and 65535; received "${value}".`);
  }

  return port;
};

export const parseDashboardOrigins = (
  value: string | undefined,
): ReadonlySet<string> =>
  new Set(
    (
      value?.split(",") ?? [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
      ]
    ).map((entry) => {
      const candidate = entry.trim();
      let origin: URL;
      try {
        origin = new URL(candidate);
      } catch {
        throw new Error(`Dashboard origin "${entry}" is not a valid URL.`);
      }
      if (origin.protocol !== "http:" && origin.protocol !== "https:") {
        throw new Error("Dashboard origins must use HTTP or HTTPS.");
      }
      if (origin.username.length > 0 || origin.password.length > 0) {
        throw new Error("Dashboard origins must not contain credentials.");
      }
      if (
        origin.pathname !== "/" ||
        origin.search.length > 0 ||
        origin.hash.length > 0
      ) {
        throw new Error(
          "Dashboard origins must not contain a path, query, or fragment.",
        );
      }
      return origin.origin;
    }),
  );

const parseArtifactRoot = (value: string | undefined): string =>
  path.resolve(repositoryRoot, value ?? "artifacts");

export const environment = {
  port: parsePort(process.env["PORT"]),
  allowedTargetHosts: parseAllowedTargetHosts(
    process.env["ALLOWED_TARGET_HOSTS"],
  ),
  dashboardOrigins: parseDashboardOrigins(process.env["DASHBOARD_ORIGINS"]),
  artifactRoot: parseArtifactRoot(process.env["ARTIFACTS_ROOT"]),
} as const;

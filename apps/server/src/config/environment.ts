import dotenv from "dotenv";
import { fileURLToPath } from "node:url";

import { parseAllowedTargetHosts } from "../safety/target-hosts.js";

const repositoryEnvironmentPath = fileURLToPath(
  new URL("../../../../.env", import.meta.url),
);

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

export const environment = {
  port: parsePort(process.env["PORT"]),
  allowedTargetHosts: parseAllowedTargetHosts(
    process.env["ALLOWED_TARGET_HOSTS"],
  ),
} as const;

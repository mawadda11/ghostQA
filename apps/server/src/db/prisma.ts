import { PrismaClient } from "@prisma/client";

import { resolveDatabaseUrl } from "./database-url.js";

const globalForPrisma = globalThis as typeof globalThis & {
  ghostqaPrisma?: PrismaClient;
};

export const prisma =
  globalForPrisma.ghostqaPrisma ??
  new PrismaClient({ datasourceUrl: resolveDatabaseUrl() });

if (process.env["NODE_ENV"] !== "production") {
  globalForPrisma.ghostqaPrisma = prisma;
}

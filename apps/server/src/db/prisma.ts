import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as typeof globalThis & {
  ghostqaPrisma?: PrismaClient;
};

export const prisma = globalForPrisma.ghostqaPrisma ?? new PrismaClient();

if (process.env["NODE_ENV"] !== "production") {
  globalForPrisma.ghostqaPrisma = prisma;
}

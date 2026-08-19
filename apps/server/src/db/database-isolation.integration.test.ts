import { randomUUID } from "node:crypto";

import { PrismaClient } from "@prisma/client";
import { afterAll, describe, expect, it } from "vitest";

import { prisma } from "./prisma.js";
import {
  developmentDatabasePath,
  resolveDatabaseUrl,
  sqliteUrlForPath,
} from "./database-url.js";

afterAll(async () => {
  await prisma.$disconnect();
});

describe("server integration database", () => {
  it("writes fixture records only to the isolated database", async () => {
    const isolatedUrl = resolveDatabaseUrl();
    expect(isolatedUrl).not.toBe(sqliteUrlForPath(developmentDatabasePath));

    const projectId = `isolation-probe-${randomUUID()}`;
    await prisma.project.create({
      data: {
        id: projectId,
        name: "Isolated database probe",
        description: "Owned by the database isolation regression test",
        targetBaseUrl: "http://127.0.0.1:4173/",
      },
    });

    const developmentClient = new PrismaClient({
      datasourceUrl: sqliteUrlForPath(developmentDatabasePath),
    });
    try {
      expect(
        await developmentClient.project.findUnique({ where: { id: projectId } }),
      ).toBeNull();
    } finally {
      await developmentClient.$disconnect();
      await prisma.project.delete({ where: { id: projectId } });
    }
  });
});


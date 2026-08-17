/*
  Warnings:

  - You are about to drop the column `locator` on the `FlowStep` table. All the data in the column will be lost.
  - You are about to drop the column `url` on the `FlowStep` table. All the data in the column will be lost.
  - You are about to drop the column `value` on the `FlowStep` table. All the data in the column will be lost.
  - You are about to drop the column `projectId` on the `Scenario` table. All the data in the column will be lost.
  - Added the required column `configJson` to the `FlowStep` table without a default value. This is not possible if the table is not empty.
  - Added the required column `stepKey` to the `FlowStep` table without a default value. This is not possible if the table is not empty.
  - Added the required column `flowId` to the `Scenario` table without a default value. This is not possible if the table is not empty.
  - Added the required column `scenarioKey` to the `Scenario` table without a default value. This is not possible if the table is not empty.
  - Added the required column `completedAt` to the `TestResult` table without a default value. This is not possible if the table is not empty.
  - Added the required column `durationMs` to the `TestResult` table without a default value. This is not possible if the table is not empty.
  - Added the required column `observationsJson` to the `TestResult` table without a default value. This is not possible if the table is not empty.
  - Added the required column `startedAt` to the `TestResult` table without a default value. This is not possible if the table is not empty.
  - Added the required column `title` to the `TestResult` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Project" ADD COLUMN "description" TEXT;

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_FlowStep" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "flowId" TEXT NOT NULL,
    "stepKey" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "action" TEXT NOT NULL,
    "configJson" TEXT NOT NULL,
    "timeoutMs" INTEGER,
    CONSTRAINT "FlowStep_flowId_fkey" FOREIGN KEY ("flowId") REFERENCES "Flow" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_FlowStep" ("action", "flowId", "id", "position", "timeoutMs") SELECT "action", "flowId", "id", "position", "timeoutMs" FROM "FlowStep";
DROP TABLE "FlowStep";
ALTER TABLE "new_FlowStep" RENAME TO "FlowStep";
CREATE UNIQUE INDEX "FlowStep_flowId_position_key" ON "FlowStep"("flowId", "position");
CREATE UNIQUE INDEX "FlowStep_flowId_stepKey_key" ON "FlowStep"("flowId", "stepKey");
CREATE TABLE "new_Scenario" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "flowId" TEXT NOT NULL,
    "scenarioKey" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "family" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "configJson" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Scenario_flowId_fkey" FOREIGN KEY ("flowId") REFERENCES "Flow" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Scenario" ("configJson", "createdAt", "enabled", "family", "id", "name", "updatedAt") SELECT "configJson", "createdAt", "enabled", "family", "id", "name", "updatedAt" FROM "Scenario";
DROP TABLE "Scenario";
ALTER TABLE "new_Scenario" RENAME TO "Scenario";
CREATE INDEX "Scenario_flowId_family_idx" ON "Scenario"("flowId", "family");
CREATE UNIQUE INDEX "Scenario_flowId_scenarioKey_key" ON "Scenario"("flowId", "scenarioKey");
CREATE TABLE "new_TestResult" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "testRunId" TEXT NOT NULL,
    "scenarioId" TEXT,
    "kind" TEXT NOT NULL,
    "scenarioFamily" TEXT,
    "status" TEXT NOT NULL,
    "failureOrigin" TEXT,
    "title" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "durationMs" INTEGER NOT NULL,
    "finalUrl" TEXT,
    "startedAt" DATETIME NOT NULL,
    "completedAt" DATETIME NOT NULL,
    "executionErrorJson" TEXT,
    "evidenceJson" TEXT NOT NULL,
    "observationsJson" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TestResult_testRunId_fkey" FOREIGN KEY ("testRunId") REFERENCES "TestRun" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TestResult_scenarioId_fkey" FOREIGN KEY ("scenarioId") REFERENCES "Scenario" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_TestResult" ("createdAt", "evidenceJson", "failureOrigin", "id", "kind", "scenarioId", "status", "summary", "testRunId") SELECT "createdAt", "evidenceJson", "failureOrigin", "id", "kind", "scenarioId", "status", "summary", "testRunId" FROM "TestResult";
DROP TABLE "TestResult";
ALTER TABLE "new_TestResult" RENAME TO "TestResult";
CREATE INDEX "TestResult_testRunId_idx" ON "TestResult"("testRunId");
CREATE INDEX "TestResult_scenarioId_idx" ON "TestResult"("scenarioId");
CREATE TABLE "new_TestRun" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "flowId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'RUNNING',
    "baselineStatus" TEXT,
    "totalScenarios" INTEGER NOT NULL DEFAULT 0,
    "passedCount" INTEGER NOT NULL DEFAULT 0,
    "failedCount" INTEGER NOT NULL DEFAULT 0,
    "needsReviewCount" INTEGER NOT NULL DEFAULT 0,
    "errorCount" INTEGER NOT NULL DEFAULT 0,
    "errorMessage" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedAt" DATETIME,
    "completedAt" DATETIME,
    CONSTRAINT "TestRun_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TestRun_flowId_fkey" FOREIGN KEY ("flowId") REFERENCES "Flow" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_TestRun" ("completedAt", "createdAt", "flowId", "id", "projectId", "startedAt", "status") SELECT "completedAt", "createdAt", "flowId", "id", "projectId", "startedAt", "status" FROM "TestRun";
DROP TABLE "TestRun";
ALTER TABLE "new_TestRun" RENAME TO "TestRun";
CREATE INDEX "TestRun_projectId_createdAt_idx" ON "TestRun"("projectId", "createdAt");
CREATE INDEX "TestRun_flowId_idx" ON "TestRun"("flowId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

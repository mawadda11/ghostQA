-- Phase 7.1: support read-only flows and multiple step-bound assertions while
-- preserving the legacy final success assertion for existing flows.
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;

CREATE TABLE "new_Flow" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "criticalActionJson" TEXT,
    "successAssertionJson" TEXT,
    "assertionsJson" TEXT NOT NULL DEFAULT '[]',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Flow_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

INSERT INTO "new_Flow" (
    "id", "projectId", "name", "criticalActionJson",
    "successAssertionJson", "assertionsJson", "createdAt", "updatedAt"
)
SELECT
    "id", "projectId", "name", "criticalActionJson",
    "successAssertionJson", '[]', "createdAt", "updatedAt"
FROM "Flow";

DROP TABLE "Flow";
ALTER TABLE "new_Flow" RENAME TO "Flow";
CREATE INDEX "Flow_projectId_idx" ON "Flow"("projectId");

PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

import process from "node:process";
import { fileURLToPath } from "node:url";

import {
  assertDevelopmentDatabaseUnchanged,
  createIsolatedDatabase,
  databaseFingerprint,
  serverRoot,
  spawnCommand,
} from "./isolated-database.mjs";

const vitestCliPath = fileURLToPath(import.meta.resolve("vitest/vitest.mjs"));
const developmentBefore = await databaseFingerprint();
const isolated = await createIsolatedDatabase("server-tests");
let exitCode = 1;
try {
  exitCode = await spawnCommand(process.execPath, [vitestCliPath, "run"], {
    cwd: serverRoot,
    env: isolated.environment,
  });
  await assertDevelopmentDatabaseUnchanged(developmentBefore);
} finally {
  await isolated.cleanup();
}
process.exitCode = exitCode;

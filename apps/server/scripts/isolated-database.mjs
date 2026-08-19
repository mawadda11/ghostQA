import { createHash, randomUUID } from "node:crypto";
import console from "node:console";
import { copyFile, cp, mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import process from "node:process";
import { fileURLToPath, URL } from "node:url";
import { spawn } from "node:child_process";

export const serverRoot = fileURLToPath(new URL("../", import.meta.url));
export const repositoryRoot = path.resolve(serverRoot, "..", "..");
export const developmentDatabasePath = path.join(
  serverRoot,
  "prisma",
  "dev.db",
);

const prismaCliPath = fileURLToPath(
  import.meta.resolve("prisma/build/index.js"),
);

export const sqliteUrlForPath = (databasePath) =>
  `file:${path.resolve(databasePath).replaceAll("\\", "/")}`;

export const spawnCommand = (command, args, options = {}) =>
  new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: "inherit",
      ...options,
    });
    child.once("error", reject);
    child.once("exit", (code, signal) => {
      if (signal !== null) {
        reject(new Error(`${command} exited after signal ${signal}.`));
        return;
      }
      resolve(code ?? 1);
    });
  });

export const databaseFingerprint = async () => {
  try {
    const contents = await readFile(developmentDatabasePath);
    return createHash("sha256").update(contents).digest("hex");
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      return "missing";
    }
    throw error;
  }
};

export const assertDevelopmentDatabaseUnchanged = async (before) => {
  const after = await databaseFingerprint();
  if (after !== before) {
    throw new Error(
      "The GhostQA development database changed during an isolated automated test run.",
    );
  }
};

const testSchema = async (temporaryRoot) => {
  const sourceSchemaPath = path.join(serverRoot, "prisma", "schema.prisma");
  const temporarySchemaPath = path.join(temporaryRoot, "schema.prisma");
  const source = await readFile(sourceSchemaPath, "utf8");
  const expected = 'url      = "file:./dev.db"';
  if (!source.includes(expected)) {
    throw new Error("The Prisma development datasource declaration was not recognized.");
  }
  await writeFile(
    temporarySchemaPath,
    source.replace(expected, 'url      = env("DATABASE_URL")'),
    "utf8",
  );
  await cp(
    path.join(serverRoot, "prisma", "migrations"),
    path.join(temporaryRoot, "migrations"),
    { recursive: true },
  );
  const lockPath = path.join(serverRoot, "prisma", "migration_lock.toml");
  try {
    await copyFile(lockPath, path.join(temporaryRoot, "migration_lock.toml"));
  } catch (error) {
    if (!(error instanceof Error && "code" in error && error.code === "ENOENT")) {
      throw error;
    }
  }
  return temporarySchemaPath;
};

export const createIsolatedDatabase = async (label) => {
  const temporaryRoot = await mkdtemp(
    path.join(tmpdir(), `ghostqa-${label}-${randomUUID()}-`),
  );
  const databasePath = path.join(temporaryRoot, "test.db");
  const artifactRoot = path.join(temporaryRoot, "artifacts");
  await mkdir(artifactRoot, { recursive: true });
  await writeFile(databasePath, "");
  const schemaPath = await testSchema(temporaryRoot);
  const environment = {
    ...process.env,
    NODE_ENV: "test",
    GHOSTQA_TEST_DATABASE: "isolated",
    DATABASE_URL: sqliteUrlForPath(databasePath),
    ARTIFACTS_ROOT: artifactRoot,
  };
  const migrationExitCode = await spawnCommand(
    process.execPath,
    [prismaCliPath, "migrate", "deploy", "--schema", schemaPath],
    { cwd: serverRoot, env: environment },
  );
  if (migrationExitCode !== 0) {
    await rm(temporaryRoot, { recursive: true, force: true, maxRetries: 5 });
    throw new Error(`Test database migration failed with exit code ${migrationExitCode}.`);
  }

  console.log(`GhostQA isolated test database: ${databasePath}`);
  return {
    databasePath,
    environment,
    temporaryRoot,
    async cleanup() {
      await rm(temporaryRoot, {
        recursive: true,
        force: true,
        maxRetries: 10,
        retryDelay: 100,
      });
      console.log(`Removed GhostQA isolated test database: ${databasePath}`);
    },
  };
};

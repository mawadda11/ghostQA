import { spawn } from "node:child_process";
import { createServer } from "node:net";
import path from "node:path";
import process from "node:process";
import { clearTimeout, setTimeout } from "node:timers";
import { fileURLToPath } from "node:url";

import {
  assertDevelopmentDatabaseUnchanged,
  createIsolatedDatabase,
  databaseFingerprint,
  repositoryRoot,
  spawnCommand,
} from "./isolated-database.mjs";

const dashboardEnabled = process.argv.includes("--dashboard");
const fetchUrl = globalThis.fetch;
const testFile = process.argv.at(-1);
if (testFile === undefined || testFile.startsWith("--")) {
  throw new Error("An isolated E2E test file is required.");
}

const allocatedPorts = new Set();
const availablePort = () =>
  new Promise((resolve, reject) => {
    const server = createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (address === null || typeof address === "string") {
        reject(new Error("Could not allocate an isolated test port."));
        return;
      }
      if (allocatedPorts.has(address.port)) {
        server.close((error) => {
          if (error !== undefined) reject(error);
          else availablePort().then(resolve, reject);
        });
        return;
      }
      allocatedPorts.add(address.port);
      server.close((error) =>
        error === undefined ? resolve(address.port) : reject(error),
      );
    });
  });

const waitForUrl = async (url, label) => {
  const deadline = Date.now() + 20_000;
  while (Date.now() < deadline) {
    try {
      const response = await fetchUrl(url);
      if (response.ok) return;
    } catch {
      // The isolated child process is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`${label} did not become ready at ${url}.`);
};

const background = (args, options) =>
  spawn(process.execPath, args, { stdio: "inherit", ...options });

const stopChild = async (child) => {
  if (child.exitCode !== null || child.signalCode !== null) return;
  child.kill("SIGTERM");
  await new Promise((resolve) => {
    const timeout = setTimeout(() => {
      child.kill("SIGKILL");
      resolve();
    }, 5_000);
    child.once("exit", () => {
      clearTimeout(timeout);
      resolve();
    });
  });
};

const developmentBefore = await databaseFingerprint();
const isolated = await createIsolatedDatabase("e2e");
const serverPort = await availablePort();
const targetPort = await availablePort();
const dashboardPort = dashboardEnabled ? await availablePort() : undefined;
const serverUrl = `http://127.0.0.1:${serverPort}`;
const targetUrl = `http://127.0.0.1:${targetPort}`;
const dashboardUrl =
  dashboardPort === undefined
    ? undefined
    : `http://127.0.0.1:${dashboardPort}`;
const demoRoot = path.join(repositoryRoot, "apps", "demo-target");
const dashboardRoot = path.join(repositoryRoot, "apps", "dashboard");
const children = [];
let exitCode = 1;

try {
  const target = background(
    [path.join(demoRoot, "dist-server", "index.js"), "--production"],
    {
      cwd: demoRoot,
      env: { ...process.env, GHOSTSHOP_PORT: String(targetPort) },
    },
  );
  children.push(target);
  await waitForUrl(targetUrl, "GhostShop");

  const server = background([path.join(repositoryRoot, "apps", "server", "dist", "index.js")], {
    cwd: path.join(repositoryRoot, "apps", "server"),
    env: {
      ...isolated.environment,
      PORT: String(serverPort),
      ALLOWED_TARGET_HOSTS: "127.0.0.1",
      DASHBOARD_ORIGINS: dashboardUrl ?? "http://127.0.0.1:5173",
    },
  });
  children.push(server);
  await waitForUrl(`${serverUrl}/health`, "GhostQA server");

  if (dashboardUrl !== undefined && dashboardPort !== undefined) {
    const vitePackage = fileURLToPath(import.meta.resolve("vite/package.json"));
    const viteCli = path.join(path.dirname(vitePackage), "bin", "vite.js");
    const dashboard = background(
      [
        viteCli,
        "--host",
        "127.0.0.1",
        "--port",
        String(dashboardPort),
        "--strictPort",
      ],
      {
        cwd: dashboardRoot,
        env: {
          ...process.env,
          VITE_GHOSTQA_API_URL: serverUrl,
        },
      },
    );
    children.push(dashboard);
    await waitForUrl(dashboardUrl, "GhostQA dashboard");
  }

  exitCode = await spawnCommand(
    process.execPath,
    ["--test", path.resolve(demoRoot, testFile)],
    {
      cwd: demoRoot,
      env: {
        ...isolated.environment,
        GHOSTQA_SERVER_URL: serverUrl,
        GHOSTSHOP_URL: targetUrl,
        ...(dashboardUrl === undefined
          ? {}
          : { GHOSTQA_DASHBOARD_URL: dashboardUrl }),
      },
    },
  );
} finally {
  for (const child of children.reverse()) await stopChild(child);
  try {
    await assertDevelopmentDatabaseUnchanged(developmentBefore);
  } finally {
    await isolated.cleanup();
  }
}
process.exitCode = exitCode;

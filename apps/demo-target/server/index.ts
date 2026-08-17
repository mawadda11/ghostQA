import express from "express";
import { fileURLToPath } from "node:url";

import { createApiRouter } from "./api.js";

const DEFAULT_PORT = 4173;

const parsePort = (value: string | undefined): number => {
  if (value === undefined) {
    return DEFAULT_PORT;
  }

  const port = Number(value);
  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new Error(`GHOSTSHOP_PORT must be a valid port; received "${value}".`);
  }
  return port;
};

const app = express();
app.disable("x-powered-by");
app.use(express.json());
app.use("/api", createApiRouter());

if (process.argv.includes("--production")) {
  const staticDirectory = fileURLToPath(new URL("../dist", import.meta.url));
  const indexPath = fileURLToPath(new URL("../dist/index.html", import.meta.url));
  app.use(express.static(staticDirectory));
  app.use((request, response, next) => {
    if (request.method === "GET" && request.accepts("html") !== false) {
      response.sendFile(indexPath);
      return;
    }
    next();
  });
} else {
  const { createServer: createViteServer } = await import("vite");
  const vite = await createViteServer({
    appType: "spa",
    server: { middlewareMode: true, hmr: false },
  });
  app.use(vite.middlewares);
}

const port = parsePort(process.env["GHOSTSHOP_PORT"]);
const server = app.listen(port, "127.0.0.1", () => {
  console.log(`GhostShop Demo listening on http://127.0.0.1:${port}`);
});

const shutdown = (signal: NodeJS.Signals): void => {
  console.log(`Received ${signal}; stopping GhostShop Demo.`);
  server.close(() => process.exit(0));
};

process.once("SIGINT", shutdown);
process.once("SIGTERM", shutdown);

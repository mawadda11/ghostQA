import { createApp } from "./app.js";
import { environment } from "./config/environment.js";
import { prisma } from "./db/prisma.js";
import { CaptureSessionService } from "./services/capture.js";

const captureService = new CaptureSessionService({
  prisma,
  allowedHosts: environment.allowedTargetHosts,
});
const app = createApp({ captureService });

const server = app.listen(environment.port, () => {
  console.log(`GhostQA server listening on http://localhost:${environment.port}`);
});

const shutdown = (signal: NodeJS.Signals): void => {
  console.log(`Received ${signal}; shutting down GhostQA server.`);
  server.close(() => {
    void captureService
      .shutdown()
      .then(() => prisma.$disconnect())
      .finally(() => {
        process.exit(0);
      });
  });
};

process.once("SIGINT", shutdown);
process.once("SIGTERM", shutdown);

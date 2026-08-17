# GhostQA Server

The Express API owns request validation, target-host authorization, Prisma/
SQLite persistence, and in-process orchestration of the existing Playwright
engines. The reusable `packages/test-engine` package has no database dependency.

From the repository root:

```bash
npm run db:migrate
npm run server:dev
```

The server listens on `http://127.0.0.1:4000` by default. Its health endpoint is
`GET /health`, and Phase 4 resources live below `/api`. See the root
`.env.example` for target allowlisting, dashboard CORS, port, and artifact-root
configuration.

The development SQLite file is `apps/server/prisma/dev.db`. Do not commit it.
Screenshots and traces remain below the configured artifact root; the database
contains metadata only.

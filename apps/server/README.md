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
`GET /health`, and V1 resources live below `/api`. See the root
`.env.example` for target allowlisting, dashboard CORS, port, and artifact-root
configuration.

The development SQLite file is `apps/server/prisma/dev.db`. Do not commit it.
Screenshots and traces remain below the configured artifact root; the database
contains metadata only.

The migration command creates the SQLite file when absent without truncating an
existing database, then applies the checked-in Prisma migrations.

`npm run db:status` verifies that the two checked-in migrations are current.
The API returns stable JSON errors without raw stack traces, and artifact files
are resolved from database IDs with traversal and symlink containment checks.

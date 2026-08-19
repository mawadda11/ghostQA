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

`npm test` runs through `scripts/run-isolated-tests.mjs`. It creates a unique
SQLite database under the operating-system temporary directory, applies all
Prisma migrations, supplies its absolute path through `DATABASE_URL`, verifies
that `dev.db` did not change, and removes the temporary database. In test mode,
the Prisma singleton rejects missing isolation metadata, relative SQLite URLs,
and the development database path.

The migration command creates the SQLite file when absent without truncating an
existing database, then applies the checked-in Prisma migrations.

`npm run db:status` verifies that the checked-in migrations are current.
The API returns stable JSON errors without raw stack traces, and artifact files
are resolved from database IDs with traversal and symlink containment checks.

Interactive baseline capture uses transient in-memory sessions:

- `POST /api/projects/:projectId/capture/start`
- `GET /api/capture/:captureId`
- `POST /api/capture/:captureId/stop`
- `POST /api/capture/:captureId/cancel`

The capture service reauthorizes the persisted project target, owns headed
Chromium cleanup, and returns a review draft without persisting it. The dashboard
saves the confirmed ordinary flow through `POST /api/projects/:projectId/flows`.

Baseline replay and visual test-plan endpoints are:

- `POST /api/flows/:flowId/replay`
- `GET /api/flows/:flowId/test-plan/recommendations`
- `PUT /api/flows/:flowId/test-plan`

Recommendations are deterministic and persisted plans remain the existing
validated scenario definitions.

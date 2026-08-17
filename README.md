# GhostQA

**Adaptive Web Behavior Testing Platform**

GhostQA is a software testing platform that takes a known-good web application flow, generates relevant failure/behavior scenarios, executes them in a real browser, and reports evidence-backed PASS / FAIL / NEEDS_REVIEW results.

## Core idea

Traditional tests usually validate scenarios developers already thought about. GhostQA focuses on realistic behavior and runtime failure conditions around a known-good flow, such as:

- double action / duplicate submission
- API failure
- slow API response
- refresh or back-navigation at critical checkpoints
- session expiry

GhostQA does not replace unit, integration, or traditional end-to-end tests. It adds a behavioral/failure-testing layer above them.

## V1 scope

- Web applications only
- Chromium only
- localhost or explicitly allowlisted staging hosts
- Playwright-based browser automation
- deterministic testing engine; no LLM dependency in V1
- five scenario families only
- local SQLite database
- React + TypeScript dashboard
- Node.js + TypeScript + Express backend

## Repository layout

```text
ghostqa/
├── apps/
│   ├── dashboard/      # GhostQA UI
│   ├── server/         # API + orchestration
│   └── demo-target/    # GhostShop deliberately buggy demo app
├── packages/
│   ├── test-engine/    # Playwright execution engine
│   └── shared/         # Shared types/schemas
├── docs/
├── artifacts/          # Local screenshots/traces; ignored by git
└── README.md
```

## Demo target

**GhostShop Demo** is intentionally seeded with known behavioral bugs so
GhostQA can prove it detects real failures.

## Start here

Read:

1. `docs/PROJECT_SCOPE.md`
2. `docs/ARCHITECTURE.md`
3. `AGENTS.md`

Then use Codex to implement the project incrementally.

## Local Phase 4 workflow

Install dependencies and apply the checked-in SQLite migrations:

```bash
npm install
npm run db:migrate
```

Run GhostShop, then the GhostQA server, in separate terminals:

```bash
npm run demo:dev
npm run server:dev
```

Seed the demo configuration and execute a real persisted run from a third
terminal:

```bash
npm run demo:seed
npm run demo:persisted-run
```

The default local ports are `4173` for GhostShop, `4000` for the API, and `5173`
for the Vite dashboard. The SQLite database is
`apps/server/prisma/dev.db`. Screenshots and traces are stored as files below
`artifacts/runs/<run-id>/`; SQLite stores only validated metadata and relative
paths. Both locations are ignored by git.

Use `GHOSTSHOP_PORT`, `GHOSTSHOP_URL`, `PORT`, `GHOSTQA_SERVER_URL`,
`ALLOWED_TARGET_HOSTS`, `DASHBOARD_ORIGINS`, and `ARTIFACTS_ROOT` to override
local defaults. `GHOSTSHOP_URL` used by the demo commands must match the target
saved through the API.

The direct Phase 2 and Phase 3 engine demonstrations remain available:

```bash
npm run demo:baseline
npm run demo:scenarios
```

## Status

Phase 4 is implemented: the Express application persists projects, normalized
flows, deterministic scenario plans, runs, structured results, and artifact
metadata through Prisma/SQLite. It orchestrates the existing generic Playwright
baseline and scenario engines sequentially and exposes read APIs for the Phase 5
dashboard. GhostShop configuration remains outside the reusable engine.

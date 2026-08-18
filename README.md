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

## Local V1 workflow

Install dependencies and apply the checked-in SQLite migrations:

```bash
npm install
npm run db:migrate
```

Run the three applications in separate terminals:

```bash
# Terminal 1: controlled target fixture
npm run demo:dev

# Terminal 2: API, orchestration, and persistence
npm run server:dev

# Terminal 3: dashboard
npm run dashboard:dev
```

With GhostShop and the server running, seed the demo configuration from another
terminal:

```bash
npm run demo:seed
```

Open `http://127.0.0.1:5173`, select GhostShop, open its baseline flow, and use
**Run tests**. The dashboard invokes the real server orchestrator and reopens
results from SQLite after refresh. `npm run demo:persisted-run` remains available
for a command-line backend demonstration, and `npm run demo:test:dashboard`
runs the opt-in real Chromium dashboard proof when all three apps are running.

The default local ports are `4173` for GhostShop, `4000` for the API, and `5173`
for the Vite dashboard. The SQLite database is
`apps/server/prisma/dev.db`. Screenshots and traces are stored as files below
`artifacts/runs/<run-id>/`; SQLite stores only validated metadata and relative
paths. Both locations are ignored by git.

Use `GHOSTSHOP_PORT`, `GHOSTSHOP_URL`, `PORT`, `GHOSTQA_SERVER_URL`,
`VITE_GHOSTQA_API_URL`,
`ALLOWED_TARGET_HOSTS`, `DASHBOARD_ORIGINS`, and `ARTIFACTS_ROOT` to override
local defaults. `GHOSTSHOP_URL` used by the demo commands must match the target
saved through the API.

The direct Phase 2 and Phase 3 engine demonstrations remain available:

```bash
npm run demo:baseline
npm run demo:scenarios
```

## Status

GhostQA V1 through Phase 5 is implemented. The dashboard manages projects,
imports normalized flows and explicit scenario plans, starts real browser runs,
and presents persisted evidence, screenshots, and trace downloads from the
Express/Prisma backend. GhostShop is only the controlled, deliberately buggy
demo target; the dashboard, server services, contracts, and Playwright engine
remain generic.

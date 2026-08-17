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

The repository will contain a small demo application named **GhostShop Demo**. It is intentionally seeded with known behavioral bugs so GhostQA can prove it detects real failures.

## Start here

Read:

1. `docs/PROJECT_SCOPE.md`
2. `docs/ARCHITECTURE.md`
3. `AGENTS.md`

Then use Codex to implement the project incrementally.

## Status

Starter repository only. Implementation is intentionally left to the development phase.

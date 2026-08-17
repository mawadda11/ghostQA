# GhostQA — Codex Start Prompt

Open this repository and read `README.md`, `docs/PROJECT_SCOPE.md`, `docs/ARCHITECTURE.md`, and `AGENTS.md` before changing code.

Build GhostQA incrementally according to those files. Do not expand the V1 scope.

Start by:

1. Proposing a concise implementation plan.
2. Confirming the monorepo package boundaries.
3. Defining the Prisma data model.
4. Defining the interface between the server and `packages/test-engine`.
5. Identifying only architecture-changing assumptions.

Then implement Phase 1:

- initialize npm workspaces cleanly
- initialize the React/Vite dashboard
- initialize the Express server
- initialize Prisma + SQLite
- initialize shared TypeScript contracts
- initialize the test-engine package
- add root scripts for dev/build/test/lint/typecheck
- keep TypeScript strict
- add a health endpoint
- add a minimal dashboard shell
- add target-host allowlisting utility with unit tests

After Phase 1, run all relevant checks, fix failures, and summarize exactly what was completed and what remains.

Do not build AI functionality. Do not implement GitHub integration. Do not add Docker or cloud infrastructure.

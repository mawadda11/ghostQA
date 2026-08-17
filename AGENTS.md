# Codex Instructions for GhostQA

You are implementing GhostQA, a portfolio-quality adaptive web behavior testing platform.

## Read first

Before making architectural changes, read:

- README.md
- docs/PROJECT_SCOPE.md
- docs/ARCHITECTURE.md

## Core rule

Do not turn GhostQA into a chatbot, generic AI wrapper, vulnerability scanner, crawler, or large CI platform.

The V1 product value is real browser execution and evidence-backed behavioral/failure testing.

## Scope discipline

V1 uses:

- TypeScript
- React + Vite + Tailwind
- Node.js + Express
- Playwright
- Chromium only
- Prisma + SQLite
- npm workspaces

Exactly five scenario families:

1. Double Action
2. API Failure
3. Slow Response
4. Refresh / Back Navigation
5. Session Expiry

Do not add major features unless explicitly requested.

## Engineering quality

- Keep TypeScript strict.
- Prefer small modules with clear responsibilities.
- Do not hard-code GhostShop behavior into the reusable test engine.
- Avoid arbitrary sleeps; wait on observable browser conditions.
- Never fabricate PASS/FAIL evidence.
- Use NEEDS_REVIEW when correctness cannot be determined safely.
- Separate TARGET_APP_FAILURE from GHOSTQA_ENGINE_FAILURE.
- Add automated tests as implementation progresses.
- Keep secrets out of git.

## Workflow

Implement incrementally and keep the repository runnable after each phase.

After meaningful changes run the relevant:

- typecheck
- lint
- tests

Fix failures before moving on.

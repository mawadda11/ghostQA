# GhostQA Test Engine

Reusable Chromium-only Playwright execution package. It provides the validated
baseline runner plus separate executors for Double Action, API Failure, Slow
Response, Refresh/Back Navigation, and Session Expiry. Scenario execution uses
typed configuration, fresh browser contexts, controlled network/navigation
injection, structured evidence, deterministic classifiers, conditional
screenshots, and traces.

The baseline runner evaluates step-bound assertions immediately after their
referenced step and retains the original final assertion behavior. It supports
read-only flows without a critical action; mutation-dependent scenario
executors reject such flows explicitly while Refresh/Back remains available.

It also provides the persistence-free interactive capture engine. A dedicated
headed Chromium context observes meaningful rendered-DOM interactions and safe
network metadata, then deterministically normalizes them into the existing
`NormalizedFlow` step model. Capture does not record screen pixels, video,
headers, or request/response bodies. The engine owns browser cleanup but knows
nothing about Express sessions, Prisma, or flow persistence.

GhostShop routes, copy, selectors, and credentials remain in
`apps/demo-target/baseline` and `apps/demo-target/scenarios`; this package
contains no target-specific behavior.

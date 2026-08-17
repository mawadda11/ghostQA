# GhostQA Test Engine

Reusable Chromium-only Playwright execution package. It provides the validated
baseline runner plus separate executors for Double Action, API Failure, Slow
Response, Refresh/Back Navigation, and Session Expiry. Scenario execution uses
typed configuration, fresh browser contexts, controlled network/navigation
injection, structured evidence, deterministic classifiers, conditional
screenshots, and traces.

GhostShop routes, copy, selectors, and credentials remain in
`apps/demo-target/baseline` and `apps/demo-target/scenarios`; this package
contains no target-specific behavior.

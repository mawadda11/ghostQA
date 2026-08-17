# GhostQA Test Engine

Reusable Playwright execution package. Phase 2 provides a Chromium-only baseline
runner with normalized locators and steps, host validation, isolated contexts,
network and console observation, success assertion evaluation, deterministic
classification, and screenshot/trace artifacts.

GhostShop routes, copy, selectors, and credentials remain in
`apps/demo-target/baseline`; this package contains no target-specific behavior.

Failure scenario execution is intentionally deferred to a later phase.

# GhostQA V1 Project Scope

## Product statement

GhostQA is an adaptive web behavior testing platform. A developer supplies a known-good baseline flow for a web application. GhostQA replays the flow under selected failure and user-behavior conditions, observes the real browser/network behavior, and produces evidence-backed results.

## Primary user

Software developers and QA engineers testing web applications they own or control.

## V1 goals

1. Register a web project and allowlisted target URL.
2. Import/register a baseline Playwright flow.
3. Configure a critical action and a simple success assertion.
4. Validate the baseline flow first.
5. Generate a test plan from exactly five scenario families.
6. Run every scenario in an isolated Chromium context.
7. Collect network observations, console errors, final URL, screenshot, and trace where useful.
8. Classify each run as PASS, FAIL, NEEDS_REVIEW, or ERROR.
9. Store runs/results in SQLite.
10. Provide a clean developer-oriented dashboard.
11. Include GhostShop Demo with intentionally seeded bugs.

## V1 scenario families

### 1. Double Action
Trigger the configured critical action twice quickly and observe duplicate mutations or inconsistent final state.

### 2. API Failure
Intercept a relevant request and return HTTP 500. Observe whether the application handles failure safely.

### 3. Slow Response
Delay a relevant request and observe duplicate actions, broken loading behavior, timeouts, and final state.

### 4. Refresh / Back Navigation
Reload or navigate back at selected checkpoints and observe state loss, duplicate mutation, loops, or crashes.

### 5. Session Expiry
Invalidate session state or mock HTTP 401 during an authenticated flow and observe application recovery.

## Result philosophy

GhostQA must never invent certainty.

- PASS: evidence supports correct behavior.
- FAIL: evidence clearly supports broken behavior.
- NEEDS_REVIEW: scenario ran but business correctness cannot be determined safely.
- ERROR: GhostQA itself could not execute the scenario correctly.

## Safety boundary

V1 targets only localhost, 127.0.0.1, or explicitly configured staging hosts.

Do not implement:

- arbitrary public-site scanning
- crawling
- security exploitation
- authentication bypass
- destructive testing
- vulnerability scanning

## Non-goals

Do not implement in V1:

- AI chatbot or LLM dependency
- GitHub integration
- CI/CD integration
- production testing by default
- native mobile testing
- Firefox/WebKit
- multi-user teams
- billing/subscriptions
- distributed workers
- accessibility auditing
- load testing
- visual regression platform

## Definition of Done

The MVP is complete when GhostQA can run against GhostShop Demo, detect at least the seeded duplicate-order and broken-API-failure behaviors, store real evidence, and reopen previous run results from the dashboard.

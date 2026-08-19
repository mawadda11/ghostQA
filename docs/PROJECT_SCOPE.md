# GhostQA V1 Project Scope

## Product statement

GhostQA is an adaptive web behavior testing platform. A developer captures a
known-good journey from rendered browser behavior, or imports its normalized
JSON as an advanced option. GhostQA replays the flow under selected failure and
user-behavior conditions, observes the real browser/network behavior, and
produces evidence-backed results.

## Primary user

Software developers and QA engineers testing web applications they own or control.

## V1 goals

1. Register a web project and allowlisted target URL.
2. Capture, review, and register a normalized baseline flow; retain JSON import.
3. Configure optional critical-action metadata and one or more user-confirmed
   assertions/checkpoints, including the existing final assertion.
4. Validate the baseline flow first.
5. Generate a focused deterministic test plan from exactly five scenario
   families, selecting only applicable instances and allowing visual overrides.
6. Run every scenario in an isolated Chromium context.
7. Collect network observations, console errors, final URL, screenshot, and trace where useful.
8. Classify each run as PASS, FAIL, NEEDS_REVIEW, or ERROR.
9. Store runs/results in SQLite.
10. Provide a clean developer-oriented dashboard where one Project (target
    application) can contain multiple independent captured Flows (journeys).
11. Include GhostShop Demo with intentionally seeded bugs.
12. Keep capture semantic and local: no video, source analysis, or public browsing.

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

## V1 completion criteria

V1 is complete when GhostQA can capture and replay a generic known-good baseline,
validate the GhostShop baseline, execute all six configured instances across the
five scenario families, detect the four seeded defects with real evidence,
persist results and artifact metadata, and reopen the complete run from the
dashboard after refresh.

The primary workflow is Project → Capture → Review → Save → Replay Baseline →
Focused Plan → Run → Evidence. JSON imports remain advanced escape hatches.
Scenario availability comes only from captured structure and explicitly
confirmed configuration; GhostQA does not infer business intent or claim every
scenario applies. Navigation/read-only flows are valid without a critical
action. One Project may contain multiple Flows, and their plans and runs remain
independent.

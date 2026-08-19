# GhostQA — Adaptive Web Behavior Testing Platform

## Project

GhostQA is a full-stack TypeScript testing platform that validates a known-good
web journey, mutates it under controlled failure and user-behavior conditions in
real Chromium, and presents evidence-backed results.

## Problem

Happy-path E2E tests answer whether an expected journey works. They often do not
exercise duplicate input, failed or delayed APIs, navigation during a critical
step, or expired sessions. Those behaviors can leave a web application in a
broken or ambiguous state even when its ordinary E2E suite passes.

## Solution

GhostQA runs five bounded scenario families around a normalized baseline. It
observes actual browser, network, navigation, assertion, and artifact evidence,
then classifies outcomes deterministically as `PASS`, `FAIL`, `NEEDS_REVIEW`, or
`ERROR`. It never substitutes a generated risk score for observed behavior.

## My implementation

- designed a normalized, locator-driven baseline model with optional mutation
  metadata and step-bound assertions/checkpoints;
- built generic Playwright baseline and scenario engines with isolated contexts;
- implemented duplicate action, HTTP 500/401 injection, bounded response delay,
  refresh, back-navigation, and client-storage invalidation;
- added deterministic focused-plan selection and visual overrides without a
  second scenario format or AI dependency;
- strengthened duplicate proof with redacted identifier fingerprints and
  failure/delay evidence with automatic critical-control observation;
- separated target failures from GhostQA engine failures;
- captured structured evidence, network/console observations, screenshots, and traces;
- added Express validation, allowlisting, orchestration, and safe artifact access;
- persisted projects, flows, scenarios, runs, results, and artifact metadata with Prisma/SQLite;
- built a responsive React dashboard for semantic capture, baseline-only replay,
  deterministic visual test-plan configuration, execution, history, and evidence;
- created GhostShop as a controlled fixture with four deterministic defects;
- added unit, integration, persistence, and real Chromium dashboard proofs.

## Technical decisions

- **TypeScript across the stack:** shared contracts keep API, persistence, and
  execution boundaries aligned under strict compiler settings.
- **Chromium-only V1:** one browser keeps the initial behavioral model focused
  and the real integration suite reproducible.
- **Deterministic classification:** explicit evidence supports defensible
  outcomes; inconclusive behavior becomes `NEEDS_REVIEW`.
- **Focused test budget:** captured evidence selects only applicable, runnable
  scenarios while Session Expiry and unsafe navigation assumptions stay manual.
- **Isolated browser contexts:** every execution begins with fresh state and
  closes tracing, context, and browser resources through failure paths.
- **Persistence-independent engine:** Playwright code depends only on shared
  contracts; Express/Prisma mapping stays in the server.
- **Controlled fixture:** GhostShop makes failure behavior repeatable without
  embedding storefront assumptions in the product.

## Example detected defects

An actual GhostShop run produced:

```text
Baseline: PASS
Double Action: FAIL
API Failure: FAIL
Slow Response: PASS
Refresh: FAIL
Back: PASS
Session Expiry: FAIL
```

The failures correspond to duplicate order creation, unsafe API-error recovery,
refresh state loss, and broken session-expiry recovery. Slow Response passes
because the real browser proves one mutation, a stable pending control, a
passing final assertion, and no unexpected page error.

## Tech stack

React, TypeScript, Vite, Tailwind CSS, TanStack Query, Node.js, Express, Zod,
Prisma, SQLite, Playwright, Chromium, Vitest, Testing Library, and npm workspaces.

## Interview explanation

> GhostQA is a full-stack behavior-testing platform I built to cover the gap
> between a passing happy-path E2E test and real failure behavior. You register a
> known-good journey, then GhostQA reruns it in isolated Chromium contexts while
> injecting bounded scenarios such as a double action, HTTP failure, slow
> response, navigation, or session expiry. It classifies only from observed
> evidence, persists the result and artifact metadata through Express and
> Prisma, and makes the run inspectable in a React dashboard. The engine is
> generic; a deliberately buggy GhostShop app is only the controlled proof
> fixture.

GhostQA V1 is intentionally bounded. It does not claim to find every bug and
does not use AI.

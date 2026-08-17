# GhostShop Demo

A deliberately buggy local React application used to prove GhostQA with real
browser and network evidence. It uses an in-memory Express API and no database.

## Run locally

From the repository root:

```bash
npm run demo:dev
```

Open `http://127.0.0.1:4173` and sign in with:

- Email: `demo@ghostqa.dev`
- Password: `ghost123`

The normal journey is Login → Products → Cart → Checkout → Order Confirmation.
The final page displays `Order confirmed`.

## Run the GhostQA baseline

Leave GhostShop running in one terminal, then use a second terminal at the
repository root:

```bash
npm run demo:baseline
```

The command resets demo state, runs the generic Playwright baseline, and writes
evidence under `artifacts/ghostshop/<run-id>/baseline/`.

If port 4173 is already occupied, set matching overrides in the two terminals.
For example in PowerShell:

```powershell
$env:GHOSTSHOP_PORT="4183"; npm run demo:dev
$env:GHOSTSHOP_URL="http://127.0.0.1:4183"; npm run demo:baseline
```

The opt-in real Chromium smoke test also expects GhostShop to be running:

```bash
npm run demo:test:smoke
```

## Run the behavioral scenarios

With GhostShop still running, execute all five scenario families (six instances
because Refresh and Back are separate):

```bash
npm run demo:scenarios
npm run demo:test:scenarios
```

The runner validates the baseline, resets GhostShop before each scenario, and
writes evidence under `artifacts/ghostshop/<run-id>/<scenario-id>/`.

## Run through the persistent backend

With GhostShop and the GhostQA server running, apply migrations once, seed the
known-good flow and six scenario instances idempotently, then start a complete
persisted run:

```bash
npm run db:migrate
npm run demo:seed
npm run demo:persisted-run
```

The opt-in Phase 4 integration proof runs the same real Chromium path and also
reads every result and artifact back through the API:

```bash
npm run demo:test:persisted-run
```

For non-default ports in PowerShell, set matching values before the commands:

```powershell
$env:GHOSTSHOP_URL="http://127.0.0.1:4183"
$env:GHOSTQA_SERVER_URL="http://127.0.0.1:4080"
```

## Fixture API

- `POST /api/session` — deterministic login
- `GET /api/products` — deterministic product retrieval
- `POST /api/orders` — critical order mutation
- `POST /api/test/reset` — reset session, orders, flags, and counters
- `POST /api/test/order-failure` — control seeded HTTP 500 behavior
- `POST /api/test/expire-session` — invalidate the demo session
- `GET /api/test/orders` — inspect orders during manual reproduction

Test controls belong only to this local fixture and are not part of the generic
GhostQA engine.

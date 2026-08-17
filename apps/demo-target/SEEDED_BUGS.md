# GhostShop Seeded Bugs

GhostShop intentionally contains exactly four deterministic behavioral defects.
They are fixture behavior for later GhostQA scenarios and must not leak into the
generic test engine.

Reset the fixture before reproduction:

```bash
curl -X POST http://127.0.0.1:4173/api/test/reset
```

## Bug A — Duplicate Order

Manual reproduction:

1. Complete login, add the product, and reach Checkout.
2. Rapidly activate **Confirm Order** twice.
3. Inspect `GET http://127.0.0.1:4173/api/test/orders`.

Expected correct behavior: the button becomes unavailable or the API enforces an
idempotency key, producing one order.

Intentional behavior: the button remains actionable while submitting and the API
has no idempotency protection. Both requests return `201` with different IDs.

## Bug B — Broken API Failure Handling

Manual reproduction:

1. Reach Checkout.
2. Enable deterministic failure with:

   ```bash
   curl -X POST -H "Content-Type: application/json" -d "{\"enabled\":true}" http://127.0.0.1:4173/api/test/order-failure
   ```

3. Activate **Confirm Order**.

Expected correct behavior: show a useful error and restore an actionable retry
state.

Intentional behavior: the API returns `500`; the UI shows a generic error but
remains stuck in its submitting state.

## Bug C — Refresh State Loss

Manual reproduction:

1. Add the product and reach Checkout.
2. Refresh the browser.

Expected correct behavior: the cart/checkout state survives refresh or is safely
restored from the server.

Intentional behavior: checkout state exists only in React memory. Refresh loses
the cart and displays that checkout details are unavailable.

## Bug D — Session Expiry Problem

Manual reproduction:

1. Reach Checkout.
2. Expire the demo session with:

   ```bash
   curl -X POST http://127.0.0.1:4173/api/test/expire-session
   ```

3. Activate **Confirm Order**.

Expected correct behavior: recognize `401`, preserve recoverable checkout state,
and guide the user through re-authentication.

Intentional behavior: the UI treats `401` as a generic failure, remains on
Checkout, and never clears its submitting state or redirects to Login.

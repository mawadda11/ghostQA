# Seeded Bugs

GhostShop Demo must intentionally contain these V1 behaviors for GhostQA to detect:

1. Duplicate order creation when Confirm Order is triggered twice quickly.
2. Broken UI recovery when the create-order API returns HTTP 500.
3. Checkout state loss after refresh at a selected stage.
4. Incorrect navigation/UI behavior when the session expires during checkout.

Implementation details should remain confined to the demo target and must not leak into the generic GhostQA engine.

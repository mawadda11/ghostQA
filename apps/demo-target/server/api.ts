import { Router } from "express";

import { demoProducts, ghostShopState } from "./state.js";

const DEMO_EMAIL = "demo@ghostqa.dev";
const DEMO_PASSWORD = "ghost123";
const ORDER_RESPONSE_DELAY_MS = 200;

const delayOrderResponse = async (): Promise<void> => {
  await new Promise<void>((resolve) => {
    setTimeout(resolve, ORDER_RESPONSE_DELAY_MS);
  });
};

export const createApiRouter = (): Router => {
  const router = Router();

  router.get("/health", (_request, response) => {
    response.json({ status: "ok", service: "ghostshop-demo" });
  });

  router.post("/test/reset", (_request, response) => {
    ghostShopState.reset();
    response.json({ reset: true });
  });

  router.post("/test/order-failure", (request, response) => {
    const body = request.body as { enabled?: unknown };
    if (typeof body.enabled !== "boolean") {
      response.status(400).json({ error: "enabled must be a boolean" });
      return;
    }

    ghostShopState.orderFailureEnabled = body.enabled;
    response.json({ enabled: ghostShopState.orderFailureEnabled });
  });

  router.post("/test/expire-session", (_request, response) => {
    ghostShopState.authenticated = false;
    response.json({ authenticated: false });
  });

  router.get("/test/orders", (_request, response) => {
    response.json({ orders: ghostShopState.orders });
  });

  router.get("/session", (_request, response) => {
    response.json({ authenticated: ghostShopState.authenticated });
  });

  router.post("/session", (request, response) => {
    const body = request.body as { email?: unknown; password?: unknown };
    if (body.email !== DEMO_EMAIL || body.password !== DEMO_PASSWORD) {
      response.status(401).json({ error: "Invalid demo credentials" });
      return;
    }

    ghostShopState.authenticated = true;
    response.json({ authenticated: true, email: DEMO_EMAIL });
  });

  router.get("/products", (_request, response) => {
    if (!ghostShopState.authenticated) {
      response.status(401).json({ error: "Authentication required" });
      return;
    }

    response.json({ products: demoProducts });
  });

  router.post("/orders", async (request, response) => {
    if (!ghostShopState.authenticated) {
      response.status(401).json({ error: "Session expired" });
      return;
    }

    if (ghostShopState.orderFailureEnabled) {
      response.status(500).json({ error: "Seeded order service failure" });
      return;
    }

    const body = request.body as { productId?: unknown; quantity?: unknown };
    if (
      typeof body.productId !== "string" ||
      body.quantity !== 1 ||
      !demoProducts.some((product) => product.id === body.productId)
    ) {
      response.status(400).json({ error: "Invalid order" });
      return;
    }

    // The mutation is committed before the response and has no idempotency key.
    // The response window makes rapid duplicate submission deterministic.
    const order = ghostShopState.createOrder(body.productId, body.quantity);
    await delayOrderResponse();
    response.status(201).json(order);
  });

  return router;
};

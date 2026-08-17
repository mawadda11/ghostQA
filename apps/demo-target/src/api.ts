import type { Order, Product } from "./types.js";

export class GhostShopApiError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "GhostShopApiError";
    this.status = status;
  }
}

const requestJson = async <T>(
  path: string,
  init?: RequestInit,
): Promise<T> => {
  const response = await fetch(path, init);
  if (!response.ok) {
    throw new GhostShopApiError(response.status, `Request failed (${response.status})`);
  }
  return (await response.json()) as T;
};

export const login = async (email: string, password: string): Promise<void> => {
  await requestJson<{ authenticated: true }>("/api/session", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
};

export const getProducts = async (): Promise<readonly Product[]> => {
  const body = await requestJson<{ products: readonly Product[] }>(
    "/api/products",
  );
  return body.products;
};

export const createOrder = async (productId: string): Promise<Order> =>
  requestJson<Order>("/api/orders", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ productId, quantity: 1 }),
  });

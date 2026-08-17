import type { NormalizedFlow } from "@ghostqa/shared";

export const ghostShopBaselineFlow: NormalizedFlow = {
  id: "ghostshop-checkout-baseline",
  name: "GhostShop known-good checkout",
  steps: [
    { id: "open-login", position: 0, action: "NAVIGATE", path: "/" },
    {
      id: "fill-email",
      position: 1,
      action: "FILL",
      locator: { kind: "LABEL", text: "Email", exact: true },
      value: "demo@ghostqa.dev",
    },
    {
      id: "fill-password",
      position: 2,
      action: "FILL",
      locator: { kind: "LABEL", text: "Password", exact: true },
      value: "ghost123",
    },
    {
      id: "sign-in",
      position: 3,
      action: "CLICK",
      locator: { kind: "ROLE", role: "button", name: "Sign in", exact: true },
    },
    {
      id: "wait-for-products",
      position: 4,
      action: "WAIT_FOR_URL",
      url: "**/products",
    },
    {
      id: "add-product",
      position: 5,
      action: "CLICK",
      locator: {
        kind: "ROLE",
        role: "button",
        name: "Add Aurora Headphones to cart",
        exact: true,
      },
    },
    {
      id: "open-cart",
      position: 6,
      action: "CLICK",
      locator: { kind: "ROLE", role: "link", name: "Cart" },
    },
    {
      id: "start-checkout",
      position: 7,
      action: "CLICK",
      locator: {
        kind: "ROLE",
        role: "link",
        name: "Continue to checkout",
        exact: true,
      },
    },
    {
      id: "confirm-order",
      position: 8,
      action: "CLICK",
      locator: {
        kind: "ROLE",
        role: "button",
        name: "Confirm Order",
        exact: true,
      },
    },
  ],
  criticalAction: {
    stepId: "confirm-order",
    label: "Confirm Order",
    request: { method: "POST", pathname: "/api/orders" },
  },
  successAssertion: {
    kind: "TEXT_VISIBLE",
    text: "Order confirmed",
    exact: true,
  },
};

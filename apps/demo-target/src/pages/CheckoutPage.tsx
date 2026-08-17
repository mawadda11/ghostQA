import { useState } from "react";

import { createOrder } from "../api.js";
import { AppLink } from "../components/AppLink.js";
import type { Order, Product } from "../types.js";

interface CheckoutPageProps {
  product: Product | undefined;
  navigate: (path: string) => void;
  onConfirmed: (order: Order) => void;
}

export const CheckoutPage = ({
  product,
  navigate,
  onConfirmed,
}: CheckoutPageProps) => {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string>();

  const confirmOrder = async (): Promise<void> => {
    if (product === undefined) {
      return;
    }

    setSubmitting(true);
    setError(undefined);

    try {
      const order = await createOrder(product.id);
      onConfirmed(order);
      navigate(`/confirmation/${order.id}`);
    } catch {
      // Seeded behavior: a failed or unauthorized mutation never clears the
      // submitting state, leaving recovery broken for later scenarios to detect.
      setError("The order could not be completed.");
    }
  };

  if (product === undefined) {
    return (
      <main className="page-shell narrow-page">
        <div className="eyebrow">Checkout interrupted</div>
        <h1>Checkout</h1>
        <section className="empty-card">
          <h2>Your checkout details are no longer available</h2>
          <p className="muted">Return to products and rebuild your cart.</p>
          <AppLink className="primary-link" href="/products" navigate={navigate}>
            Return to products
          </AppLink>
        </section>
      </main>
    );
  }

  return (
    <main className="page-shell narrow-page">
      <div className="eyebrow">Final review</div>
      <h1>Checkout</h1>
      <section className="summary-card">
        <div className="checkout-line">
          <div>
            <p className="product-kicker">Shipping to</p>
            <h2>GhostQA Demo Workspace</h2>
            <p className="muted">1 Deterministic Way, Localhost</p>
          </div>
        </div>
        <div className="summary-total">
          <span>{product.name}</span>
          <strong>${product.price.toFixed(2)}</strong>
        </div>
        {error === undefined ? null : (
          <p className="error-message" role="alert">
            {error}
          </p>
        )}
        <button
          aria-busy={submitting}
          aria-label="Confirm Order"
          className="primary-button full-width"
          data-testid="confirm-order"
          onClick={() => void confirmOrder()}
          type="button"
        >
          {submitting ? "Confirming order…" : "Confirm Order"}
        </button>
      </section>
    </main>
  );
};

import { AppLink } from "../components/AppLink.js";
import type { Product } from "../types.js";

interface CartPageProps {
  product: Product | undefined;
  navigate: (path: string) => void;
}

export const CartPage = ({ product, navigate }: CartPageProps) => (
  <main className="page-shell narrow-page">
    <div className="eyebrow">Review your order</div>
    <h1>Cart</h1>

    {product === undefined ? (
      <section className="empty-card">
        <h2>Your cart is empty</h2>
        <p className="muted">Choose the demo product to continue.</p>
        <AppLink className="primary-link" href="/products" navigate={navigate}>
          Browse products
        </AppLink>
      </section>
    ) : (
      <section className="summary-card">
        <div>
          <p className="product-kicker">Quantity 1</p>
          <h2>{product.name}</h2>
          <p className="muted">{product.description}</p>
        </div>
        <strong>${product.price.toFixed(2)}</strong>
        <div className="summary-total">
          <span>Total</span>
          <strong>${product.price.toFixed(2)}</strong>
        </div>
        <AppLink className="primary-link" href="/checkout" navigate={navigate}>
          Continue to checkout
        </AppLink>
      </section>
    )}
  </main>
);

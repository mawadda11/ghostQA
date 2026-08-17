import { AppLink } from "../components/AppLink.js";
import type { Order } from "../types.js";

interface ConfirmationPageProps {
  order: Order | undefined;
  orderIdFromPath: string;
  navigate: (path: string) => void;
}

export const ConfirmationPage = ({
  order,
  orderIdFromPath,
  navigate,
}: ConfirmationPageProps) => (
  <main className="confirmation-layout">
    <section className="confirmation-card">
      <div className="success-mark" aria-hidden="true">
        ✓
      </div>
      <div className="eyebrow">Status: {order?.status ?? "confirmed"}</div>
      <h1>Order confirmed</h1>
      <p className="muted">
        Your deterministic demo order has been created successfully.
      </p>
      <div className="order-id" data-testid="order-id">
        {order?.id ?? orderIdFromPath}
      </div>
      <AppLink className="secondary-link" href="/products" navigate={navigate}>
        Back to products
      </AppLink>
    </section>
  </main>
);

import { useEffect, useState } from "react";

import { getProducts } from "../api.js";
import type { Product } from "../types.js";

interface ProductsPageProps {
  cartProduct: Product | undefined;
  onAddToCart: (product: Product) => void;
}

export const ProductsPage = ({
  cartProduct,
  onAddToCart,
}: ProductsPageProps) => {
  const [products, setProducts] = useState<readonly Product[]>([]);
  const [error, setError] = useState<string>();

  useEffect(() => {
    void getProducts()
      .then(setProducts)
      .catch(() => setError("Products could not be loaded."));
  }, []);

  return (
    <main className="page-shell">
      <div className="page-heading">
        <div>
          <div className="eyebrow">GhostShop collection</div>
          <h1>Products</h1>
        </div>
        <p className="muted">One predictable product. One predictable journey.</p>
      </div>

      {error === undefined ? null : <p className="error-message">{error}</p>}
      <div className="product-grid">
        {products.map((product) => (
          <article className="product-card" data-testid="product-card" key={product.id}>
            <div className="product-art" aria-hidden="true">
              <span>G</span>
            </div>
            <div className="product-content">
              <p className="product-kicker">Workspace audio</p>
              <h2>{product.name}</h2>
              <p className="muted">{product.description}</p>
              <div className="product-footer">
                <strong>${product.price.toFixed(2)}</strong>
                <button
                  className="primary-button"
                  onClick={() => onAddToCart(product)}
                  type="button"
                >
                  {cartProduct?.id === product.id
                    ? "Added to cart"
                    : `Add ${product.name} to cart`}
                </button>
              </div>
            </div>
          </article>
        ))}
      </div>
    </main>
  );
};

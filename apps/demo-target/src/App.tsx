import { useState } from "react";

import { AppLink } from "./components/AppLink.js";
import { CartPage } from "./pages/CartPage.js";
import { CheckoutPage } from "./pages/CheckoutPage.js";
import { ConfirmationPage } from "./pages/ConfirmationPage.js";
import { LoginPage } from "./pages/LoginPage.js";
import { ProductsPage } from "./pages/ProductsPage.js";
import type { Order, Product } from "./types.js";
import { useNavigation } from "./use-navigation.js";

export const App = () => {
  const { path, navigate } = useNavigation();
  const [authenticated, setAuthenticated] = useState(false);
  const [cartProduct, setCartProduct] = useState<Product>();
  const [confirmedOrder, setConfirmedOrder] = useState<Order>();

  const authenticate = (): void => {
    setAuthenticated(true);
    navigate("/products");
  };

  const page = path.startsWith("/confirmation/") ? (
    <ConfirmationPage
      navigate={navigate}
      order={confirmedOrder}
      orderIdFromPath={path.split("/").at(-1) ?? "Unknown order"}
    />
  ) : path === "/checkout" ? (
    <CheckoutPage
      navigate={navigate}
      onConfirmed={setConfirmedOrder}
      product={cartProduct}
    />
  ) : path === "/cart" ? (
    <CartPage navigate={navigate} product={cartProduct} />
  ) : path === "/products" ? (
    <ProductsPage cartProduct={cartProduct} onAddToCart={setCartProduct} />
  ) : (
    <LoginPage onAuthenticated={authenticate} />
  );

  if (!authenticated && path === "/") {
    return page;
  }

  return (
    <div className="store-layout">
      <header className="store-header">
        <AppLink className="brand" href="/products" navigate={navigate}>
          <span className="brand-mark">G</span>
          <span>GhostShop</span>
        </AppLink>
        <nav aria-label="Store navigation">
          <AppLink href="/products" navigate={navigate}>
            Products
          </AppLink>
          <AppLink href="/cart" navigate={navigate}>
            Cart ({cartProduct === undefined ? 0 : 1})
          </AppLink>
        </nav>
      </header>
      {page}
    </div>
  );
};

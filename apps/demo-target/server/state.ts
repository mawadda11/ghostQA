export interface DemoProduct {
  id: string;
  name: string;
  description: string;
  price: number;
}

export interface DemoOrder {
  id: string;
  productId: string;
  quantity: number;
  status: "confirmed";
}

export const demoProducts: readonly DemoProduct[] = [
  {
    id: "prod-aurora-headphones",
    name: "Aurora Headphones",
    description: "Comfortable wireless headphones for focused work.",
    price: 129,
  },
];

class GhostShopState {
  authenticated = false;
  orderFailureEnabled = false;
  orders: DemoOrder[] = [];
  private orderCounter = 1000;

  reset(): void {
    this.authenticated = false;
    this.orderFailureEnabled = false;
    this.orders = [];
    this.orderCounter = 1000;
  }

  createOrder(productId: string, quantity: number): DemoOrder {
    this.orderCounter += 1;
    const order: DemoOrder = {
      id: `GS-${this.orderCounter}`,
      productId,
      quantity,
      status: "confirmed",
    };
    this.orders.push(order);
    return order;
  }
}

export const ghostShopState = new GhostShopState();

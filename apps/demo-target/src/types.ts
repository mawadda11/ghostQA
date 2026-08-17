export interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
}

export interface Order {
  id: string;
  productId: string;
  quantity: number;
  status: "confirmed";
}

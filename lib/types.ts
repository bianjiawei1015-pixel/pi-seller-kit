// Core data shapes for Pi Seller Kit.
// Kept intentionally small for the MVP. When Supabase is added, these same
// types map cleanly to table rows.

export interface Product {
  id: string;
  productName: string;
  pricePi: number;
  description: string;
  imageUrl: string;
  sellerContact: string;
  deliveryNote: string;
  createdAt: string; // ISO timestamp
}

// Mirrors the Pi payment lifecycle so the mock can later be swapped for the
// real SDK without changing the UI:
//   pending   -> payment created, awaiting completion
//   completed -> payment finished successfully
//   cancelled -> buyer cancelled before completing
//   failed    -> an error occurred during payment
export type OrderStatus = "pending" | "completed" | "cancelled" | "failed";

export interface Order {
  orderId: string;
  productId: string;
  productName: string;
  amountPi: number;
  buyerUsername: string;
  status: OrderStatus;
  createdAt: string; // ISO timestamp
  // Reference to the Pi payment. In mock mode this is a fake id; with the real
  // SDK it will be the paymentId returned by Pi.createPayment.
  paymentId?: string;
}

// Form payload used by /create. Same fields as Product minus the generated ones.
export type ProductDraft = Omit<Product, "id" | "createdAt">;

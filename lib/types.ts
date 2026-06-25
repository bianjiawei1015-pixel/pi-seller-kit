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
//   pending     -> order created, payment starting
//   approved    -> server approved the payment with the Pi Platform API
//   paid        -> server completed the payment (txid on chain)
//   cancelled   -> buyer cancelled in the Pi wallet
//   failed      -> an error occurred during payment
//   incomplete  -> an unfinished payment was found and still needs resolving
export type OrderStatus =
  | "pending"
  | "approved"
  | "paid"
  | "cancelled"
  | "failed"
  | "incomplete";

export interface Order {
  orderId: string;
  productId: string;
  productName: string;
  amountPi: number;
  // Public Pi identity of the buyer. uid is stable; username is for display.
  buyerUid: string;
  buyerUsername: string;
  // Pi payment references, filled in as the flow progresses.
  paymentId?: string;
  txid?: string;
  status: OrderStatus;
  createdAt: string; // ISO timestamp
  updatedAt: string; // ISO timestamp, bumped on every status change
}

// Form payload used by /create. Same fields as Product minus the generated ones.
export type ProductDraft = Omit<Product, "id" | "createdAt">;

// Public Pi account info kept after login so the username survives a refresh.
// NEVER contains an accessToken, private key, or any wallet secret.
export interface PiSessionUser {
  uid: string;
  username: string;
}

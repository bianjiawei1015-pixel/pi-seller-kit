// Browser-side API client. Pages and components call these instead of touching
// localStorage or Supabase directly, so the data contract lives in one place.
//
// Each helper returns parsed, typed data or throws an Error carrying the
// server's message. Callers render that message — never a blank screen.

import type { Order, Product, ProductDraft } from "./types";

interface ApiError {
  ok?: boolean;
  message?: string;
  code?: string;
}

async function parseJson(res: Response): Promise<unknown> {
  return res.json().catch(() => null);
}

function messageFrom(payload: unknown, fallback: string): string {
  if (payload && typeof payload === "object") {
    const msg = (payload as ApiError).message;
    if (typeof msg === "string" && msg.length > 0) return msg;
  }
  return fallback;
}

/* ----------------------------- Products ------------------------------- */

export async function fetchProducts(): Promise<Product[]> {
  const res = await fetch("/api/products", { cache: "no-store" });
  const data = await parseJson(res);
  if (!res.ok) throw new Error(messageFrom(data, "Failed to load products."));
  const products = (data as { products?: Product[] })?.products;
  return Array.isArray(products) ? products : [];
}

// Returns null when the product does not exist (HTTP 404). Any other failure
// (e.g. Supabase not configured) throws so the page can show the reason.
export async function fetchProduct(id: string): Promise<Product | null> {
  const res = await fetch(`/api/products/${encodeURIComponent(id)}`, {
    cache: "no-store",
  });
  if (res.status === 404) return null;
  const data = await parseJson(res);
  if (!res.ok) throw new Error(messageFrom(data, "Failed to load product."));
  return (data as { product?: Product })?.product ?? null;
}

// Creates a product. The caller passes a FRESH Pi access token (obtained via
// getPiAccessToken). The server verifies it, derives seller_uid from the
// verified identity, and ignores any client-claimed uid. The token is sent once
// and never stored.
export async function createProductApi(
  draft: ProductDraft,
  accessToken: string,
): Promise<Product> {
  const res = await fetch("/api/products", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...draft, accessToken }),
  });
  const data = await parseJson(res);
  if (!res.ok) throw new Error(messageFrom(data, "Failed to create product."));
  const product = (data as { product?: Product })?.product;
  if (!product) throw new Error("Server did not return the created product.");
  return product;
}

/* ------------------------------ Orders -------------------------------- */

// Orders are never listed unscoped. Pass the logged-in user's uid to fetch only
// their orders (as a seller or as a buyer). See the SECURITY note on
// GET /api/orders: the scope is currently trust-on-input and must be backed by
// real identity verification before production.
export interface OrderScope {
  sellerUid?: string;
  buyerUid?: string;
}

export async function fetchOrders(scope: OrderScope): Promise<Order[]> {
  const qs = new URLSearchParams();
  if (scope.sellerUid) qs.set("sellerUid", scope.sellerUid);
  else if (scope.buyerUid) qs.set("buyerUid", scope.buyerUid);

  const res = await fetch(`/api/orders?${qs.toString()}`, { cache: "no-store" });
  const data = await parseJson(res);
  if (!res.ok) throw new Error(messageFrom(data, "Failed to load orders."));
  const orders = (data as { orders?: Order[] })?.orders;
  return Array.isArray(orders) ? orders : [];
}

export interface CreatedOrder {
  order: Order;
  orderId: string;
  amountPi: number;
}

// Creates a pending order from a product id. The server reads the real price
// from the database and returns it, so the caller can charge the trusted amount.
export async function createOrderApi(
  productId: string,
  buyer: { uid: string; username: string },
): Promise<CreatedOrder> {
  const res = await fetch("/api/orders", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      productId,
      buyerUid: buyer.uid,
      buyerUsername: buyer.username,
    }),
  });
  const data = await parseJson(res);
  if (!res.ok) throw new Error(messageFrom(data, "Failed to create order."));
  const payload = data as { order?: Order; orderId?: string; amountPi?: number };
  if (!payload.order || !payload.orderId || typeof payload.amountPi !== "number") {
    throw new Error("Server did not return a valid order.");
  }
  return { order: payload.order, orderId: payload.orderId, amountPi: payload.amountPi };
}

// A client may only record a cancelled / failed outcome. It can never set
// paymentId, txid, or move an order to approved/paid — those are server-only and
// handled by /api/pi/approve and /api/pi/complete.
export interface OrderPatch {
  status: "cancelled" | "failed";
}

export async function patchOrderApi(
  orderId: string,
  fields: OrderPatch,
): Promise<Order | null> {
  const res = await fetch(`/api/orders/${encodeURIComponent(orderId)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(fields),
  });
  const data = await parseJson(res);
  if (!res.ok) throw new Error(messageFrom(data, "Failed to update order."));
  return (data as { order?: Order })?.order ?? null;
}

// Server-side database layer (Supabase).
//
// Every product/order read and write goes through this module. It is imported
// ONLY from API routes, so the service-role client never reaches the browser.
// The UI keeps using the camelCase types in lib/types.ts; the snake_case
// database columns are mapped here in one place.

import { supabaseAdmin } from "./supabase";
import { newOrderId, shortId } from "./id";
import type { Order, OrderStatus, Product, ProductDraft } from "./types";

const SUPABASE_NOT_CONFIGURED =
  "Supabase is not configured on the server. Set NEXT_PUBLIC_SUPABASE_URL, " +
  "NEXT_PUBLIC_SUPABASE_ANON_KEY and SUPABASE_SERVICE_ROLE_KEY, then restart.";

// Thrown when a referenced product/order does not exist. API routes turn this
// into a 404 instead of a generic 500.
export class NotFoundError extends Error {}

// Returns the service-role client or throws a clear, actionable error. Routes
// should call isSupabaseConfigured() first, but this keeps db.ts safe on its own.
function admin() {
  if (!supabaseAdmin) throw new Error(SUPABASE_NOT_CONFIGURED);
  return supabaseAdmin;
}

const ORDER_STATUSES: readonly OrderStatus[] = [
  "pending",
  "approved",
  "paid",
  "cancelled",
  "failed",
  "incomplete",
];

function toOrderStatus(value: string): OrderStatus {
  return (ORDER_STATUSES as readonly string[]).includes(value)
    ? (value as OrderStatus)
    : "pending";
}

/* ----------------------------- Row shapes ----------------------------- */

interface ProductRow {
  id: string;
  seller_uid: string;
  product_name: string;
  price_pi: number | string;
  description: string | null;
  image_url: string | null;
  seller_contact: string | null;
  delivery_note: string | null;
  status: string | null;
  created_at: string;
  updated_at: string;
}

interface OrderRow {
  order_id: string;
  product_id: string;
  seller_uid: string;
  buyer_uid: string;
  buyer_username: string;
  amount_pi: number | string;
  payment_id: string | null;
  txid: string | null;
  status: string;
  created_at: string;
  updated_at: string;
}

/* ------------------------------ Mappers ------------------------------- */

function mapProduct(row: ProductRow): Product {
  return {
    id: row.id,
    productName: row.product_name,
    pricePi: Number(row.price_pi),
    description: row.description ?? "",
    imageUrl: row.image_url ?? "",
    sellerContact: row.seller_contact ?? "",
    deliveryNote: row.delivery_note ?? "",
    createdAt: row.created_at,
  };
}

// The orders table stores product_id, not the product name. Reads embed
// `products(product_name)` so the UI's Order.productName stays populated.
// PostgREST may return the embed as an object (to-one) or, in some versions,
// a single-element array — handle both without using `any`.
function embeddedProductName(row: OrderRow): string {
  const embedded = (row as { products?: unknown }).products;
  if (Array.isArray(embedded)) {
    const first = embedded[0] as { product_name?: string } | undefined;
    return first?.product_name ?? "";
  }
  if (embedded && typeof embedded === "object") {
    return (embedded as { product_name?: string }).product_name ?? "";
  }
  return "";
}

function mapOrder(row: OrderRow, productName?: string): Order {
  return {
    orderId: row.order_id,
    productId: row.product_id,
    productName: productName ?? embeddedProductName(row),
    amountPi: Number(row.amount_pi),
    buyerUid: row.buyer_uid,
    buyerUsername: row.buyer_username,
    paymentId: row.payment_id ?? undefined,
    txid: row.txid ?? undefined,
    status: toOrderStatus(row.status),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

const ORDER_SELECT = "*, products(product_name)";

/* ------------------------------ Users --------------------------------- */

// Upsert a Pi user into the users table after their access token has been
// verified server-side (see /api/pi/me). Keyed on the unique pi_uid so repeat
// logins refresh the stored username instead of creating duplicates.
export async function upsertUser(
  piUid: string,
  piUsername: string,
): Promise<void> {
  if (!piUid || !piUsername) {
    throw new Error("A Pi uid and username are required to upsert a user.");
  }
  const { error } = await admin()
    .from("users")
    .upsert(
      {
        pi_uid: piUid,
        pi_username: piUsername,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "pi_uid" },
    );
  if (error) throw new Error(error.message);
}

/* ----------------------------- Products ------------------------------- */

export async function getProducts(): Promise<Product[]> {
  const { data, error } = await admin()
    .from("products")
    .select("*")
    .eq("status", "active")
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  return ((data ?? []) as ProductRow[]).map(mapProduct);
}

export async function getProductById(id: string): Promise<Product | null> {
  const { data, error } = await admin()
    .from("products")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data ? mapProduct(data as ProductRow) : null;
}

export async function createProduct(
  draft: ProductDraft,
  sellerUid: string,
): Promise<Product> {
  if (!sellerUid) throw new Error("A seller Pi uid is required to create a product.");

  const base = {
    seller_uid: sellerUid,
    product_name: draft.productName,
    price_pi: draft.pricePi,
    description: draft.description || null,
    image_url: draft.imageUrl || null,
    seller_contact: draft.sellerContact || null,
    delivery_note: draft.deliveryNote || null,
    status: "active",
  };

  // products.id is a text primary key. Generate a short id and retry on the
  // (very unlikely) collision rather than risking a duplicate.
  for (let attempt = 0; attempt < 6; attempt += 1) {
    const id = shortId(8);
    const { data, error } = await admin()
      .from("products")
      .insert({ ...base, id })
      .select("*")
      .single();

    if (!error && data) return mapProduct(data as ProductRow);
    if (error && error.code === "23505") continue; // duplicate id, try again
    if (error) throw new Error(error.message);
  }
  throw new Error("Could not allocate a unique product id. Please try again.");
}

/* ------------------------------ Orders -------------------------------- */

// Returns EVERY order. Intentionally NOT exposed through the public API
// (GET /api/orders requires a sellerUid/buyerUid scope). Kept for server-side
// admin/debug use and future authenticated admin tooling.
export async function getOrders(): Promise<Order[]> {
  const { data, error } = await admin()
    .from("orders")
    .select(ORDER_SELECT)
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  return ((data ?? []) as OrderRow[]).map((row) => mapOrder(row));
}

export async function getOrderById(orderId: string): Promise<Order | null> {
  const { data, error } = await admin()
    .from("orders")
    .select(ORDER_SELECT)
    .eq("order_id", orderId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data ? mapOrder(data as OrderRow) : null;
}

export async function getOrdersBySeller(sellerUid: string): Promise<Order[]> {
  const { data, error } = await admin()
    .from("orders")
    .select(ORDER_SELECT)
    .eq("seller_uid", sellerUid)
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  return ((data ?? []) as OrderRow[]).map((row) => mapOrder(row));
}

export async function getOrdersByBuyer(buyerUid: string): Promise<Order[]> {
  const { data, error } = await admin()
    .from("orders")
    .select(ORDER_SELECT)
    .eq("buyer_uid", buyerUid)
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  return ((data ?? []) as OrderRow[]).map((row) => mapOrder(row));
}

// Server-authoritative order creation. The price and seller are read from the
// product row in the database, never trusted from the client. This is what lets
// the Pi payment flow charge the real product.price_pi.
export async function createOrderFromProduct(
  productId: string,
  buyer: { uid: string; username: string },
): Promise<Order> {
  if (!buyer.uid || !buyer.username) {
    throw new Error("A buyer Pi uid and username are required to place an order.");
  }

  const { data: productData, error: productError } = await admin()
    .from("products")
    .select("*")
    .eq("id", productId)
    .maybeSingle();

  if (productError) throw new Error(productError.message);
  if (!productData) {
    throw new NotFoundError("Product not found or no longer available.");
  }
  const product = productData as ProductRow;

  const base = {
    product_id: product.id,
    seller_uid: product.seller_uid,
    buyer_uid: buyer.uid,
    buyer_username: buyer.username,
    amount_pi: Number(product.price_pi), // price comes from the database
    status: "pending" as const,
  };

  for (let attempt = 0; attempt < 6; attempt += 1) {
    const orderId = newOrderId();
    const { data, error } = await admin()
      .from("orders")
      .insert({ ...base, order_id: orderId })
      .select("*")
      .single();

    if (!error && data) {
      return mapOrder(data as OrderRow, product.product_name);
    }
    if (error && error.code === "23505") continue; // duplicate order_id, retry
    if (error) throw new Error(error.message);
  }
  throw new Error("Could not allocate a unique order id. Please try again.");
}

// Fields a client is allowed to patch on an order.
export interface OrderUpdateFields {
  status?: OrderStatus;
  paymentId?: string;
  txid?: string;
  buyerUsername?: string;
}

export async function updateOrderById(
  orderId: string,
  fields: OrderUpdateFields,
): Promise<Order | null> {
  const patch: Record<string, string> = { updated_at: new Date().toISOString() };
  if (fields.status !== undefined) patch.status = fields.status;
  if (fields.paymentId !== undefined) patch.payment_id = fields.paymentId;
  if (fields.txid !== undefined) patch.txid = fields.txid;
  if (fields.buyerUsername !== undefined) patch.buyer_username = fields.buyerUsername;

  const { data, error } = await admin()
    .from("orders")
    .update(patch)
    .eq("order_id", orderId)
    .select(ORDER_SELECT)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data ? mapOrder(data as OrderRow) : null;
}

export async function updateOrderStatus(
  orderId: string,
  status: OrderStatus,
  fields: OrderUpdateFields = {},
): Promise<Order | null> {
  return updateOrderById(orderId, { ...fields, status });
}

// Server-only transitions used by the Pi payment routes AFTER the Pi Platform
// API has verified/approved/completed the payment. The HTTP PATCH endpoint is
// NOT allowed to set these states — only these helpers (called from
// /api/pi/approve and /api/pi/complete) may move an order to approved/paid.
export async function markOrderApproved(
  orderId: string,
  paymentId: string,
): Promise<Order | null> {
  return updateOrderById(orderId, { status: "approved", paymentId });
}

export async function markOrderPaid(
  orderId: string,
  paymentId: string,
  txid: string,
): Promise<Order | null> {
  return updateOrderById(orderId, { status: "paid", paymentId, txid });
}

/* --------------------------- Health check ----------------------------- */

// Lightweight connectivity probe for /api/db/health. Selects a single row from
// products; resolves on success and throws the Supabase error on failure.
export async function pingDatabase(): Promise<void> {
  const { error } = await admin().from("products").select("id").limit(1);
  if (error) throw new Error(error.message);
}

// Local persistence layer.
//
// For the MVP this is the single source of truth: products and orders live in
// the browser's localStorage so data survives a page refresh. Every read/write
// goes through this module, which means swapping to Supabase later only touches
// this one file — the pages and components never read localStorage directly.

import type { Order, Product, ProductDraft } from "./types";
import { newOrderId, shortId } from "./id";
import { seedProducts } from "./seed";

const PRODUCTS_KEY = "psk:products";
const ORDERS_KEY = "psk:orders";
const SEEDED_KEY = "psk:seeded";

// localStorage only exists in the browser. Guard every access so this module is
// safe to import from server components too.
function isBrowser(): boolean {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function read<T>(key: string, fallback: T): T {
  if (!isBrowser()) return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    if (raw === null || raw === "") return fallback;
    const parsed = JSON.parse(raw) as T;
    // Guard against corrupted data. Every caller stores an array, so if the
    // stored value isn't one (null, object, primitive from a bad write) fall
    // back instead of letting .sort/.find/.map throw later.
    if (Array.isArray(fallback) && !Array.isArray(parsed)) return fallback;
    return parsed ?? fallback;
  } catch {
    return fallback;
  }
}

function write<T>(key: string, value: T): void {
  if (!isBrowser()) return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage can throw (private mode, quota). Fail quietly in the MVP.
  }
}

// Seed a couple of sample products the first time the app runs, so the home and
// product pages aren't empty on a fresh install. Runs at most once.
function ensureSeeded(): void {
  if (!isBrowser()) return;
  if (window.localStorage.getItem(SEEDED_KEY)) return;
  const existing = read<Product[]>(PRODUCTS_KEY, []);
  if (existing.length === 0) {
    write(PRODUCTS_KEY, seedProducts());
  }
  window.localStorage.setItem(SEEDED_KEY, "1");
}

/* ----------------------------- Products ----------------------------- */

export function getProducts(): Product[] {
  ensureSeeded();
  return read<Product[]>(PRODUCTS_KEY, []).sort(
    (a, b) => +new Date(b.createdAt) - +new Date(a.createdAt),
  );
}

export function getProduct(id: string): Product | undefined {
  ensureSeeded();
  return read<Product[]>(PRODUCTS_KEY, []).find((p) => p.id === id);
}

export function createProduct(draft: ProductDraft): Product {
  const products = read<Product[]>(PRODUCTS_KEY, []);
  // Guarantee a unique id even in the unlikely event of a random collision.
  let id = shortId(8);
  while (products.some((p) => p.id === id)) id = shortId(8);

  const product: Product = {
    ...draft,
    id,
    createdAt: new Date().toISOString(),
  };
  products.push(product);
  write(PRODUCTS_KEY, products);
  return product;
}

/* ------------------------------ Orders ------------------------------ */

export function getOrders(): Order[] {
  return read<Order[]>(ORDERS_KEY, []).sort(
    (a, b) => +new Date(b.createdAt) - +new Date(a.createdAt),
  );
}

export function getOrder(orderId: string): Order | undefined {
  return read<Order[]>(ORDERS_KEY, []).find((o) => o.orderId === orderId);
}

// Create a new order in "pending" state. Used the moment a payment starts.
export function createOrder(input: {
  productId: string;
  productName: string;
  amountPi: number;
  buyerUsername: string;
  paymentId?: string;
}): Order {
  const orders = read<Order[]>(ORDERS_KEY, []);
  // Guarantee a unique orderId so two orders can never share a reference.
  let orderId = newOrderId();
  while (orders.some((o) => o.orderId === orderId)) orderId = newOrderId();

  const order: Order = {
    orderId,
    status: "pending",
    createdAt: new Date().toISOString(),
    ...input,
  };
  orders.push(order);
  write(ORDERS_KEY, orders);
  return order;
}

// Update an existing order (e.g. mark completed / cancelled / failed).
export function updateOrder(
  orderId: string,
  patch: Partial<Pick<Order, "status" | "paymentId" | "buyerUsername">>,
): Order | undefined {
  const orders = read<Order[]>(ORDERS_KEY, []);
  const idx = orders.findIndex((o) => o.orderId === orderId);
  if (idx === -1) return undefined;
  orders[idx] = { ...orders[idx], ...patch };
  write(ORDERS_KEY, orders);
  return orders[idx];
}

import { NextResponse } from "next/server";
import { getOrderById, markOrderApproved } from "@/lib/db";
import { isSupabaseConfigured } from "@/lib/supabase";
import {
  SUPABASE_NOT_CONFIGURED_MESSAGE,
  errorMessage,
  jsonError,
} from "@/lib/api";
import { approvePiPayment, getPiPayment } from "@/lib/pi-server";

// Server-only. PI_API_KEY is read from process.env here and NEVER sent to the
// client. This route runs on the Node runtime.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Pi amounts are decimals; compare with a small tolerance to avoid float noise.
function amountsEqual(a: number, b: number): boolean {
  return Math.abs(a - b) < 1e-7;
}

function metaString(
  metadata: Record<string, unknown> | undefined,
  key: string,
): string | undefined {
  const value = metadata?.[key];
  return typeof value === "string" ? value : undefined;
}

// POST /api/pi/approve
// Body: { paymentId, orderId }
//
// We NEVER approve just because the client sent an id. We load the order from
// Supabase, read the authoritative payment from the Pi Platform API, verify the
// two agree (amount, buyer, product, order), and only then approve. The order is
// moved to `approved` by the SERVER here — the client cannot do this itself.
export async function POST(req: Request) {
  // 1) Parse input.
  let body: { paymentId?: unknown; orderId?: unknown };
  try {
    body = await req.json();
  } catch {
    return jsonError("Invalid JSON body.", 400, "bad_request");
  }

  const paymentId = typeof body.paymentId === "string" ? body.paymentId.trim() : "";
  const orderId = typeof body.orderId === "string" ? body.orderId.trim() : "";
  if (!paymentId) return jsonError("paymentId is required.", 400, "bad_request");
  if (!orderId) return jsonError("orderId is required.", 400, "bad_request");

  // 2) Server must have a Pi API key.
  const apiKey = process.env.PI_API_KEY;
  if (!apiKey) {
    return jsonError("PI_API_KEY is not configured.", 500, "pi_not_configured");
  }

  // 3) Supabase must be configured.
  if (!isSupabaseConfigured()) {
    return jsonError(SUPABASE_NOT_CONFIGURED_MESSAGE, 503, "supabase_not_configured");
  }

  // 4) Load the order from our database.
  let order;
  try {
    order = await getOrderById(orderId);
  } catch (err) {
    return jsonError(errorMessage(err), 500, "server_error");
  }
  // 5) No order -> 404.
  if (!order) return jsonError("Order not found.", 404, "not_found");

  // 6) Read the authoritative payment from the Pi Platform API.
  let lookup;
  try {
    lookup = await getPiPayment(paymentId, apiKey);
  } catch (err) {
    return jsonError(
      `Failed to reach the Pi Platform API: ${errorMessage(err)}`,
      502,
      "pi_unreachable",
    );
  }
  if (!lookup.ok || !lookup.payment) {
    return jsonError(
      `Pi payment lookup failed (${lookup.status}).`,
      502,
      "pi_lookup_failed",
    );
  }
  const payment = lookup.payment;

  // 7) Verify the Pi payment matches the order we are about to approve.
  if (payment.identifier !== paymentId) {
    return jsonError("Payment id does not match.", 409, "payment_mismatch");
  }
  if (!amountsEqual(Number(payment.amount), order.amountPi)) {
    return jsonError(
      "Payment amount does not match the order.",
      409,
      "amount_mismatch",
    );
  }
  if (metaString(payment.metadata, "orderId") !== order.orderId) {
    return jsonError(
      "Payment orderId does not match the order.",
      409,
      "order_mismatch",
    );
  }
  if (metaString(payment.metadata, "productId") !== order.productId) {
    return jsonError(
      "Payment productId does not match the order.",
      409,
      "product_mismatch",
    );
  }
  if (payment.user_uid !== order.buyerUid) {
    return jsonError(
      "Payment buyer does not match the order.",
      409,
      "buyer_mismatch",
    );
  }
  if (payment.status?.cancelled || payment.status?.user_cancelled) {
    return jsonError("Payment was cancelled.", 409, "payment_cancelled");
  }

  // 8) Approve on the Pi Platform.
  let approval;
  try {
    approval = await approvePiPayment(paymentId, apiKey);
  } catch (err) {
    return jsonError(
      `Failed to reach the Pi Platform API: ${errorMessage(err)}`,
      502,
      "pi_unreachable",
    );
  }
  if (!approval.ok) {
    return jsonError(
      `Pi approve failed (${approval.status}).`,
      502,
      "pi_approve_failed",
    );
  }

  // 9) Approve succeeded -> move the order to `approved` on the server.
  try {
    const updated = await markOrderApproved(orderId, paymentId);
    if (!updated) return jsonError("Order not found.", 404, "not_found");
    // 10) Return the updated order.
    return NextResponse.json({ ok: true, order: updated });
  } catch (err) {
    return jsonError(errorMessage(err), 500, "server_error");
  }
}

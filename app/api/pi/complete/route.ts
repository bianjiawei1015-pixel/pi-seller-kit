import { NextResponse } from "next/server";
import { getOrderById, markOrderPaid } from "@/lib/db";
import { isSupabaseConfigured } from "@/lib/supabase";
import {
  SUPABASE_NOT_CONFIGURED_MESSAGE,
  errorMessage,
  jsonError,
} from "@/lib/api";
import { completePiPayment } from "@/lib/pi-server";

// Server-only. PI_API_KEY is read from process.env here and NEVER sent to the
// client. This route runs on the Node runtime.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/pi/complete
// Body: { paymentId, txid, orderId }
//
// The order is marked `paid` ONLY after the Pi Platform completes the payment.
// The client cannot mark an order paid itself.
export async function POST(req: Request) {
  // 1) Parse input.
  let body: { paymentId?: unknown; txid?: unknown; orderId?: unknown };
  try {
    body = await req.json();
  } catch {
    return jsonError("Invalid JSON body.", 400, "bad_request");
  }

  const paymentId = typeof body.paymentId === "string" ? body.paymentId.trim() : "";
  const txid = typeof body.txid === "string" ? body.txid.trim() : "";
  const orderId = typeof body.orderId === "string" ? body.orderId.trim() : "";
  if (!paymentId) return jsonError("paymentId is required.", 400, "bad_request");
  if (!txid) return jsonError("txid is required.", 400, "bad_request");
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
  // 5) Validate the order exists.
  if (!order) return jsonError("Order not found.", 404, "not_found");

  // 6) The order's paymentId must match (it is set during approve), or the order
  //    has no paymentId yet but the orderId matched the lookup above.
  if (order.paymentId && order.paymentId !== paymentId) {
    return jsonError(
      "paymentId does not match this order.",
      409,
      "payment_mismatch",
    );
  }

  // 7) Complete on the Pi Platform (sends the on-chain txid).
  let completion;
  try {
    completion = await completePiPayment(paymentId, txid, apiKey);
  } catch (err) {
    return jsonError(
      `Failed to reach the Pi Platform API: ${errorMessage(err)}`,
      502,
      "pi_unreachable",
    );
  }
  // Do NOT mark the order paid if completion failed.
  if (!completion.ok) {
    return jsonError(
      `Pi complete failed (${completion.status}).`,
      502,
      "pi_complete_failed",
    );
  }

  // 8) Completion succeeded -> mark the order paid on the server.
  try {
    const updated = await markOrderPaid(orderId, paymentId, txid);
    if (!updated) return jsonError("Order not found.", 404, "not_found");
    // 9) Return the updated order.
    return NextResponse.json({ ok: true, order: updated });
  } catch (err) {
    return jsonError(errorMessage(err), 500, "server_error");
  }
}

import { NextResponse } from "next/server";
import { getOrderById, updateOrderById } from "@/lib/db";
import { errorMessage, jsonError, supabaseGuard } from "@/lib/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/orders/[orderId] -> a single order, or 404 if it does not exist.
export async function GET(
  _req: Request,
  { params }: { params: { orderId: string } },
) {
  const guard = supabaseGuard();
  if (guard) return guard;

  try {
    const order = await getOrderById(params.orderId);
    if (!order) return jsonError("Order not found.", 404, "not_found");
    return NextResponse.json({ ok: true, order });
  } catch (err) {
    return jsonError(errorMessage(err), 500, "server_error");
  }
}

// The ONLY statuses a client may set through this public endpoint. `approved`
// and `paid` are deliberately excluded: those are set exclusively by
// /api/pi/approve and /api/pi/complete after the Pi Platform verifies the
// payment. `paymentId` and `txid` are likewise off-limits here.
const CLIENT_SETTABLE_STATUSES = ["cancelled", "failed"] as const;
type ClientSettableStatus = (typeof CLIENT_SETTABLE_STATUSES)[number];

function isClientSettableStatus(value: unknown): value is ClientSettableStatus {
  return (
    typeof value === "string" &&
    (CLIENT_SETTABLE_STATUSES as readonly string[]).includes(value)
  );
}

// PATCH /api/orders/[orderId]
//
// Hardened: this endpoint can only record a buyer-side `cancelled` / `failed`
// outcome. It cannot mark an order `approved`/`paid`, cannot set `paymentId` or
// `txid`, and cannot modify an order that is already `paid`.
export async function PATCH(
  req: Request,
  { params }: { params: { orderId: string } },
) {
  const guard = supabaseGuard();
  if (guard) return guard;

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return jsonError("Invalid JSON body.", 400, "bad_request");
  }

  // Reject protected fields outright so there is no ambiguity.
  if ("paymentId" in body || "txid" in body) {
    return jsonError(
      "paymentId and txid can only be set by the Pi payment routes.",
      403,
      "forbidden_field",
    );
  }
  if (body.status === "paid" || body.status === "approved") {
    return jsonError(
      "This status can only be set by the Pi payment routes after on-chain verification.",
      403,
      "forbidden_status",
    );
  }
  if (!isClientSettableStatus(body.status)) {
    return jsonError(
      "Only 'cancelled' or 'failed' may be set here.",
      422,
      "invalid_input",
    );
  }

  // Never mutate an order that has already been paid.
  let existing;
  try {
    existing = await getOrderById(params.orderId);
  } catch (err) {
    return jsonError(errorMessage(err), 500, "server_error");
  }
  if (!existing) return jsonError("Order not found.", 404, "not_found");
  if (existing.status === "paid") {
    return jsonError("A paid order cannot be modified.", 409, "order_locked");
  }

  try {
    const order = await updateOrderById(params.orderId, { status: body.status });
    if (!order) return jsonError("Order not found.", 404, "not_found");
    return NextResponse.json({ ok: true, order });
  } catch (err) {
    return jsonError(errorMessage(err), 500, "server_error");
  }
}

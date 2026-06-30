import { NextResponse } from "next/server";
import {
  createOrderFromProduct,
  getOrdersByBuyer,
  getOrdersBySeller,
  NotFoundError,
} from "@/lib/db";
import { errorMessage, jsonError, supabaseGuard } from "@/lib/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/orders?sellerUid= -> orders for that seller
// GET /api/orders?buyerUid=  -> orders for that buyer
//
// Listing ALL orders is intentionally disabled: one of sellerUid or buyerUid is
// required. SECURITY / TRANSITIONAL NOTE: the scope is currently trust-on-input
// (any caller can pass any uid). Before production this MUST be backed by real
// identity verification — derive the uid from a verified session/token (as
// /api/pi/me does) and reject requests for a uid the caller has not proven they
// own — so a seller can only read their own orders.
export async function GET(req: Request) {
  const guard = supabaseGuard();
  if (guard) return guard;

  const { searchParams } = new URL(req.url);
  const sellerUid = searchParams.get("sellerUid")?.trim();
  const buyerUid = searchParams.get("buyerUid")?.trim();

  if (!sellerUid && !buyerUid) {
    return jsonError(
      "Provide sellerUid or buyerUid. Listing all orders is disabled.",
      400,
      "scope_required",
    );
  }

  try {
    const orders = sellerUid
      ? await getOrdersBySeller(sellerUid)
      : await getOrdersByBuyer(buyerUid as string);
    return NextResponse.json({ ok: true, orders });
  } catch (err) {
    return jsonError(errorMessage(err), 500, "server_error");
  }
}

interface CreateOrderBody {
  productId?: string;
  buyerUid?: string;
  buyerUsername?: string;
}

// POST /api/orders -> create a pending order. The amount is taken from the
// product row in the database, not from the client.
export async function POST(req: Request) {
  const guard = supabaseGuard();
  if (guard) return guard;

  let body: CreateOrderBody;
  try {
    body = (await req.json()) as CreateOrderBody;
  } catch {
    return jsonError("Invalid JSON body.", 400, "bad_request");
  }

  const productId = body.productId?.trim();
  const buyerUid = body.buyerUid?.trim();
  const buyerUsername = body.buyerUsername?.trim();

  if (!productId) return jsonError("productId is required.", 422, "invalid_input");
  if (!buyerUid || !buyerUsername) {
    return jsonError(
      "Please log in with Pi before paying.",
      401,
      "login_required",
    );
  }

  try {
    const order = await createOrderFromProduct(productId, {
      uid: buyerUid,
      username: buyerUsername,
    });
    return NextResponse.json(
      { ok: true, order, orderId: order.orderId, amountPi: order.amountPi },
      { status: 201 },
    );
  } catch (err) {
    if (err instanceof NotFoundError) {
      return jsonError(err.message, 404, "not_found");
    }
    return jsonError(errorMessage(err), 500, "server_error");
  }
}

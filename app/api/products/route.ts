import { NextResponse } from "next/server";
import { createProduct, getProducts, upsertUser } from "@/lib/db";
import { errorMessage, jsonError, supabaseGuard } from "@/lib/api";
import { verifyPiAccessToken } from "@/lib/pi-server";
import type { ProductDraft } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/products -> list active products from Supabase.
export async function GET() {
  const guard = supabaseGuard();
  if (guard) return guard;

  try {
    const products = await getProducts();
    return NextResponse.json({ ok: true, products });
  } catch (err) {
    return jsonError(errorMessage(err), 500, "server_error");
  }
}

interface CreateProductBody extends Partial<ProductDraft> {
  // The client sends a fresh Pi access token. It does NOT send seller_uid:
  // the server derives that from the verified token (see below).
  accessToken?: string;
}

// POST /api/products -> create a product owned by the seller's Pi uid.
//
// SECURITY / TRANSITIONAL NOTE:
//   The server never trusts a client-supplied sellerUid. Instead the client
//   sends a fresh Pi access token (from getPiAccessToken -> Pi.authenticate),
//   the server verifies it against the Pi Platform /me endpoint, and seller_uid
//   is taken from that verified identity. This is the safe transitional
//   mechanism used until a full server session (e.g. a signed, httpOnly cookie
//   minted after /api/pi/me) is added. Re-verifying per write keeps creation
//   tied to a real Pi account without a session store.
export async function POST(req: Request) {
  const guard = supabaseGuard();
  if (guard) return guard;

  let body: CreateProductBody;
  try {
    body = (await req.json()) as CreateProductBody;
  } catch {
    return jsonError("Invalid JSON body.", 400, "bad_request");
  }

  // 1) Require a Pi access token and verify it. seller_uid comes from here.
  const accessToken =
    typeof body.accessToken === "string" ? body.accessToken.trim() : "";
  if (!accessToken) {
    return jsonError(
      "Please log in with Pi before creating a product.",
      401,
      "login_required",
    );
  }

  let seller;
  try {
    seller = await verifyPiAccessToken(accessToken);
  } catch (err) {
    return jsonError(
      `Failed to reach the Pi Platform API: ${errorMessage(err)}`,
      502,
      "pi_unreachable",
    );
  }
  if (!seller) {
    return jsonError("Pi access token is invalid or expired.", 401, "invalid_token");
  }

  // 2) Validate the product fields.
  const productName = body.productName?.trim();
  const price = Number(body.pricePi);
  const imageUrl = body.imageUrl?.trim();
  const sellerContact = body.sellerContact?.trim();

  if (!productName) return jsonError("Product name is required.", 422, "invalid_input");
  if (!Number.isFinite(price) || price <= 0) {
    return jsonError("Price must be a number greater than 0.", 422, "invalid_input");
  }
  if (!imageUrl) return jsonError("An image URL is required.", 422, "invalid_input");
  if (!sellerContact) {
    return jsonError("A seller contact is required.", 422, "invalid_input");
  }

  const draft: ProductDraft = {
    productName,
    pricePi: price,
    description: body.description?.trim() ?? "",
    imageUrl,
    sellerContact,
    deliveryNote: body.deliveryNote?.trim() ?? "",
  };

  // 3) Record the seller and create the product against the VERIFIED uid.
  try {
    await upsertUser(seller.uid, seller.username);
    const product = await createProduct(draft, seller.uid);
    return NextResponse.json({ ok: true, product }, { status: 201 });
  } catch (err) {
    return jsonError(errorMessage(err), 500, "server_error");
  }
}

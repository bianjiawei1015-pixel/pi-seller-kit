import { NextResponse } from "next/server";
import { getProductById } from "@/lib/db";
import { errorMessage, jsonError, supabaseGuard } from "@/lib/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/products/[id] -> a single product, or 404 if it does not exist.
export async function GET(
  _req: Request,
  { params }: { params: { id: string } },
) {
  const guard = supabaseGuard();
  if (guard) return guard;

  try {
    const product = await getProductById(params.id);
    if (!product) {
      return jsonError("Product not found.", 404, "not_found");
    }
    return NextResponse.json({ ok: true, product });
  } catch (err) {
    return jsonError(errorMessage(err), 500, "server_error");
  }
}

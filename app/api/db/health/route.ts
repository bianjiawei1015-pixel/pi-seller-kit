import { NextResponse } from "next/server";
import { isSupabaseConfigured } from "@/lib/supabase";
import { pingDatabase } from "@/lib/db";
import { SUPABASE_NOT_CONFIGURED_MESSAGE, errorMessage } from "@/lib/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/db/health -> real Supabase connectivity check.
//   - env vars missing            -> 503  { ok:false, database:"not_configured" }
//   - configured + query succeeds -> 200  { ok:true,  database:"connected" }
//   - configured + query fails    -> 500  { ok:false, database:"error" }
export async function GET() {
  if (!isSupabaseConfigured()) {
    return NextResponse.json(
      {
        ok: false,
        database: "not_configured",
        message: SUPABASE_NOT_CONFIGURED_MESSAGE,
      },
      { status: 503 },
    );
  }

  try {
    await pingDatabase(); // SELECT id FROM products LIMIT 1
    return NextResponse.json({ ok: true, database: "connected" });
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        database: "error",
        message: errorMessage(err),
      },
      { status: 500 },
    );
  }
}

// Small helpers shared by the API routes. Imported only from route handlers
// (it pulls in next/server), never from a client component.

import { NextResponse } from "next/server";
import { isSupabaseConfigured } from "./supabase";

export const SUPABASE_NOT_CONFIGURED_MESSAGE =
  "Supabase is not configured. Add NEXT_PUBLIC_SUPABASE_URL, " +
  "NEXT_PUBLIC_SUPABASE_ANON_KEY and SUPABASE_SERVICE_ROLE_KEY to .env.local " +
  "and restart the server.";

// Returns a 503 response when Supabase env vars are missing, otherwise null so
// the caller can continue. This keeps pages from white-screening: they receive
// a clear JSON error they can render.
export function supabaseGuard(): NextResponse | null {
  if (isSupabaseConfigured()) return null;
  return NextResponse.json(
    {
      ok: false,
      code: "supabase_not_configured",
      message: SUPABASE_NOT_CONFIGURED_MESSAGE,
    },
    { status: 503 },
  );
}

export function jsonError(
  message: string,
  status = 400,
  code = "error",
): NextResponse {
  return NextResponse.json({ ok: false, code, message }, { status });
}

export function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

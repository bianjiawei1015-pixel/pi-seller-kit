import { NextResponse } from "next/server";
import { upsertUser } from "@/lib/db";
import { isSupabaseConfigured } from "@/lib/supabase";
import {
  SUPABASE_NOT_CONFIGURED_MESSAGE,
  errorMessage,
  jsonError,
} from "@/lib/api";
import { verifyPiAccessToken } from "@/lib/pi-server";

// Server-only. Verifies a Pi user access token with the Pi Platform API and
// records the user. The access token arrives in the request body, is used once
// to call Pi /me, and is never stored or returned. This runs on the Node
// runtime.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/pi/me
// Body: { accessToken }
//
// Flow:
//   1. Receive the Pi access token the client got from Pi.authenticate.
//   2. Call Pi Platform GET /me (Bearer accessToken) to verify the user.
//   3. Upsert the verified user into the users table.
//   4. Return ONLY the server-verified uid + username. The client stores those
//      (never the access token).
export async function POST(req: Request) {
  let body: { accessToken?: unknown };
  try {
    body = await req.json();
  } catch {
    return jsonError("Invalid JSON body.", 400, "bad_request");
  }

  const accessToken =
    typeof body.accessToken === "string" ? body.accessToken.trim() : "";
  if (!accessToken) {
    return jsonError("accessToken is required.", 400, "bad_request");
  }

  // We persist the user, so Supabase must be configured.
  if (!isSupabaseConfigured()) {
    return jsonError(SUPABASE_NOT_CONFIGURED_MESSAGE, 503, "supabase_not_configured");
  }

  // Verify the token against the Pi Platform. A bad/expired token -> 401.
  let verified;
  try {
    verified = await verifyPiAccessToken(accessToken);
  } catch (err) {
    return jsonError(
      `Failed to reach the Pi Platform API: ${errorMessage(err)}`,
      502,
      "pi_unreachable",
    );
  }
  if (!verified) {
    return jsonError("Pi access token is invalid or expired.", 401, "invalid_token");
  }

  // Record the verified user (uid is unique; repeat logins refresh username).
  try {
    await upsertUser(verified.uid, verified.username);
  } catch (err) {
    return jsonError(errorMessage(err), 500, "server_error");
  }

  return NextResponse.json({
    ok: true,
    user: { uid: verified.uid, username: verified.username },
  });
}

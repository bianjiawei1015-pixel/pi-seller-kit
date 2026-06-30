import { NextResponse } from "next/server";

// DEBUG ONLY. Looks up a single payment's status from the Pi Platform API to
// help diagnose stuck payments in development. It is disabled in production
// (returns 404) and is NOT part of the payment flow. PI_API_KEY is read here and
// NEVER sent to the client.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PI_API_BASE = "https://api.minepi.com/v2";

// GET /api/pi/payment?paymentId=xxxxxxxx
export async function GET(req: Request) {
  // Disabled outside development so this diagnostic endpoint is never reachable
  // in production deployments.
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json(
      { ok: false, message: "Not found." },
      { status: 404 },
    );
  }

  const { searchParams } = new URL(req.url);
  const paymentId = searchParams.get("paymentId");

  if (!paymentId) {
    return NextResponse.json(
      { ok: false, message: "paymentId is required" },
      { status: 400 },
    );
  }

  const apiKey = process.env.PI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { ok: false, message: "PI_API_KEY is not configured" },
      { status: 500 },
    );
  }

  try {
    const res = await fetch(`${PI_API_BASE}/payments/${paymentId}`, {
      headers: { Authorization: `Key ${apiKey}` },
    });

    const payment = await res.json().catch(() => null);

    if (!res.ok) {
      return NextResponse.json(
        {
          ok: false,
          message: `Pi payment lookup failed (${res.status})`,
          details: payment,
        },
        { status: res.status },
      );
    }

    return NextResponse.json({ ok: true, paymentId, payment });
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        message: "Failed to reach the Pi Platform API",
        details: err instanceof Error ? err.message : String(err),
      },
      { status: 502 },
    );
  }
}

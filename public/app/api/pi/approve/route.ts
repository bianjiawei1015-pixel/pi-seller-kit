import { NextResponse } from "next/server";

// Server-only. PI_API_KEY is read from process.env here and NEVER sent to the
// client. This route runs on the Node runtime.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PI_API_BASE = "https://api.minepi.com/v2";

export async function POST(req: Request) {
  let body: { paymentId?: string; orderId?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { ok: false, message: "Invalid JSON body" },
      { status: 400 },
    );
  }

  const { paymentId, orderId } = body;
  if (!paymentId) {
    return NextResponse.json(
      { ok: false, message: "paymentId is required" },
      { status: 400 },
    );
  }
  if (!orderId) {
    return NextResponse.json(
      { ok: false, message: "orderId is required" },
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
    const res = await fetch(`${PI_API_BASE}/payments/${paymentId}/approve`, {
      method: "POST",
      headers: {
        Authorization: `Key ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({}),
    });

    const payment = await res.json().catch(() => null);

    if (!res.ok) {
      return NextResponse.json(
        {
          ok: false,
          message: `Pi approve failed (${res.status})`,
          details: payment,
        },
        { status: res.status },
      );
    }

    return NextResponse.json({ ok: true, paymentId, orderId, payment });
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

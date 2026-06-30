import { NextResponse } from "next/server";

// This route intentionally does not use PI_API_KEY. It exists so the client can
// report incomplete payments found by Pi.authenticate for debugging. If the
// incomplete payment already has a txid, the client calls /api/pi/complete
// instead, because that is what unblocks the payment flow.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const payment = body?.payment ?? body;

    // Do not log secrets; PaymentDTO does not contain a wallet passphrase. This
    // log is useful on Vercel Logs when an old incomplete payment blocks a new
    // payment. Remove later when Supabase order reconciliation is added.
    // eslint-disable-next-line no-console
    console.warn("[pi] incomplete payment reported", {
      identifier: payment?.identifier,
      txid: payment?.transaction?.txid,
      metadata: payment?.metadata,
      status: payment?.status,
    });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json(
      { ok: false, message: "Invalid JSON body" },
      { status: 400 },
    );
  }
}

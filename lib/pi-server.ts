// Server-only helpers for talking to the Pi Platform API.
//
// IMPORTANT: this module is imported ONLY from API routes. The caller reads
// PI_API_KEY from process.env and passes it in, so the key never appears in any
// client bundle. Do not import this file from a client component.

export const PI_API_BASE = "https://api.minepi.com/v2";

// A Pi user identity, as returned by the Pi Platform /me endpoint after a user
// access token is verified. Only the public fields are used.
export interface PiVerifiedUser {
  uid: string;
  username: string;
}

// Verify a Pi user's access token by calling GET /me with a Bearer token. This
// proves the caller is the Pi user the token belongs to. Unlike the payment
// endpoints, this uses the USER's access token (Bearer), not the app's
// PI_API_KEY. Returns the verified identity, or null if the token is invalid.
export async function verifyPiAccessToken(
  accessToken: string,
): Promise<PiVerifiedUser | null> {
  const res = await fetch(`${PI_API_BASE}/me`, {
    method: "GET",
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });
  if (!res.ok) return null;

  const data = (await res.json().catch(() => null)) as {
    uid?: unknown;
    username?: unknown;
  } | null;

  if (
    !data ||
    typeof data.uid !== "string" ||
    data.uid.length === 0 ||
    typeof data.username !== "string" ||
    data.username.length === 0
  ) {
    return null;
  }
  return { uid: data.uid, username: data.username };
}

// The subset of the Pi Platform payment object we rely on for verification.
// The real payload has more fields; we only type what we read.
export interface PiPlatformPayment {
  identifier: string;
  user_uid: string;
  amount: number | string;
  memo?: string;
  metadata?: Record<string, unknown>;
  status?: {
    developer_approved?: boolean;
    transaction_verified?: boolean;
    developer_completed?: boolean;
    cancelled?: boolean;
    user_cancelled?: boolean;
  };
  transaction?: { txid?: string; verified?: boolean } | null;
}

export interface PiApiResult {
  ok: boolean;
  status: number;
  payment: PiPlatformPayment | null;
}

function authHeaders(apiKey: string): Record<string, string> {
  return {
    Authorization: `Key ${apiKey}`,
    "Content-Type": "application/json",
  };
}

async function call(
  url: string,
  init: RequestInit,
): Promise<PiApiResult> {
  const res = await fetch(url, { ...init, cache: "no-store" });
  const payment = (await res
    .json()
    .catch(() => null)) as PiPlatformPayment | null;
  return { ok: res.ok, status: res.status, payment };
}

// GET /payments/{paymentId} — read the authoritative payment from Pi so we can
// verify it against the order in our database before approving.
export function getPiPayment(
  paymentId: string,
  apiKey: string,
): Promise<PiApiResult> {
  return call(`${PI_API_BASE}/payments/${encodeURIComponent(paymentId)}`, {
    method: "GET",
    headers: authHeaders(apiKey),
  });
}

// POST /payments/{paymentId}/approve
export function approvePiPayment(
  paymentId: string,
  apiKey: string,
): Promise<PiApiResult> {
  return call(
    `${PI_API_BASE}/payments/${encodeURIComponent(paymentId)}/approve`,
    {
      method: "POST",
      headers: authHeaders(apiKey),
      body: JSON.stringify({}),
    },
  );
}

// POST /payments/{paymentId}/complete with the on-chain txid.
export function completePiPayment(
  paymentId: string,
  txid: string,
  apiKey: string,
): Promise<PiApiResult> {
  return call(
    `${PI_API_BASE}/payments/${encodeURIComponent(paymentId)}/complete`,
    {
      method: "POST",
      headers: authHeaders(apiKey),
      body: JSON.stringify({ txid }),
    },
  );
}

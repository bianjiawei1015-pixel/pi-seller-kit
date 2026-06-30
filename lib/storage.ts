// Pi session persistence (browser only).
//
// This module persists ONLY the logged-in Pi user's PUBLIC info — uid and
// username — so the display name survives a page refresh. It is NOT a data
// store: products and orders live in Supabase and are accessed exclusively
// through the API routes (see lib/client.ts / lib/db.ts).
//
// SECURITY:
//   The Pi accessToken is NEVER persisted. It is obtained from Pi.authenticate,
//   sent once to /api/pi/me (and to privileged write routes) for server-side
//   verification, and then discarded. Nothing else about the Pi account —
//   passphrase, seed phrase, private key — is ever stored.
//
// NOTE: The old localStorage products/orders functions that previously made this
// the app's data store have been removed. Persistence is now server-side
// (Supabase). Only the Pi session helpers below remain.

import type { PiSessionUser } from "./types";

// Only the public username + uid live here. The Pi accessToken is intentionally
// never persisted.
const PI_USER_KEY = "psk:piUser";

// localStorage only exists in the browser. Guard every access so this module is
// safe to import from server components too.
function isBrowser(): boolean {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

/* ----------------------------- Pi session ---------------------------- */
// Persists only the public username + uid so the login survives a refresh.
// The accessToken returned by Pi.authenticate is deliberately NOT stored.

export function getPiUser(): PiSessionUser | null {
  if (!isBrowser()) return null;
  try {
    const raw = window.localStorage.getItem(PI_USER_KEY);
    if (!raw) return null;
    const user = JSON.parse(raw) as PiSessionUser;
    // Reject anything that isn't a well-formed session object.
    if (user && typeof user.uid === "string" && typeof user.username === "string") {
      return user;
    }
    return null;
  } catch {
    return null;
  }
}

export function savePiUser(user: PiSessionUser): void {
  if (!isBrowser()) return;
  try {
    window.localStorage.setItem(
      PI_USER_KEY,
      JSON.stringify({ uid: user.uid, username: user.username }),
    );
  } catch {
    // Storage can throw (private mode, quota). Fail quietly.
  }
}

export function clearPiUser(): void {
  if (!isBrowser()) return;
  try {
    window.localStorage.removeItem(PI_USER_KEY);
  } catch {
    // Ignore storage errors (private mode, etc).
  }
}

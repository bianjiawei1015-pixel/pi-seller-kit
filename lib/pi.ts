// =============================================================================
// Pi SDK integration layer
// =============================================================================
//
// This is the ONLY place the app talks to Pi. Every page imports these helpers
// instead of touching `window.Pi` directly, so going from mock -> real SDK is a
// change to this single file.
//
// CURRENT MODE: LOGIN is REAL (Pi.authenticate on the Testnet/sandbox).
// PAYMENTS are still MOCK — createPayment/completePayment simulate the Pi
// payment lifecycle with timeouts so the order flow stays testable in any
// browser. No real Pi is ever transferred.
//
// -----------------------------------------------------------------------------
// SECURITY (do not weaken):
//   - Never ask the user for a seed phrase, mnemonic, or private key.
//   - Never collect or store private keys or wallet secrets.
//   - Login and payment happen ONLY through the Pi SDK (Pi.authenticate /
//     Pi.createPayment). This app never handles credentials itself.
//   - Do not persist sensitive user data. We keep only a public username for
//     display on the order record.
// -----------------------------------------------------------------------------
//
// HOW TO GO LIVE (later):
//   1. The SDK is already loaded in app/layout.tsx via next/script.
//   2. Set MOCK_PAYMENTS = false below.
//   3. Replace the bodies marked `// REAL:` with the real `window.Pi` calls.
//   4. Implement the two server endpoints Pi requires:
//        POST /api/pi/approve   -> calls Pi Platform API /payments/{id}/approve
//        POST /api/pi/complete  -> calls Pi Platform API /payments/{id}/complete
//      and call them from onReadyForServerApproval / onReadyForServerCompletion.
// =============================================================================

import type { Product } from "./types";

// Login is now REAL (Pi.authenticate on the Testnet). Payments stay mocked for
// now so no real Pi can move — flip MOCK_PAYMENTS to false only when the
// server-side approve/complete endpoints are ready.
const SANDBOX = true; // Pi Testnet / sandbox
const MOCK_PAYMENTS = true;

// Minimal shape of the things we use from the Pi SDK. Kept here so the rest of
// the app has types even before the real SDK is installed.
export interface PiUser {
  uid: string;
  username: string;
}

export interface PiPaymentData {
  amount: number;
  memo: string;
  metadata: Record<string, unknown>;
}

export interface PiPaymentResult {
  paymentId: string;
  status: "created" | "completed" | "cancelled" | "error";
  txid?: string;
  user: PiUser;
}

// Window typing for when the real SDK is present.
declare global {
  interface Window {
    Pi?: {
      init: (config: { version: string; sandbox?: boolean }) => void;
      authenticate: (
        scopes: string[],
        onIncompletePaymentFound: (payment: unknown) => void,
      ) => Promise<{ user: PiUser; accessToken: string }>;
      createPayment: (
        data: PiPaymentData,
        callbacks: {
          onReadyForServerApproval: (paymentId: string) => void;
          onReadyForServerCompletion: (paymentId: string, txid: string) => void;
          onCancel: (paymentId: string) => void;
          onError: (error: Error, payment?: unknown) => void;
        },
      ) => void;
    };
  }
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

// A stable fake "logged in pioneer" for mock mode.
function mockUser(): PiUser {
  return { uid: "mock-uid-0001", username: "pioneer_demo" };
}

/* ------------------------------------------------------------------ */
/*  isPiBrowser                                                        */
/* ------------------------------------------------------------------ */
// window.Pi is injected only by the Pi Browser (after the SDK script loads).
// Used by the UI to show "Please open this app in Pi Browser." in any other
// browser instead of letting login fail silently.
export function isPiBrowser(): boolean {
  return typeof window !== "undefined" && typeof window.Pi !== "undefined";
}

// User-facing login messages.
export const NOT_PI_BROWSER_MESSAGE = "Please open this app in Pi Browser.";
export const LOGIN_FAILED_MESSAGE = "Login failed or cancelled.";
export const LOGIN_TIMEOUT_MESSAGE =
  "Pi connection timed out. Please open this app in Pi Browser and try again.";

// How long we wait for Pi.authenticate before giving up. The SDK script defines
// window.Pi in EVERY browser, but authenticate only ever resolves inside the Pi
// Browser — elsewhere it hangs forever, so this timeout is what unsticks the UI.
const LOGIN_TIMEOUT_MS = 8000;

/* ------------------------------------------------------------------ */
/*  initPiSDK                                                          */
/* ------------------------------------------------------------------ */
let initialised = false;

export function initPiSDK(): void {
  if (initialised) return;
  // The SDK only exists inside the Pi Browser. In a normal browser we simply
  // do nothing — the app must not crash, just prompt to open in Pi Browser.
  if (!isPiBrowser()) {
    // eslint-disable-next-line no-console
    console.info("[pi] Pi SDK not found — open in Pi Browser to log in.");
    return;
  }
  window.Pi!.init({ version: "2.0", sandbox: SANDBOX });
  initialised = true;
  // eslint-disable-next-line no-console
  console.info(`[pi] SDK initialised (sandbox=${SANDBOX})`);
}

/* ------------------------------------------------------------------ */
/*  onIncompletePaymentFound                                          */
/* ------------------------------------------------------------------ */
// Required by Pi.authenticate. With payments still mocked there's nothing to
// resume, so we just log it for now.
function onIncompletePaymentFound(payment: unknown): void {
  // eslint-disable-next-line no-console
  console.info("[pi] incomplete payment found:", payment);
}

/* ------------------------------------------------------------------ */
/*  loginWithPi                                                        */
/* ------------------------------------------------------------------ */
// REAL Pi login on the Testnet. Returns the authenticated user; the caller
// keeps only the public username + uid (never the accessToken).
//
// Throws an Error whose message is already user-facing, so the UI can show it
// directly. Three distinct outcomes:
//   - window.Pi missing  -> NOT_PI_BROWSER_MESSAGE (immediate)
//   - init/auth rejects  -> LOGIN_FAILED_MESSAGE
//   - auth never settles -> LOGIN_TIMEOUT_MESSAGE (after 8s)
export async function loginWithPi(): Promise<PiUser> {
  // 1 + 2. The SDK must be present. If not, fail immediately.
  if (typeof window === "undefined" || !window.Pi) {
    throw new Error(NOT_PI_BROWSER_MESSAGE);
  }
  const Pi = window.Pi;

  // 3 + 4. Initialise the SDK inside try/catch.
  try {
    if (!initialised) {
      Pi.init({ version: "2.0", sandbox: SANDBOX });
      initialised = true;
    }
  } catch {
    throw new Error(LOGIN_FAILED_MESSAGE);
  }

  // 4. Authenticate inside try/catch. Only the "username" scope is requested.
  const authenticate = (async (): Promise<PiUser> => {
    try {
      const auth = await Pi.authenticate(["username"], onIncompletePaymentFound);
      // NOTE: auth.accessToken is intentionally discarded and never stored.
      return auth.user;
    } catch {
      // Rejection here covers both errors and the user cancelling consent.
      throw new Error(LOGIN_FAILED_MESSAGE);
    }
  })();

  // 7. 8-second timeout so the button can never stay stuck on "Connecting…".
  let timer: ReturnType<typeof setTimeout>;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(LOGIN_TIMEOUT_MESSAGE)), LOGIN_TIMEOUT_MS);
  });

  try {
    return await Promise.race([authenticate, timeout]);
  } finally {
    clearTimeout(timer!);
  }
}

/* ------------------------------------------------------------------ */
/*  createPiPayment                                                    */
/* ------------------------------------------------------------------ */
// Starts a payment for a product. In mock mode this resolves immediately with a
// fake paymentId. With the real SDK, completion happens through the callbacks
// (onReadyForServerApproval / onReadyForServerCompletion), so this returns once
// the payment object exists.
export async function createPiPayment(product: Product): Promise<PiPaymentResult> {
  if (MOCK_PAYMENTS) {
    await wait(600);
    // eslint-disable-next-line no-console
    console.info(`[pi] mock createPayment: ${product.pricePi}π for "${product.productName}"`);
    return {
      paymentId: `mockpay_${Math.random().toString(36).slice(2, 10)}`,
      status: "created",
      user: mockUser(),
    };
  }

  // REAL: wrap the callback-based SDK in a promise.
  // return new Promise((resolve, reject) => {
  //   window.Pi!.createPayment(
  //     {
  //       amount: product.pricePi,
  //       memo: `Pi Seller Kit: ${product.productName}`,
  //       metadata: { productId: product.id },
  //     },
  //     {
  //       onReadyForServerApproval: (paymentId) => {
  //         fetch("/api/pi/approve", { method: "POST", body: JSON.stringify({ paymentId }) });
  //       },
  //       onReadyForServerCompletion: (paymentId, txid) => {
  //         fetch("/api/pi/complete", { method: "POST", body: JSON.stringify({ paymentId, txid }) })
  //           .then(() => resolve({ paymentId, status: "completed", txid, user: mockUser() }));
  //       },
  //       onCancel: (paymentId) => reject(new Error(`cancelled:${paymentId}`)),
  //       onError: (error) => reject(error),
  //     },
  //   );
  // });
  throw new Error("Real Pi SDK not enabled");
}

/* ------------------------------------------------------------------ */
/*  completePiPayment                                                  */
/* ------------------------------------------------------------------ */
// Confirms a payment as completed. In mock mode this just resolves true. With
// the real SDK, the *server* completes the payment via the Pi Platform API;
// this client helper would call that endpoint.
export async function completePiPayment(paymentId: string): Promise<boolean> {
  if (MOCK_PAYMENTS) {
    await wait(500);
    // eslint-disable-next-line no-console
    console.info(`[pi] mock completePayment: ${paymentId}`);
    return true;
  }

  // REAL:
  // const res = await fetch("/api/pi/complete", {
  //   method: "POST",
  //   headers: { "Content-Type": "application/json" },
  //   body: JSON.stringify({ paymentId }),
  // });
  // return res.ok;
  throw new Error("Real Pi SDK not enabled");
}

/* ------------------------------------------------------------------ */
/*  cancelPiPayment                                                    */
/* ------------------------------------------------------------------ */
export async function cancelPiPayment(paymentId: string): Promise<void> {
  if (MOCK_PAYMENTS) {
    await wait(200);
    // eslint-disable-next-line no-console
    console.info("[pi] mock payment cancelled:", paymentId);
    return;
  }

  // REAL:
  // await fetch("/api/pi/cancel", {
  //   method: "POST",
  //   headers: { "Content-Type": "application/json" },
  //   body: JSON.stringify({ paymentId }),
  // });
  throw new Error("Real Pi SDK not enabled");
}

/* ------------------------------------------------------------------ */
/*  errorPiPayment                                                     */
/* ------------------------------------------------------------------ */
// Central place to handle/report a payment error. Keep it side-effect light;
// the UI decides what to show the user.
export function errorPiPayment(error: unknown): { message: string } {
  const message =
    error instanceof Error ? error.message : "Something went wrong with the payment.";
  // eslint-disable-next-line no-console
  console.error("[pi] payment error:", message);
  // REAL: report to your monitoring / log endpoint here if desired.
  return { message };
}

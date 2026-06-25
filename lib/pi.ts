// =============================================================================
// Pi SDK integration layer
// =============================================================================
//
// This is the ONLY place the app talks to Pi. Every page imports these helpers
// instead of touching `window.Pi` directly, so going from mock -> real SDK is a
// change to this single file.
//
// CURRENT MODE: MOCK. No real Pi SDK is loaded or called. The functions below
// simulate the Pi payment lifecycle with timeouts and fake data so the whole
// flow (login -> create payment -> complete) is testable in a normal browser.
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
//   1. Load the SDK in app/layout.tsx:
//        <Script src="https://sdk.minepi.com/pi-sdk.js" strategy="beforeInteractive" />
//   2. Set MOCK_MODE = false below.
//   3. Replace the bodies marked `// REAL:` with the real `window.Pi` calls.
//   4. Implement the two server endpoints Pi requires:
//        POST /api/pi/approve   -> calls Pi Platform API /payments/{id}/approve
//        POST /api/pi/complete  -> calls Pi Platform API /payments/{id}/complete
//      and call them from onReadyForServerApproval / onReadyForServerCompletion.
// =============================================================================

import type { Product } from "./types";

const MOCK_MODE = true;

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
/*  initPiSDK                                                          */
/* ------------------------------------------------------------------ */
let initialised = false;

export function initPiSDK(): void {
  if (initialised) return;
  initialised = true;

  if (MOCK_MODE) {
    // Nothing to load in mock mode.
    // eslint-disable-next-line no-console
    console.info("[pi] mock SDK ready");
    return;
  }

  // REAL:
  // if (typeof window !== "undefined" && window.Pi) {
  //   window.Pi.init({ version: "2.0", sandbox: true });
  // }
}

/* ------------------------------------------------------------------ */
/*  loginWithPi                                                        */
/* ------------------------------------------------------------------ */
// Returns the authenticated Pi user. We only keep the public username.
export async function loginWithPi(): Promise<PiUser> {
  if (MOCK_MODE) {
    await wait(400);
    return mockUser();
  }

  // REAL:
  // const scopes = ["username", "payments"];
  // const auth = await window.Pi!.authenticate(scopes, onIncompletePaymentFound);
  // return auth.user;
  throw new Error("Real Pi SDK not enabled");
}

/* ------------------------------------------------------------------ */
/*  createPiPayment                                                    */
/* ------------------------------------------------------------------ */
// Starts a payment for a product. In mock mode this resolves immediately with a
// fake paymentId. With the real SDK, completion happens through the callbacks
// (onReadyForServerApproval / onReadyForServerCompletion), so this returns once
// the payment object exists.
export async function createPiPayment(product: Product): Promise<PiPaymentResult> {
  if (MOCK_MODE) {
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
  if (MOCK_MODE) {
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
  if (MOCK_MODE) {
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

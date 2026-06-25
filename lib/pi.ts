// =============================================================================
// Pi SDK integration layer
// =============================================================================
//
// This is the ONLY place the app talks to Pi. Every page imports these helpers
// instead of touching `window.Pi` directly, so going from mock -> real SDK is a
// change to this single file.
//
// CURRENT MODE: LOGIN and PAYMENTS are both REAL.
//   - Login: Pi.authenticate(["username","payments"]). Sandbox is auto-detected
//     (see isSandboxMode): false in Pi Browser, true when wrapped by the Pi
//     sandbox tool. Pi.init is awaited before authenticate.
//   - Payments: startPiPayment -> window.Pi.createPayment. Approval and
//     completion are done SERVER-SIDE via /api/pi/approve and /api/pi/complete,
//     which call the Pi Platform API with PI_API_KEY (never exposed here).
//
// -----------------------------------------------------------------------------
// SECURITY (do not weaken):
//   - Never ask the user for a seed phrase, mnemonic, or private key.
//   - Never collect or store private keys or wallet secrets.
//   - Login and payment happen ONLY through the Pi SDK (Pi.authenticate /
//     Pi.createPayment). This app never handles credentials itself.
//   - PI_API_KEY lives only in server route handlers (process.env), never in
//     this client module or any frontend bundle.
//   - Do not persist sensitive user data. We keep only a public username + uid.
// =============================================================================

// Pi.init sandbox flag — auto-detected, so we never have to flip it by hand:
//   - Opened normally in Pi Browser (our production case) -> false, so
//     authenticate works. (sandbox:true here would make init fail with
//     "SDK was not initialized".)
//   - Loaded by the Pi sandbox tool (sandbox.minepi.com wraps our app in an
//     iframe for the dev-portal "Run in Sandbox" step) -> true.
//   - Manual override for testing: add ?sandbox=true to the URL.
function isSandboxMode(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const params = new URLSearchParams(window.location.search);
    if (params.get("sandbox") === "true") return true;

    // When sandbox.minepi.com embeds our app, OUR hostname stays the same, so
    // we detect the sandbox parent instead.
    const ancestors = window.location.ancestorOrigins;
    if (ancestors) {
      for (let i = 0; i < ancestors.length; i++) {
        if (ancestors[i].includes("sandbox.minepi.com")) return true;
      }
    }
    if (document.referrer.includes("sandbox.minepi.com")) return true;
  } catch {
    // Any access error -> treat as production (not sandbox).
  }
  return false;
}

// How long we wait for the whole authenticate flow before giving up. Generous
// (12s) so the user has time to tap "Approve" on the Pi consent screen, but
// finite so the button can never stay stuck on "Connecting…".
const LOGIN_TIMEOUT_MS = 12000;

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

// Window typing for when the real SDK is present.
declare global {
  interface Window {
    Pi?: {
      // Different SDK builds return either void (sync) or a Promise (async),
      // so we treat the result as possibly thenable and await it.
      init: (config: { version: string; sandbox?: boolean }) => void | Promise<void>;
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
export const NOT_PI_BROWSER_MESSAGE =
  "Pi SDK not detected. Please open this app in Pi Browser.";
export const NO_USERNAME_MESSAGE = "Pi login returned no username.";
export const LOGIN_TIMEOUT_MESSAGE =
  "Pi login timed out. Please close and reopen this app in Pi Browser.";

// Diagnostics collected for the on-screen debug panel when login fails.
export interface PiDiagnostics {
  piDetected: boolean;
  userAgent: string;
  url: string;
  sdkScriptPresent: boolean;
}

export function getPiDiagnostics(): PiDiagnostics {
  if (typeof window === "undefined") {
    return { piDetected: false, userAgent: "", url: "", sdkScriptPresent: false };
  }
  return {
    piDetected: typeof window.Pi !== "undefined",
    userAgent: navigator.userAgent,
    url: window.location.href,
    sdkScriptPresent: !!document.querySelector('script[src*="pi-sdk.js"]'),
  };
}

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
  const sandbox = isSandboxMode();
  window.Pi!.init(sandbox ? { version: "2.0", sandbox: true } : { version: "2.0" });
  initialised = true;
  // eslint-disable-next-line no-console
  console.info(`[pi] SDK initialised (sandbox=${sandbox})`);
}

/* ------------------------------------------------------------------ */
/*  onIncompletePaymentFound                                          */
/* ------------------------------------------------------------------ */
// Required by Pi.authenticate. With payments still mocked there's nothing to
// resume, so we just log it for now.
function onIncompletePaymentFound(payment: unknown): void {
  // eslint-disable-next-line no-console
  console.log("Incomplete payment found:", payment);
}

/* ------------------------------------------------------------------ */
/*  loginWithPi                                                        */
/* ------------------------------------------------------------------ */
// The public result of a login. Only username + uid — never the accessToken.
export interface PiLoginUser {
  username: string;
  uid: string;
}

// REAL Pi login. Resolves with { username, uid }, or rejects with an Error
// whose .message is already user-facing. Outcomes:
//   - window.Pi missing      -> NOT_PI_BROWSER_MESSAGE (immediate)
//   - Pi.init throws          -> the real init error
//   - Pi.authenticate throws  -> the real auth error (also covers user cancel)
//   - no username in result   -> NO_USERNAME_MESSAGE
//   - nothing settles in 12s  -> LOGIN_TIMEOUT_MESSAGE
//
// Whatever happens, this function always settles — it never hangs — so the
// caller's button can never stay stuck on "Connecting…".
export async function loginWithPi(): Promise<PiLoginUser> {
  // The SDK must be present. If not (e.g. normal Chrome), fail at once.
  if (typeof window === "undefined" || !window.Pi) {
    throw new Error(NOT_PI_BROWSER_MESSAGE);
  }
  const Pi = window.Pi;

  // Initialise inside try/catch. We re-init on EVERY attempt (Pi.init is
  // idempotent) so a previous failed init can never leave the SDK in a
  // "not initialized" state on retry. Production passes { version: "2.0" }
  // with no sandbox key; only the sandbox tool sets sandbox: true.
  //
  // CRITICAL: Pi.init may be async in some SDK builds. If we don't wait for it
  // to finish, the very next authenticate() throws "SDK was not initialized".
  // So we await the result whenever it's thenable.
  try {
    const sandbox = isSandboxMode();
    const initResult = Pi.init(
      sandbox ? { version: "2.0", sandbox: true } : { version: "2.0" },
    ) as unknown;
    if (
      initResult &&
      typeof (initResult as { then?: unknown }).then === "function"
    ) {
      await (initResult as Promise<unknown>);
    }
    initialised = true;
    // eslint-disable-next-line no-console
    console.info(`[pi] SDK initialised (sandbox=${sandbox})`);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[pi] Pi.init failed:", err);
    throw err instanceof Error ? err : new Error("Pi.init failed.");
  }

  // Authenticate inside try/catch. Tolerant of different result shapes, and
  // raced against a 12s timeout. No artificial limit on the user's approval —
  // the timeout only guards against the SDK never responding at all.
  const authenticate = (async (): Promise<PiLoginUser> => {
    let raw: unknown;
    try {
      // "payments" is required so the same session can also create payments.
      const scopes = ["username", "payments"];
      raw = await Pi.authenticate(scopes, onIncompletePaymentFound);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("[pi] Pi.authenticate failed:", err);
      throw err instanceof Error ? err : new Error("Pi.authenticate failed.");
    }

    // Accept both { user: { username, uid } } and { username, uid }.
    const result = (raw ?? {}) as {
      user?: { username?: string; uid?: string };
      username?: string;
      uid?: string;
    };
    const username = result.user?.username ?? result.username;
    const uid = result.user?.uid ?? result.uid;
    if (!username) {
      // eslint-disable-next-line no-console
      console.error("[pi] auth result had no username:", raw);
      throw new Error(NO_USERNAME_MESSAGE);
    }
    // accessToken (if any) is intentionally ignored and never returned/stored.
    return { username, uid: uid ?? "" };
  })();

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
/*  startPiPayment                                                     */
/* ------------------------------------------------------------------ */
// Metadata we attach to every payment so the order can be reconciled later.
export interface PiPaymentMetadata extends Record<string, unknown> {
  productId: string;
  orderId: string;
  buyerUid: string;
  buyerUsername: string;
}

// The four callbacks Pi drives during a payment. The caller (checkout page)
// implements them to talk to our /api/pi/* routes and update the order.
export interface PiPaymentCallbacks {
  onReadyForServerApproval: (paymentId: string) => void;
  onReadyForServerCompletion: (paymentId: string, txid: string) => void;
  onCancel: (paymentId: string) => void;
  onError: (error: Error, payment?: unknown) => void;
}

// Kicks off a REAL Pi payment. The SDK is callback-driven (no promise), so this
// returns immediately; progress arrives through the callbacks above.
export function startPiPayment(
  data: { amount: number; memo: string; metadata: PiPaymentMetadata },
  callbacks: PiPaymentCallbacks,
): void {
  if (typeof window === "undefined" || !window.Pi) {
    throw new Error(NOT_PI_BROWSER_MESSAGE);
  }
  window.Pi.createPayment(
    { amount: data.amount, memo: data.memo, metadata: data.metadata },
    callbacks,
  );
}

// =============================================================================
// Pi SDK integration layer
// =============================================================================
//
// All client-side Pi SDK calls live here. The Server API Key is never imported
// or referenced from this file; it is used only in Next.js API routes.
//
// SECURITY RULES:
// - Never ask for wallet passphrases, seed phrases, private keys, or mnemonics.
// - Never store the Pi accessToken in localStorage.
// - Payments must be approved/completed by server routes using PI_API_KEY.
// =============================================================================

const LOGIN_TIMEOUT_MS = 30000;
const SDK_WAIT_TIMEOUT_MS = 8000;

export interface PiUser {
  uid: string;
  username: string;
}

export interface PiPaymentData {
  amount: number;
  memo: string;
  metadata: Record<string, unknown>;
}

export interface PaymentDTO {
  identifier: string;
  user_uid: string;
  amount: number;
  memo: string;
  metadata?: Record<string, unknown>;
  status?: {
    developer_approved?: boolean;
    transaction_verified?: boolean;
    developer_completed?: boolean;
    cancelled?: boolean;
    user_cancelled?: boolean;
  };
  transaction?: null | {
    txid?: string;
    verified?: boolean;
    _link?: string;
  };
}

declare global {
  interface Window {
    Pi?: {
      init: (config: { version: string; sandbox?: boolean }) => void | Promise<void>;
      authenticate: (
        scopes: string[],
        onIncompletePaymentFound: (payment: PaymentDTO) => void,
      ) => Promise<{ user: PiUser; accessToken: string }>;
      createPayment: (
        data: PiPaymentData,
        callbacks: {
          onReadyForServerApproval: (paymentId: string) => void;
          onReadyForServerCompletion: (paymentId: string, txid: string) => void;
          onCancel: (paymentId: string) => void;
          onError: (error: Error, payment?: PaymentDTO) => void;
        },
      ) => void;
    };
  }
}

export interface PiDiagnostics {
  piDetected: boolean;
  userAgent: string;
  url: string;
  sdkScriptPresent: boolean;
}

export const NOT_PI_BROWSER_MESSAGE =
  "Pi SDK not detected. Please open this app in Pi Browser.";
export const NO_USERNAME_MESSAGE = "Pi login returned no username.";
export const LOGIN_TIMEOUT_MESSAGE =
  "Pi login timed out. Please approve in Pi Browser and try again.";

let initialised = false;
let initialising: Promise<void> | null = null;

export function isPiBrowser(): boolean {
  return typeof window !== "undefined" && typeof window.Pi !== "undefined";
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

function isSandboxMode(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const params = new URLSearchParams(window.location.search);
    if (params.get("sandbox") === "true") return true;

    // Optional Vercel/client build flag. This is not sensitive; it only chooses
    // SDK sandbox mode. Set NEXT_PUBLIC_PI_SANDBOX=true only for sandbox builds.
    if (process.env.NEXT_PUBLIC_PI_SANDBOX === "true") return true;

    const ancestors = window.location.ancestorOrigins;
    if (ancestors) {
      for (let i = 0; i < ancestors.length; i += 1) {
        if (ancestors[i].includes("sandbox.minepi.com")) return true;
      }
    }
    if (document.referrer.includes("sandbox.minepi.com")) return true;
  } catch {
    // Treat access errors as normal Pi Browser production mode.
  }
  return false;
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForPiSDK(timeoutMs = SDK_WAIT_TIMEOUT_MS): Promise<void> {
  if (typeof window === "undefined") throw new Error(NOT_PI_BROWSER_MESSAGE);
  const started = Date.now();
  while (!window.Pi && Date.now() - started < timeoutMs) {
    await wait(100);
  }
  if (!window.Pi) throw new Error(NOT_PI_BROWSER_MESSAGE);
}

async function ensurePiSDKInitialised(): Promise<void> {
  if (initialised) return;
  if (initialising) return initialising;

  initialising = (async () => {
    await waitForPiSDK();
    const Pi = window.Pi;
    if (!Pi) throw new Error(NOT_PI_BROWSER_MESSAGE);

    const sandbox = isSandboxMode();
    const result = Pi.init(
      sandbox ? { version: "2.0", sandbox: true } : { version: "2.0" },
    ) as unknown;

    if (result && typeof (result as { then?: unknown }).then === "function") {
      await (result as Promise<unknown>);
    }

    initialised = true;
    // eslint-disable-next-line no-console
    console.info(`[pi] SDK initialised (sandbox=${sandbox})`);
  })();

  try {
    await initialising;
  } finally {
    initialising = null;
  }
}

// Backward-compatible public helper. It intentionally does not throw into the
// UI; loginWithPi/startPiPayment use the async version above and surface errors.
export function initPiSDK(): void {
  void ensurePiSDKInitialised().catch((err) => {
    // eslint-disable-next-line no-console
    console.info("[pi] SDK not ready:", err instanceof Error ? err.message : err);
  });
}

async function postJson(path: string, payload: unknown): Promise<unknown> {
  const res = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return res.json().catch(() => null);
}

function getOrderIdFromPayment(payment: PaymentDTO): string | undefined {
  const maybeOrderId = payment.metadata?.orderId;
  return typeof maybeOrderId === "string" ? maybeOrderId : undefined;
}

async function onIncompletePaymentFound(payment: PaymentDTO): Promise<void> {
  // Important: an incomplete payment can block new payments. We try to resolve
  // it server-side when enough information is available. If it has a txid, call
  // complete; if no txid exists yet, record it for debugging.
  // eslint-disable-next-line no-console
  console.warn("[pi] incomplete payment found:", payment);

  const paymentId = payment.identifier;
  const txid = payment.transaction?.txid;
  const orderId = getOrderIdFromPayment(payment) || paymentId;

  try {
    if (paymentId && txid) {
      await postJson("/api/pi/complete", { paymentId, txid, orderId });
      return;
    }
    await postJson("/api/pi/incomplete", { payment });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn("[pi] failed to report incomplete payment:", err);
  }
}

export interface PiLoginUser {
  username: string;
  uid: string;
}

function normaliseAuthResult(raw: unknown): PiLoginUser {
  const maybe = raw as { user?: { username?: unknown; uid?: unknown } };
  const username = maybe?.user?.username;
  const uid = maybe?.user?.uid;
  if (typeof username !== "string" || username.length === 0) {
    throw new Error(NO_USERNAME_MESSAGE);
  }
  return { username, uid: typeof uid === "string" ? uid : "" };
}

export async function loginWithPi(): Promise<PiLoginUser> {
  const run = (async (): Promise<PiLoginUser> => {
    await ensurePiSDKInitialised();
    const Pi = window.Pi;
    if (!Pi) throw new Error(NOT_PI_BROWSER_MESSAGE);

    let raw: unknown;
    try {
      raw = await Pi.authenticate(["username", "payments"], onIncompletePaymentFound);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("[pi] Pi.authenticate failed:", err);
      throw err instanceof Error ? err : new Error("Pi login failed or cancelled.");
    }

    // accessToken exists in raw but is deliberately ignored and never stored.
    return normaliseAuthResult(raw);
  })();

  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(LOGIN_TIMEOUT_MESSAGE)), LOGIN_TIMEOUT_MS);
  });

  try {
    return await Promise.race([run, timeout]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export interface PiPaymentMetadata extends Record<string, unknown> {
  productId: string;
  orderId: string;
  buyerUid: string;
  buyerUsername: string;
}

export interface PiPaymentCallbacks {
  onReadyForServerApproval: (paymentId: string) => void;
  onReadyForServerCompletion: (paymentId: string, txid: string) => void;
  onCancel: (paymentId: string) => void;
  onError: (error: Error, payment?: PaymentDTO) => void;
}

export async function startPiPayment(
  data: { amount: number; memo: string; metadata: PiPaymentMetadata },
  callbacks: PiPaymentCallbacks,
): Promise<void> {
  if (!Number.isFinite(data.amount) || data.amount <= 0) {
    throw new Error("Payment amount must be greater than 0 Pi.");
  }

  await ensurePiSDKInitialised();
  const Pi = window.Pi;
  if (!Pi) throw new Error(NOT_PI_BROWSER_MESSAGE);

  Pi.createPayment(
    {
      amount: data.amount,
      memo: data.memo,
      metadata: data.metadata,
    },
    callbacks,
  );
}

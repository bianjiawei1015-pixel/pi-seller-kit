"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { PageHeader } from "@/components/PageHeader";
import { Button, ButtonLink } from "@/components/Button";
import { PiAmount } from "@/components/PiAmount";
import { EmptyState } from "@/components/EmptyState";
import { savePiUser } from "@/lib/storage";
import { isPiBrowser, loginWithPi, startPiPayment } from "@/lib/pi";
import {
  fetchProduct,
  createOrderApi,
  patchOrderApi,
} from "@/lib/client";
import type { Product } from "@/lib/types";

// idle -> processing (createPayment) -> approving (server approve)
//      -> completing (server complete) -> success redirect, or error.
type Phase = "idle" | "processing" | "approving" | "completing" | "error";

// Shape of the JSON returned by /api/pi/approve and /api/pi/complete.
interface OrderRouteResponse {
  ok?: boolean;
  message?: string;
  order?: { orderId?: string };
}

export default function CheckoutPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const id = params?.id;

  const [product, setProduct] = useState<Product | null | undefined>(undefined);
  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (typeof id !== "string") return;
    let active = true;
    setProduct(undefined);
    setLoadError(null);
    fetchProduct(id)
      .then((p) => {
        if (active) setProduct(p);
      })
      .catch((err: unknown) => {
        if (active) {
          setLoadError(err instanceof Error ? err.message : "Failed to load product.");
          setProduct(null);
        }
      });
    return () => {
      active = false;
    };
  }, [id]);

  // Real Pi payment lifecycle. Pi.createPayment is callback-driven; the four
  // callbacks talk to our server routes and move the order through its statuses.
  async function handlePay() {
    if (!product) return;
    setError(null);

    // Must be inside Pi Browser to pay.
    if (!isPiBrowser()) {
      setError("Please open this app in Pi Browser to pay with Pi.");
      return;
    }

    setPhase("processing");

    // Re-authenticate right before payment. A username saved in localStorage is
    // useful for display, but it does NOT guarantee the SDK has an active
    // authenticated payments session after a refresh. This is the main fix for
    // payments failing after the user looked logged in.
    let buyer;
    try {
      buyer = await loginWithPi();
      savePiUser(buyer);
    } catch (err) {
      setPhase("error");
      setError(err instanceof Error ? err.message : "Please login with Pi before payment.");
      return;
    }

    // Create the pending order on the server. The amount is read from the
    // product row in the database there, so the price cannot be tampered with
    // from the client. We then charge exactly that server-returned amount.
    let orderId: string;
    let amountPi: number;
    try {
      const created = await createOrderApi(product.id, {
        uid: buyer.uid,
        username: buyer.username,
      });
      orderId = created.orderId;
      amountPi = created.amountPi;
    } catch (err) {
      setPhase("error");
      setError(err instanceof Error ? err.message : "Could not start the order.");
      return;
    }

    // The Pi server routes (/api/pi/approve, /api/pi/complete) are the single
    // source of truth: they verify the payment against the order in the database
    // and perform the approved/paid status writes themselves. The client must NOT
    // PATCH the order to approved/paid and never sends paymentId/txid. We only
    // record a buyer-side cancelled/failed outcome (the only statuses the public
    // PATCH endpoint accepts).
    const recordOutcome = async (
      status: "cancelled" | "failed",
    ): Promise<void> => {
      try {
        await patchOrderApi(orderId, { status });
      } catch {
        // ignore — recording the outcome is best-effort
      }
    };

    const paymentData = {
      amount: amountPi,
      memo: "Payment for " + product.productName,
      metadata: {
        productId: product.id,
        orderId,
        buyerUid: buyer.uid,
        buyerUsername: buyer.username,
      },
    };

    try {
      const approvedPayments = new Set<string>();
      const completedPayments = new Set<string>();

      await startPiPayment(paymentData, {
        // 1) Server verifies + approves. The server sets status=approved.
        onReadyForServerApproval: async (paymentId) => {
          if (approvedPayments.has(paymentId)) return;
          approvedPayments.add(paymentId);
          setPhase("approving");
          try {
            const res = await fetch("/api/pi/approve", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ paymentId, orderId }),
            });
            const data = (await res
              .json()
              .catch(() => null)) as OrderRouteResponse | null;
            if (!(res.ok && data?.ok)) {
              setError(data?.message || "Approval failed.");
              setPhase("error");
            }
            // On success the server has already marked the order approved.
          } catch {
            setError("Approval request failed.");
            setPhase("error");
          }
        },

        // 2) Server verifies + completes. The server sets status=paid.
        onReadyForServerCompletion: async (paymentId, txid) => {
          if (completedPayments.has(paymentId)) return;
          completedPayments.add(paymentId);
          setPhase("completing");
          try {
            const res = await fetch("/api/pi/complete", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ paymentId, txid, orderId }),
            });
            const data = (await res
              .json()
              .catch(() => null)) as OrderRouteResponse | null;
            if (res.ok && data?.ok) {
              // Use the order the server returned (it performed the paid write).
              const finalOrderId = data.order?.orderId ?? orderId;
              router.push(`/success?orderId=${encodeURIComponent(finalOrderId)}`);
            } else {
              setError(data?.message || "Completion failed.");
              setPhase("error");
            }
          } catch {
            setError("Completion request failed.");
            setPhase("error");
          }
        },

        // 3) Buyer cancelled in the Pi wallet.
        onCancel: () => {
          void recordOutcome("cancelled");
          setError("Payment cancelled.");
          setPhase("error");
        },

        // 4) Any SDK / payment error.
        onError: (err) => {
          // eslint-disable-next-line no-console
          console.error("[pi] payment error:", err);
          void recordOutcome("failed");
          setError("Payment failed.");
          setPhase("error");
        },
      });
    } catch (err) {
      void recordOutcome("failed");
      setError(err instanceof Error ? err.message : "Payment failed.");
      setPhase("error");
    }
  }

  if (product === undefined) {
    return (
      <>
        <PageHeader title="Checkout" back />
        <main className="flex-1 px-5 pt-6">
          <div className="h-24 animate-pulse rounded-card bg-hairline/60" />
        </main>
      </>
    );
  }

  if (product === null) {
    return (
      <>
        <PageHeader title="Checkout" back />
        <main className="flex flex-1 items-center px-5">
          <EmptyState
            title={loadError ? "Couldn’t load checkout" : "Product not found"}
            body={
              loadError ??
              "This checkout link is invalid, or the product is no longer available."
            }
            action={<ButtonLink href="/" variant="secondary">Back to Home</ButtonLink>}
          />
        </main>
      </>
    );
  }

  const working =
    phase === "processing" || phase === "approving" || phase === "completing";

  const phaseLabel: Record<Phase, string> = {
    idle: "Pay with Pi",
    processing: "Processing Pi payment…",
    approving: "Approving payment…",
    completing: "Completing payment…",
    error: "Pay with Pi",
  };

  return (
    <>
      <PageHeader title="Checkout" back />

      <main className="flex-1 px-5 pt-6">
        {/* Order summary */}
        <div className="rounded-card bg-surface p-5 shadow-card ring-1 ring-hairline/60">
          <p className="text-[12px] font-medium uppercase tracking-wide text-muted">
            You are paying for
          </p>
          <div className="mt-2 flex items-center justify-between gap-3">
            <h2 className="text-[18px] font-semibold tracking-tight">
              {product.productName}
            </h2>
            <PiAmount amount={product.pricePi} size="md" />
          </div>

          <div className="mt-4 h-px w-full bg-hairline" />

          <div className="mt-4 flex items-center justify-between">
            <span className="text-[15px] text-muted">Total</span>
            <PiAmount amount={product.pricePi} size="lg" />
          </div>
        </div>

        {/* Testnet notice */}
        <div className="mt-4 rounded-2xl bg-pi-50 px-4 py-3 text-[13px] leading-relaxed text-pi-700">
          You will confirm this payment in your Pi Wallet. Approval and
          completion are handled securely on our server. You will never be asked
          for a wallet passphrase or private key.
        </div>

        {error ? (
          <p className="mt-4 rounded-2xl bg-danger/10 px-4 py-3 text-[14px] text-danger">
            {error}
          </p>
        ) : null}
      </main>

      <div className="sticky bottom-0 z-20 mt-auto border-t border-hairline bg-canvas/90 px-5 pt-3 pb-safe backdrop-blur-md">
        <Button onClick={handlePay} disabled={working}>
          {phaseLabel[phase]}
        </Button>
      </div>
    </>
  );
}

"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { PageHeader } from "@/components/PageHeader";
import { Button, ButtonLink } from "@/components/Button";
import { PiAmount } from "@/components/PiAmount";
import { EmptyState } from "@/components/EmptyState";
import {
  getProduct,
  createOrder,
  updateOrder,
  savePiUser,
} from "@/lib/storage";
import { isPiBrowser, loginWithPi, startPiPayment } from "@/lib/pi";
import type { Product } from "@/lib/types";

// idle -> processing (createPayment) -> approving (server approve)
//      -> completing (server complete) -> success redirect, or error.
type Phase = "idle" | "processing" | "approving" | "completing" | "error";

export default function CheckoutPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const id = params?.id;

  const [product, setProduct] = useState<Product | null | undefined>(undefined);
  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (typeof id === "string") setProduct(getProduct(id) ?? null);
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

    // Record the order as pending up front so its id can go in the metadata.
    const order = createOrder({
      productId: product.id,
      productName: product.productName,
      amountPi: product.pricePi,
      buyerUid: buyer.uid,
      buyerUsername: buyer.username,
    });

    const paymentData = {
      amount: Number(product.pricePi),
      memo: "Payment for " + product.productName,
      metadata: {
        productId: product.id,
        orderId: order.orderId,
        buyerUid: buyer.uid,
        buyerUsername: buyer.username,
      },
    };

    try {
      const approvedPayments = new Set<string>();
      const completedPayments = new Set<string>();

      await startPiPayment(paymentData, {
        // 1) Server-side approve.
        onReadyForServerApproval: async (paymentId) => {
          if (approvedPayments.has(paymentId)) return;
          approvedPayments.add(paymentId);
          updateOrder(order.orderId, { paymentId });
          setPhase("approving");
          try {
            const res = await fetch("/api/pi/approve", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ paymentId, orderId: order.orderId }),
            });
            const data = await res.json().catch(() => ({}));
            if (res.ok && data.ok) {
              updateOrder(order.orderId, { status: "approved" });
            } else {
              updateOrder(order.orderId, { status: "failed" });
              setError(data?.message || "Approval failed.");
              setPhase("error");
            }
          } catch {
            updateOrder(order.orderId, { status: "failed" });
            setError("Approval request failed.");
            setPhase("error");
          }
        },

        // 2) Server-side complete, then go to success.
        onReadyForServerCompletion: async (paymentId, txid) => {
          if (completedPayments.has(paymentId)) return;
          completedPayments.add(paymentId);
          updateOrder(order.orderId, { paymentId, txid });
          setPhase("completing");
          try {
            const res = await fetch("/api/pi/complete", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ paymentId, txid, orderId: order.orderId }),
            });
            const data = await res.json().catch(() => ({}));
            if (res.ok && data.ok) {
              updateOrder(order.orderId, { status: "paid" });
              router.push(
                `/success?orderId=${encodeURIComponent(order.orderId)}`,
              );
            } else {
              updateOrder(order.orderId, { status: "failed" });
              setError(data?.message || "Completion failed.");
              setPhase("error");
            }
          } catch {
            updateOrder(order.orderId, { status: "failed" });
            setError("Completion request failed.");
            setPhase("error");
          }
        },

        // 3) Buyer cancelled in the Pi wallet.
        onCancel: (paymentId) => {
          updateOrder(order.orderId, { status: "cancelled", paymentId });
          setError("Payment cancelled.");
          setPhase("error");
        },

        // 4) Any SDK / payment error.
        onError: (err) => {
          // eslint-disable-next-line no-console
          console.error("[pi] payment error:", err);
          updateOrder(order.orderId, { status: "failed" });
          setError("Payment failed.");
          setPhase("error");
        },
      });
    } catch (err) {
      updateOrder(order.orderId, { status: "failed" });
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
            title="Product not found"
            body="This checkout link is invalid or was created on another device."
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

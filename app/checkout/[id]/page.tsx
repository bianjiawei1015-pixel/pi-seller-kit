"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { PageHeader } from "@/components/PageHeader";
import { Button, ButtonLink } from "@/components/Button";
import { PiAmount } from "@/components/PiAmount";
import { EmptyState } from "@/components/EmptyState";
import { getProduct, createOrder, updateOrder } from "@/lib/storage";
import {
  loginWithPi,
  createPiPayment,
  completePiPayment,
  errorPiPayment,
} from "@/lib/pi";
import type { Product } from "@/lib/types";

type Phase = "idle" | "authenticating" | "creating" | "completing" | "error";

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

  // The full mock payment lifecycle, mirroring the real Pi SDK order of
  // operations: authenticate -> create payment -> complete payment.
  async function handlePay() {
    if (!product) return;
    setError(null);

    try {
      setPhase("authenticating");
      const user = await loginWithPi(); // Pi.authenticate (mock)

      setPhase("creating");
      const payment = await createPiPayment(product); // Pi.createPayment (mock)

      // Record the order as pending the moment the payment exists.
      const order = createOrder({
        productId: product.id,
        productName: product.productName,
        amountPi: product.pricePi,
        buyerUsername: user.username,
        paymentId: payment.paymentId,
      });

      setPhase("completing");
      const ok = await completePiPayment(payment.paymentId); // server-side complete (mock)

      updateOrder(order.orderId, { status: ok ? "completed" : "failed" });

      if (!ok) throw new Error("Payment could not be completed.");

      router.push(`/success?orderId=${encodeURIComponent(order.orderId)}`);
    } catch (err) {
      const { message } = errorPiPayment(err);
      setError(message);
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
    phase === "authenticating" || phase === "creating" || phase === "completing";

  const phaseLabel: Record<Phase, string> = {
    idle: "Mock Pay with Pi",
    authenticating: "Connecting to Pi…",
    creating: "Creating payment…",
    completing: "Completing payment…",
    error: "Try again",
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

        {/* Mock-mode notice */}
        <div className="mt-4 rounded-2xl bg-pi-50 px-4 py-3 text-[13px] leading-relaxed text-pi-700">
          Demo mode: this simulates the Pi payment flow and records an order. No
          real Pi is transferred. Login and payment will run through the Pi SDK
          once connected.
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

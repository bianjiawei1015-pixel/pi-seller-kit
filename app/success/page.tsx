"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { PageHeader } from "@/components/PageHeader";
import { ButtonLink } from "@/components/Button";

function SuccessContent() {
  const params = useSearchParams();
  const orderId = params.get("orderId") ?? "—";

  return (
    <>
      <main className="flex flex-1 flex-col items-center justify-center px-6 text-center">
        {/* Success mark */}
        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-success/10">
          <svg width="36" height="36" viewBox="0 0 24 24" fill="none" aria-hidden>
            <path
              d="M5 12.5l4.5 4.5L19 7.5"
              stroke="#16A34A"
              strokeWidth="2.4"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>

        <h2 className="mt-6 text-[24px] font-bold tracking-tight">Payment successful</h2>
        <p className="mt-2 max-w-[28ch] text-[15px] leading-relaxed text-muted">
          Your order has been recorded. The seller will be in touch using the
          contact details on the product.
        </p>

        {/* Order id */}
        <div className="mt-7 w-full rounded-card bg-surface px-5 py-4 shadow-card ring-1 ring-hairline/60">
          <p className="text-[12px] font-medium uppercase tracking-wide text-muted">
            Order number
          </p>
          <p className="mt-1 font-mono text-[20px] font-semibold tracking-tight tnum">
            {orderId}
          </p>
        </div>
      </main>

      <div className="sticky bottom-0 z-20 mt-auto bg-canvas/90 px-5 pt-3 pb-safe backdrop-blur-md">
        <div className="flex flex-col gap-3">
          <ButtonLink href="/" variant="primary">
            Back to Home
          </ButtonLink>
          <ButtonLink href="/orders" variant="ghost">
            View all orders
          </ButtonLink>
        </div>
      </div>
    </>
  );
}

export default function SuccessPage() {
  return (
    <>
      <PageHeader title="Success" />
      <Suspense
        fallback={<main className="flex-1 px-5 pt-10 text-center text-muted">Loading…</main>}
      >
        <SuccessContent />
      </Suspense>
    </>
  );
}

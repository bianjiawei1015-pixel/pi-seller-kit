"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { PageHeader } from "@/components/PageHeader";
import { ButtonLink } from "@/components/Button";
import { PiAmount } from "@/components/PiAmount";
import { EmptyState } from "@/components/EmptyState";
import { getProduct } from "@/lib/storage";
import type { Product } from "@/lib/types";

export default function ProductPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id;
  const [product, setProduct] = useState<Product | null | undefined>(undefined);

  useEffect(() => {
    if (typeof id === "string") setProduct(getProduct(id) ?? null);
  }, [id]);

  // undefined = still loading, null = not found
  if (product === undefined) {
    return (
      <>
        <PageHeader title="Product" back />
        <main className="flex-1 px-5 pt-5">
          <div className="aspect-square w-full animate-pulse rounded-card bg-hairline/60" />
          <div className="mt-4 h-6 w-2/3 animate-pulse rounded bg-hairline/60" />
        </main>
      </>
    );
  }

  if (product === null) {
    return (
      <>
        <PageHeader title="Product" back />
        <main className="flex flex-1 items-center px-5">
          <EmptyState
            title="Product not found"
            body="This product link is invalid or was created on another device."
            action={<ButtonLink href="/" variant="secondary">Back to Home</ButtonLink>}
          />
        </main>
      </>
    );
  }

  return (
    <>
      <PageHeader title="Product" back />

      <main className="flex-1 px-5 pt-4">
        {/* Image */}
        <div className="aspect-square w-full overflow-hidden rounded-card bg-pi-50 ring-1 ring-hairline/60">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={product.imageUrl}
            alt={product.productName}
            className="h-full w-full object-cover"
          />
        </div>

        {/* Title + price */}
        <div className="mt-5 flex items-start justify-between gap-3">
          <h2 className="text-[22px] font-bold leading-tight tracking-tight">
            {product.productName}
          </h2>
          <div className="shrink-0 pt-1">
            <PiAmount amount={product.pricePi} size="lg" />
          </div>
        </div>

        {/* Description */}
        {product.description ? (
          <p className="mt-4 whitespace-pre-wrap text-[15px] leading-relaxed text-ink/80">
            {product.description}
          </p>
        ) : null}

        {/* Details */}
        <dl className="mt-6 divide-y divide-hairline overflow-hidden rounded-card bg-surface ring-1 ring-hairline/60">
          {product.deliveryNote ? (
            <DetailRow label="Delivery / service" value={product.deliveryNote} />
          ) : null}
          {product.sellerContact ? (
            <DetailRow label="Seller contact" value={product.sellerContact} />
          ) : null}
        </dl>

        <p className="mt-4 text-center text-[12px] text-muted">
          Payment is handled securely through Pi. You will never be asked for a
          wallet passphrase or private key.
        </p>

        <div className="h-4" />
      </main>

      <div className="sticky bottom-0 z-20 mt-auto border-t border-hairline bg-canvas/90 px-5 pt-3 pb-safe backdrop-blur-md">
        <ButtonLink href={`/checkout/${product.id}`} variant="primary">
          Pay with Pi
        </ButtonLink>
      </div>
    </>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="px-4 py-3.5">
      <dt className="text-[12px] font-medium uppercase tracking-wide text-muted">
        {label}
      </dt>
      <dd className="mt-1 whitespace-pre-wrap text-[15px] text-ink">{value}</dd>
    </div>
  );
}

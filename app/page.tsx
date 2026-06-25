"use client";

import { useEffect, useState } from "react";
import { ButtonLink } from "@/components/Button";
import { ProductCard } from "@/components/ProductCard";
import { initPiSDK } from "@/lib/pi";
import { getProducts } from "@/lib/storage";
import type { Product } from "@/lib/types";

export default function HomePage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    initPiSDK();
    setProducts(getProducts());
    setReady(true);
  }, []);

  return (
    <>
      <main className="flex flex-1 flex-col px-5 pt-safe">
        {/* Hero */}
        <section className="pt-10">
          <div className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-2xl bg-pi-600 font-mono text-lg font-bold text-white shadow-cta">
              π
            </span>
            <span className="text-[13px] font-medium uppercase tracking-[0.14em] text-muted">
              Seller Kit
            </span>
          </div>

          <h1 className="mt-6 text-[34px] font-bold leading-[1.05] tracking-tight">
            Pi Seller Kit
          </h1>
          <p className="mt-3 max-w-[30ch] text-[17px] leading-relaxed text-muted">
            Create and sell with Pi in minutes.
          </p>
        </section>

        {/* Recent products */}
        <section className="mt-9 flex-1">
          <div className="mb-3 flex items-baseline justify-between">
            <h2 className="text-[13px] font-semibold uppercase tracking-[0.12em] text-muted">
              Your products
            </h2>
            {ready && products.length > 0 ? (
              <span className="font-mono text-[12px] text-muted tnum">
                {products.length}
              </span>
            ) : null}
          </div>

          {!ready ? (
            <div className="space-y-3">
              <div className="h-[88px] animate-pulse rounded-card bg-hairline/60" />
              <div className="h-[88px] animate-pulse rounded-card bg-hairline/40" />
            </div>
          ) : products.length === 0 ? (
            <p className="rounded-card border border-dashed border-hairline bg-surface/50 px-4 py-8 text-center text-[14px] text-muted">
              No products yet. Create your first one below.
            </p>
          ) : (
            <div className="space-y-3 pb-4">
              {products.map((p) => (
                <ProductCard key={p.id} product={p} />
              ))}
            </div>
          )}
        </section>
      </main>

      {/* Primary actions, thumb-reachable */}
      <div className="sticky bottom-0 z-20 mt-auto bg-canvas/90 px-5 pt-3 pb-safe backdrop-blur-md">
        <div className="flex flex-col gap-3">
          <ButtonLink href="/create" variant="primary">
            Create Product
          </ButtonLink>
          <ButtonLink href="/orders" variant="secondary">
            View Orders
          </ButtonLink>
        </div>
      </div>
    </>
  );
}

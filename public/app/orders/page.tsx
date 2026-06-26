"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { ButtonLink } from "@/components/Button";
import { OrderCard } from "@/components/OrderCard";
import { EmptyState } from "@/components/EmptyState";
import { getOrders } from "@/lib/storage";
import type { Order } from "@/lib/types";

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setOrders(getOrders());
    setReady(true);
  }, []);

  return (
    <>
      <PageHeader title="Orders" back />

      <main className="flex flex-1 flex-col px-5 pt-4">
        {!ready ? (
          <div className="space-y-3">
            <div className="h-[96px] animate-pulse rounded-card bg-hairline/60" />
            <div className="h-[96px] animate-pulse rounded-card bg-hairline/40" />
          </div>
        ) : orders.length === 0 ? (
          <div className="flex flex-1 items-center">
            <EmptyState
              title="No orders yet"
              body="Orders appear here after a buyer pays with Pi on one of your product pages."
              action={<ButtonLink href="/create" variant="secondary">Create a product</ButtonLink>}
            />
          </div>
        ) : (
          <div className="space-y-3 pb-6">
            {orders.map((o) => (
              <OrderCard key={o.orderId} order={o} />
            ))}
          </div>
        )}
      </main>

      <div className="sticky bottom-0 z-20 mt-auto bg-canvas/90 px-5 pt-3 pb-safe backdrop-blur-md">
        <ButtonLink href="/" variant="secondary">
          Back to Home
        </ButtonLink>
      </div>
    </>
  );
}

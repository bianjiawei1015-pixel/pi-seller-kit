"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { ButtonLink } from "@/components/Button";
import { OrderCard } from "@/components/OrderCard";
import { EmptyState } from "@/components/EmptyState";
import { fetchOrders } from "@/lib/client";
import { getPiUser } from "@/lib/storage";
import type { Order, PiSessionUser } from "@/lib/types";

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [user, setUser] = useState<PiSessionUser | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // Read the logged-in Pi user on the client only (localStorage isn't
    // available during SSR). Orders are scoped to this seller's uid — the list
    // is never fetched unscoped.
    const stored = getPiUser();
    setUser(stored);
    setMounted(true);

    if (!stored) {
      setReady(true);
      return;
    }

    let active = true;
    fetchOrders({ sellerUid: stored.uid })
      .then((list) => {
        if (active) setOrders(list);
      })
      .catch((err: unknown) => {
        if (active) setError(err instanceof Error ? err.message : "Failed to load orders.");
      })
      .finally(() => {
        if (active) setReady(true);
      });
    return () => {
      active = false;
    };
  }, []);

  return (
    <>
      <PageHeader title="Orders" back />

      <main className="flex flex-1 flex-col px-5 pt-4">
        {!mounted || !ready ? (
          <div className="space-y-3">
            <div className="h-[96px] animate-pulse rounded-card bg-hairline/60" />
            <div className="h-[96px] animate-pulse rounded-card bg-hairline/40" />
          </div>
        ) : !user ? (
          <div className="flex flex-1 items-center">
            <EmptyState
              title="Log in to view your orders"
              body="Orders are tied to your Pi account. Log in with Pi on the home page to see orders for your products."
              action={<ButtonLink href="/" variant="secondary">Back to Home</ButtonLink>}
            />
          </div>
        ) : error ? (
          <div className="flex flex-1 items-center">
            <EmptyState
              title="Couldn’t load orders"
              body={error}
              action={<ButtonLink href="/" variant="secondary">Back to Home</ButtonLink>}
            />
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

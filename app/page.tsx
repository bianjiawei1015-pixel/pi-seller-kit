"use client";

import { useEffect, useState } from "react";
import { Button, ButtonLink } from "@/components/Button";
import { ProductCard } from "@/components/ProductCard";
import { loginWithPi } from "@/lib/pi";
import {
  getProducts,
  getPiUser,
  savePiUser,
  clearPiUser,
} from "@/lib/storage";
import type { PiSessionUser, Product } from "@/lib/types";

export default function HomePage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [ready, setReady] = useState(false);
  const [piUser, setPiUser] = useState<PiSessionUser | null>(null);
  const [loggingIn, setLoggingIn] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);

  useEffect(() => {
    // Read-only on mount: load products + any saved Pi session. The SDK is NOT
    // touched here, so a normal browser never auto-enters a "Connecting…" state
    // — that only happens after the user taps Login with Pi.
    setProducts(getProducts());
    setPiUser(getPiUser());
    setReady(true);
  }, []);

  async function handleLogin() {
    setLoginError(null);
    setLoggingIn(true);
    try {
      const user = await loginWithPi();
      const session: PiSessionUser = { uid: user.uid, username: user.username };
      savePiUser(session);
      setPiUser(session);
    } catch (err) {
      setLoginError(
        err instanceof Error ? err.message : "Could not log in with Pi.",
      );
    } finally {
      setLoggingIn(false);
    }
  }

  // Mock logout: only clears the locally stored Pi user info.
  function handleLogout() {
    clearPiUser();
    setPiUser(null);
    setLoginError(null);
  }

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

          {/* Pi login */}
          <div className="mt-6">
            {!ready ? (
              <div className="h-14 animate-pulse rounded-pill bg-hairline/60" />
            ) : piUser ? (
              <div className="flex items-center justify-between gap-3 rounded-card bg-surface p-4 shadow-card ring-1 ring-hairline/60">
                <div className="min-w-0">
                  <p className="text-[12px] font-medium uppercase tracking-wide text-muted">
                    Logged in as
                  </p>
                  <p className="truncate font-mono text-[16px] font-semibold tracking-tight text-ink tnum">
                    @{piUser.username}
                  </p>
                </div>
                <button
                  onClick={handleLogout}
                  className="shrink-0 rounded-pill px-4 py-2 text-[14px] font-semibold text-pi-600 transition active:bg-pi-50"
                >
                  Log out
                </button>
              </div>
            ) : (
              <Button onClick={handleLogin} disabled={loggingIn}>
                {loggingIn ? "Connecting to Pi…" : "Login with Pi"}
              </Button>
            )}

            {loginError ? (
              <p className="mt-3 rounded-2xl bg-danger/10 px-4 py-3 text-[14px] text-danger">
                {loginError}
              </p>
            ) : null}
          </div>
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

"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/Button";
import {
  loginWithPi,
  getPiDiagnostics,
  type PiDiagnostics,
} from "@/lib/pi";
import { getPiUser, savePiUser, clearPiUser } from "@/lib/storage";
import type { PiSessionUser } from "@/lib/types";

// The only allowed login states. "connecting" is in-memory only and is NEVER
// persisted to localStorage, so a refresh can never resurrect it.
type LoginStatus = "idle" | "connecting" | "logged_in" | "error";

interface DebugInfo extends PiDiagnostics {
  error: string;
  timestamp: string;
}

export function PiLogin() {
  const [status, setStatus] = useState<LoginStatus>("idle");
  const [piUser, setPiUser] = useState<PiSessionUser | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [debug, setDebug] = useState<DebugInfo | null>(null);
  const [mounted, setMounted] = useState(false);

  // On load: only read localStorage. Never auto-connect.
  useEffect(() => {
    const stored = getPiUser();
    if (stored) {
      setPiUser(stored);
      setStatus("logged_in");
    }
    setMounted(true);
  }, []);

  async function handleLogin() {
    // Guard against double clicks while a login is already in flight.
    if (status === "connecting") return;

    setStatus("connecting");
    setErrorMsg(null);
    setDebug(null);

    try {
      const user = await loginWithPi(); // { username, uid }; always settles
      const session: PiSessionUser = { uid: user.uid, username: user.username };
      savePiUser(session); // persists username + uid only (no accessToken)
      setPiUser(session);
      setStatus("logged_in");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Login failed.";
      // eslint-disable-next-line no-console
      console.error("[pi] login error:", err);
      setErrorMsg(message);
      setDebug({
        ...getPiDiagnostics(),
        error: message,
        timestamp: new Date().toISOString(),
      });
      setStatus("error"); // back to a clickable state, never stuck
    }
  }

  // Clears the stored Pi user and returns the machine to idle.
  function handleReset() {
    clearPiUser();
    setPiUser(null);
    setErrorMsg(null);
    setDebug(null);
    setStatus("idle");
  }

  // Until mounted we don't know if there's a saved session; show a placeholder
  // so the UI never flashes the wrong button (and never auto-connects).
  if (!mounted) {
    return <div className="h-14 animate-pulse rounded-pill bg-hairline/60" />;
  }

  if (status === "logged_in" && piUser) {
    return (
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
          onClick={handleReset}
          className="shrink-0 rounded-pill px-4 py-2 text-[14px] font-semibold text-pi-600 transition active:bg-pi-50"
        >
          Log out
        </button>
      </div>
    );
  }

  return (
    <div>
      <Button onClick={handleLogin} disabled={status === "connecting"}>
        {status === "connecting" ? "Connecting to Pi…" : "Login with Pi"}
      </Button>

      {status === "error" && errorMsg ? (
        <>
          <p className="mt-3 rounded-2xl bg-danger/10 px-4 py-3 text-[14px] text-danger">
            {errorMsg}
          </p>

          {/* Debug panel — only shown on failure. */}
          {debug ? (
            <div className="mt-3 rounded-2xl bg-ink/[0.04] px-4 py-3 font-mono text-[11px] leading-relaxed text-muted">
              <p className="mb-1 font-semibold uppercase tracking-wide text-ink/70">
                Debug
              </p>
              <p>window.Pi detected: {debug.piDetected ? "yes" : "no"}</p>
              <p>SDK script present: {debug.sdkScriptPresent ? "yes" : "no"}</p>
              <p className="break-all">URL: {debug.url}</p>
              <p className="break-all">userAgent: {debug.userAgent}</p>
              <p className="break-all">error: {debug.error}</p>
              <p>timestamp: {debug.timestamp}</p>
            </div>
          ) : null}

          <button
            onClick={handleReset}
            className="mt-3 w-full rounded-pill px-4 py-2 text-[14px] font-semibold text-pi-600 transition active:bg-pi-50"
          >
            Reset Login State
          </button>
        </>
      ) : null}
    </div>
  );
}

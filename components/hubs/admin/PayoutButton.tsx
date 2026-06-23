"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { startHubOnboarding } from "@/lib/hubs-client";

function openPopup(url: string): Window | null {
  const w = 680, h = 720;
  const left = Math.max(0, (window.screen.width  - w) / 2 + window.screenX);
  const top  = Math.max(0, (window.screen.height - h) / 2 + window.screenY);
  return window.open(url, "stripe-connect", `width=${w},height=${h},left=${left},top=${top},scrollbars=yes,resizable=yes`);
}

export function PayoutButton({ hubId, accent, label = "Set up payouts" }: {
  hubId: string; accent: string; label?: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);
  const popupRef = useRef<Window | null>(null);
  const pollRef  = useRef<ReturnType<typeof setInterval> | null>(null);

  // Detect ?connected=1 landing (Stripe return) or ?retry=1 (Stripe refresh)
  useEffect(() => {
    if (searchParams.get("connected") === "1") {
      setConnected(true);
      // Clean the query param without a full reload
      const clean = window.location.pathname;
      window.history.replaceState({}, "", clean);
    }
    if (searchParams.get("retry") === "1") {
      // Stripe says the link expired — re-trigger onboarding automatically
      const clean = window.location.pathname;
      window.history.replaceState({}, "", clean);
      launchOnboarding();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Poll for popup close so we can refresh payout status
  function startPolling(popup: Window) {
    popupRef.current = popup;
    pollRef.current = setInterval(() => {
      if (popup.closed) {
        clearInterval(pollRef.current!);
        router.refresh();
      }
    }, 600);
  }

  async function launchOnboarding() {
    setBusy(true);
    setError(null);
    // Open the popup synchronously while we're still inside the click handler —
    // browsers block window.open called after an await.
    const popup = openPopup("about:blank");
    try {
      const returnUrl = window.location.href.split("?")[0];
      const stripeUrl = await startHubOnboarding(hubId, returnUrl);
      if (popup && !popup.closed) {
        popup.location.href = stripeUrl;
        startPolling(popup);
      } else {
        // Popup was blocked — fall back to redirect
        window.location.href = stripeUrl;
      }
    } catch (e) {
      popup?.close();
      setError(e instanceof Error ? e.message : "Could not start payout setup.");
    } finally {
      setBusy(false);
    }
  }

  if (connected) {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2 rounded-lg bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">
          <span>✓</span>
          <span>Connected with Stripe — your account is being verified. Payout status updates automatically.</span>
        </div>
        <button
          onClick={launchOnboarding}
          disabled={busy}
          className="rounded-pill border border-line-strong px-4 py-2 text-sm font-semibold text-ink hover:bg-sand disabled:opacity-50"
        >
          {busy ? "Opening Stripe…" : "Open Stripe dashboard"}
        </button>
      </div>
    );
  }

  return (
    <div>
      <button
        onClick={launchOnboarding}
        disabled={busy}
        className="rounded-pill px-5 py-3 font-semibold text-paper shadow-soft transition hover:brightness-95 disabled:opacity-50"
        style={{ background: accent }}
      >
        {busy ? "Opening Stripe…" : label}
      </button>
      {error && (
        <p className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700">{error}</p>
      )}
    </div>
  );
}

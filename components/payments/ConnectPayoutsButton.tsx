"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

function openPopup(url: string): Window | null {
  const w = 680, h = 720;
  const left = Math.max(0, (window.screen.width - w) / 2 + window.screenX);
  const top = Math.max(0, (window.screen.height - h) / 2 + window.screenY);
  return window.open(url, "stripe-connect", `width=${w},height=${h},left=${left},top=${top},scrollbars=yes,resizable=yes`);
}

/**
 * Central payout / bank setup. Onboards the user's profile-level Stripe Connect
 * account (profiles.stripe_account_id) — the same account that receives every
 * payout (Fetch driving, etc.). Opens Stripe onboarding in a popup; when it
 * closes we refresh so the webhook-updated status shows.
 */
export function ConnectPayoutsButton({ accent = "#032f4c", connected, pending }: {
  accent?: string; connected: boolean; pending: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  function pollClose(popup: Window) {
    pollRef.current = setInterval(() => {
      if (popup.closed) { clearInterval(pollRef.current!); router.refresh(); }
    }, 700);
  }

  async function connect() {
    setBusy(true); setError(null);
    const popup = openPopup("about:blank");
    try {
      const sb = createClient();
      const { data, error: fnErr } = await sb.functions.invoke("create-connect-account");
      if (fnErr) {
        let msg = "Could not start payout setup.";
        try { const body = await (fnErr as { context?: { json?: () => Promise<{ error?: string }> } }).context?.json?.(); if (body?.error) msg = body.error; } catch { /* */ }
        throw new Error(msg);
      }
      if (data?.already_complete) { popup?.close(); router.refresh(); return; }
      if (!data?.url) throw new Error("No onboarding link was returned.");
      if (popup && !popup.closed) { popup.location.href = data.url as string; pollClose(popup); }
      else window.location.href = data.url as string; // popup blocked → redirect
    } catch (e) {
      popup?.close();
      setError(e instanceof Error ? e.message : "Could not start payout setup.");
    } finally {
      setBusy(false);
    }
  }

  if (connected) {
    return (
      <div className="space-y-2">
        <div className="flex items-center gap-2 rounded-lg bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800"><span>✓</span><span>Bank connected — payouts active. You keep the delivery fee, less a small £1.50 service fee per delivery.</span></div>
        <button onClick={connect} disabled={busy} className="rounded-pill border border-line-strong px-4 py-2 text-sm font-semibold text-ink hover:bg-sand disabled:opacity-50">{busy ? "Opening Stripe…" : "Open Stripe dashboard"}</button>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {pending && <div className="rounded-lg bg-amber-50 px-4 py-3 text-sm font-medium text-amber-900">⏳ Verification in progress — Stripe is reviewing your details. This page updates once it&apos;s confirmed.</div>}
      <button onClick={connect} disabled={busy} className="rounded-pill px-5 py-3 font-semibold text-white shadow-soft transition hover:brightness-95 disabled:opacity-50" style={{ background: accent }}>
        {busy ? "Opening Stripe…" : pending ? "Continue bank setup" : "Connect a bank account"}
      </button>
      {error && <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700">{error}</p>}
    </div>
  );
}

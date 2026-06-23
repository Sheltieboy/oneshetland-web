"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { FETCH } from "@/lib/fetch-data";

/** Stripe Connect onboarding — invokes the same `create-connect-account` edge
 *  function the app uses, then sends the driver to Stripe's hosted onboarding.
 *  Completion is webhook-driven (writes to profiles), so we offer a re-check. */
export function ConnectBankPanel({ alreadyComplete, pending }: { alreadyComplete: boolean; pending: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function connect() {
    setBusy(true); setError(null);
    try {
      const sb = createClient();
      const { data, error: fnErr } = await sb.functions.invoke("create-connect-account");
      if (fnErr) {
        let msg = "Could not start bank setup. Please try again.";
        try { const body = await (fnErr as { context?: { json?: () => Promise<{ error?: string }> } }).context?.json?.(); if (body?.error) msg = body.error; } catch { /* */ }
        throw new Error(msg);
      }
      if (data?.already_complete) { router.refresh(); return; }
      if (!data?.url) throw new Error("No onboarding link was returned.");
      window.location.href = data.url as string;
    } catch (e) { setError(e instanceof Error ? e.message : "Something went wrong."); setBusy(false); }
  }

  async function recheck() {
    setChecking(true);
    // Webhook writes onboarding status server-side; a refresh re-reads it.
    router.refresh();
    setTimeout(() => setChecking(false), 1200);
  }

  if (alreadyComplete) {
    return (
      <div className="rounded-card border border-green-300 bg-green-50 p-5 text-center">
        <div className="text-4xl">✅</div>
        <p className="mt-2 font-display text-xl font-bold text-ink">Bank account connected</p>
        <p className="mx-auto mt-1 max-w-sm text-sm text-ink-soft">You&apos;re set up for payouts. Earnings land in your bank within 2 working days of each delivery — you keep 100% during the community launch.</p>
        <a href="/fetch?tab=driver" className="mt-4 inline-block rounded-pill px-5 py-2.5 text-sm font-semibold text-white" style={{ background: FETCH }}>Back to driver dashboard →</a>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {pending && (
        <div className="rounded-card border border-amber-300 bg-amber-50 p-4">
          <p className="font-bold text-amber-900">⏳ Verification in progress</p>
          <p className="mt-1 text-sm text-amber-900/80">Stripe is reviewing your details — this usually takes a few minutes. You&apos;ll be able to receive payouts once it&apos;s confirmed.</p>
        </div>
      )}

      <div className="rounded-card border border-line bg-paper p-5 shadow-soft">
        <p className="font-bold text-ink">What happens next</p>
        <ul className="mt-2 space-y-1.5 text-sm text-ink-soft">
          <li>🪪 Verify your identity with Stripe (~5 mins)</li>
          <li>🏦 Enter your UK bank account details</li>
          <li>✅ Payouts land within 2 working days of each delivery</li>
        </ul>
        <p className="mt-3 rounded-lg bg-indigo-50 px-3 py-2 text-xs text-indigo-700">🔒 Powered by Stripe — your bank details are never shared with OneShetland. If asked for a business website, choose &quot;Don&apos;t have a website?&quot; and continue.</p>
      </div>

      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      {pending ? (
        <div className="space-y-2">
          <button onClick={recheck} disabled={checking} className="w-full rounded-pill py-3 font-semibold text-white disabled:opacity-40" style={{ background: FETCH }}>{checking ? "Checking…" : "Check verification status"}</button>
          <button onClick={connect} disabled={busy} className="w-full rounded-pill border border-line-strong py-2.5 text-sm font-semibold text-ink hover:bg-sand">Didn&apos;t finish? Re-open Stripe setup →</button>
        </div>
      ) : (
        <button onClick={connect} disabled={busy} className="w-full rounded-pill py-3 font-semibold text-white transition hover:brightness-110 disabled:opacity-40" style={{ background: FETCH }}>{busy ? "Opening Stripe…" : "Connect bank account"}</button>
      )}
      <p className="text-center text-xs text-ink-faint">OneShetland takes no platform fee during the community launch — you receive the full delivery fee for every completed run.</p>
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Elements, PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js";
import { createClient } from "@/lib/supabase/client";
import { getStripe } from "@/lib/stripe";

/**
 * Central payment-card setup. Saves a card to the user's profile-level Stripe
 * customer (profiles.stripe_customer_id) via a SetupIntent — the same central
 * card every section charges (Fetch, event tickets, hub donations…). No charge
 * is taken; the card is stored off-session for future payments.
 */
export function CardSetup({ accent = "#032f4c", hasCard, businessId }: { accent?: string; hasCard: boolean; businessId?: string }) {
  const [open, setOpen] = useState(false);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function begin() {
    setOpen(true); setError(null); setClientSecret(null);
    try {
      const sb = createClient();
      const { data, error: fnErr } = await sb.functions.invoke("create-setup-intent", businessId ? { body: { business_id: businessId } } : undefined);
      if (fnErr || !data?.client_secret) throw new Error(data?.error ?? "Could not start card setup.");
      setClientSecret(data.client_secret as string);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not start card setup.");
    }
  }

  if (!open) {
    return (
      <button onClick={begin} className="rounded-pill px-5 py-2.5 text-sm font-semibold text-white shadow-soft transition hover:brightness-95" style={{ background: accent }}>
        {hasCard ? "Replace card" : "Add a payment card"}
      </button>
    );
  }

  if (error) return <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700">{error} <button onClick={begin} className="underline">Try again</button></p>;
  if (!clientSecret) return <p className="text-sm text-ink-muted">Loading secure card form…</p>;

  return (
    <Elements stripe={getStripe()} options={{ clientSecret, appearance: { theme: "stripe", variables: { colorPrimary: accent, borderRadius: "12px", fontFamily: "inherit" } } }}>
      <CardForm accent={accent} businessId={businessId} onCancel={() => setOpen(false)} />
    </Elements>
  );
}

function CardForm({ accent, businessId, onCancel }: { accent: string; businessId?: string; onCancel: () => void }) {
  const stripe = useStripe();
  const elements = useElements();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!stripe || !elements) return;
    setBusy(true); setError(null);
    const { error: submitErr } = await elements.submit();
    if (submitErr) { setBusy(false); setError(submitErr.message ?? "Please check your card details."); return; }
    const { error: confirmErr, setupIntent } = await stripe.confirmSetup({ elements, redirect: "if_required" });
    if (confirmErr) { setBusy(false); setError(confirmErr.message ?? "Could not save your card."); return; }
    if (setupIntent && setupIntent.status === "succeeded") {
      // Mark the card as on file (webhook also reconciles; we set it directly so
      // the UI updates immediately). Business cards update the business row.
      try {
        const sb = createClient();
        if (businessId) {
          await sb.from("local_businesses").update({ has_business_payment_method: true }).eq("id", businessId);
        } else {
          const { data: { user } } = await sb.auth.getUser();
          if (user) await sb.from("profiles").update({ has_payment_method: true }).eq("id", user.id);
        }
      } catch { /* webhook will reconcile */ }
      router.refresh();
      return; // leave spinner; page re-renders with card on file
    }
    setBusy(false); setError("Card was not saved. Please try again.");
  }

  return (
    <form onSubmit={save} className="space-y-4">
      <PaymentElement options={{ layout: "tabs" }} />
      {error && <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700">{error}</p>}
      <div className="flex items-center gap-3">
        <button type="submit" disabled={!stripe || busy} className="flex-1 rounded-pill px-5 py-3 font-semibold text-white shadow-soft transition hover:brightness-95 disabled:opacity-50" style={{ background: accent }}>
          {busy ? "Saving…" : "Save card"}
        </button>
        <button type="button" onClick={onCancel} disabled={busy} className="rounded-pill border border-line-strong px-5 py-3 font-semibold text-ink transition hover:bg-sand disabled:opacity-50">Cancel</button>
      </div>
      <p className="text-center text-xs text-ink-muted">Your card is stored securely by Stripe and only charged when you make a payment.</p>
    </form>
  );
}

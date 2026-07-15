"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Elements, PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js";
import { createClient } from "@/lib/supabase/client";
import { getStripe } from "@/lib/stripe";
import { useConfirm } from "@/components/ui/ConfirmProvider";

/**
 * Central payment-card setup. Saves a card to the user's profile-level Stripe
 * customer (profiles.stripe_customer_id) via a SetupIntent — the same central
 * card every section charges (Fetch, event tickets, hub donations…). No charge
 * is taken; the card is stored off-session for future payments.
 */
export function CardSetup({ accent = "#032f4c", hasCard, businessId }: { accent?: string; hasCard: boolean; businessId?: string }) {
  const router = useRouter();
  const confirm = useConfirm();
  const [open, setOpen] = useState(false);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [removing, setRemoving] = useState(false);
  const [removeError, setRemoveError] = useState<string | null>(null);

  async function removeCard() {
    if (!(await confirm({ title: "Remove saved card?", body: "You can add one again any time.", confirmLabel: "Remove card", danger: true }))) return;
    setRemoving(true); setRemoveError(null);
    try {
      const sb = createClient();
      // Detaching the card + clearing the locked has_payment_method flag must
      // happen server-side (the lock trigger reverts any client write).
      const { data, error: fnErr } = await sb.functions.invoke("remove-card", businessId ? { body: { business_id: businessId } } : { body: {} });
      if (fnErr || (data as { error?: string } | null)?.error) {
        throw new Error((data as { error?: string } | null)?.error ?? fnErr?.message ?? "Could not remove the card.");
      }
      router.refresh();
    } catch (e) {
      setRemoveError(e instanceof Error ? e.message : "Could not remove the card.");
    } finally {
      setRemoving(false);
    }
  }

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
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-3">
          <button onClick={begin} className="rounded-pill px-5 py-2.5 text-sm font-semibold text-white shadow-soft transition hover:brightness-95" style={{ background: accent }}>
            {hasCard ? "Replace card" : "Add a payment card"}
          </button>
          {hasCard && (
            <button onClick={removeCard} disabled={removing} className="rounded-pill px-5 py-2.5 text-sm font-semibold text-rose-700 transition hover:bg-rose-50 disabled:opacity-50">
              {removing ? "Removing…" : "Remove card"}
            </button>
          )}
        </div>
        {removeError && <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700">{removeError}</p>}
      </div>
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
      // Persist the card-on-file flag via the service-role `confirm-card-setup`
      // function. A direct client write to profiles.has_payment_method is
      // silently REVERTED by the tg_profiles_lock_sensitive trigger (anti-tamper),
      // and stripe-webhook has no setup_intent.succeeded handler — so the flag
      // would never stick. confirm-card-setup checks Stripe and sets it for real.
      try {
        const sb = createClient();
        const { data, error: confErr } = await sb.functions.invoke(
          "confirm-card-setup",
          businessId ? { body: { business_id: businessId } } : undefined,
        );
        if (confErr || !data?.ok) throw new Error(data?.error ?? "Card saved but could not be confirmed.");
      } catch (e) {
        setBusy(false);
        setError(e instanceof Error ? e.message : "Card saved but could not be confirmed. Please try again.");
        return;
      }
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

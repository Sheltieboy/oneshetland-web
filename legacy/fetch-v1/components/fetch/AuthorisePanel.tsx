"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { PaymentCheckout } from "@/components/payments/PaymentCheckout";
import { penceToGBP } from "@/lib/fetch-data";

const FETCH = "#e0722a";

type State = {
  payment_status: string;
  needs_action: boolean;
  authorised?: boolean;
  client_secret?: string | null;
  amount_pence?: number | null;
  reason?: "requires_action" | "requires_payment_method";
  message?: string;
  /** The hold lapsed. Nothing was charged, and it can be replaced. */
  can_reauthorise?: boolean;
};

/**
 * The customer's half of a Fetch authorisation.
 *
 * A driver accepts and the PaymentIntent is created against their connected
 * account — but the driver cannot answer the customer's bank, and cannot type
 * in a card the customer never saved. Both used to end the journey: 3DS was
 * recorded as "authorised" and the driver drove against a hold that did not
 * exist, and a cardless customer produced "No payment method found" shown to
 * the DRIVER, with no way for the customer to put it right.
 *
 * This finishes the intent that already exists. It never starts another one.
 */
export function AuthorisePanel({ requestId }: { requestId: string }) {
  const router = useRouter();
  const [state, setState] = useState<State | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [paying, setPaying] = useState(false);
  const [replacing, setReplacing] = useState(false);

  const check = useCallback(async (refresh = false) => {
    try {
      const sb = createClient();
      const { data, error: e } = await sb.functions.invoke("fetch-authorise", {
        body: { request_id: requestId, ...(refresh ? { refresh: true } : {}) },
      });
      if (e) throw e;
      const s = data as State & { error?: string };
      if (s?.error) throw new Error(s.error);
      setState(s);
      if (s.authorised) router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not check that payment.");
    }
  }, [requestId, router]);

  useEffect(() => { void check(); }, [check]);

  /**
   * Replace a hold that has lapsed.
   *
   * Stripe cannot revive a cancelled PaymentIntent, so this asks the server for
   * a REPLACEMENT — at the same price the customer already agreed, and only
   * once Stripe itself has confirmed the old one is gone. It is a deliberate
   * press, never something a page load or a retry can do: minting a second hold
   * beside a live one is the outcome the whole design exists to prevent.
   */
  async function reauthorise() {
    setReplacing(true); setError(null);
    try {
      const sb = createClient();
      const { data, error: e } = await sb.functions.invoke("fetch-authorise", {
        body: { request_id: requestId, reauthorise: true },
      });
      if (e) throw e;
      const s = data as State & { error?: string };
      if (s?.error) throw new Error(s.error);
      setState(s);
      // A saved card that went through needs no further step; anything that
      // does — 3DS, a new card — comes back with a secret for the SAME new
      // intent and continues down the ordinary Fix 2 path below.
      if (s.authorised) router.refresh();
      else if (s.needs_action && s.client_secret) setPaying(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not re-authorise that payment.");
    } finally {
      setReplacing(false);
    }
  }

  // The hold ran out. Said as a hold, because nothing was ever charged and the
  // customer is not being asked to pay twice.
  if (state && state.payment_status === "expired") {
    const held = state.amount_pence ?? 0;
    return (
      <div className="rounded-card border p-4" style={{ borderColor: FETCH, background: `${FETCH}0c` }}>
        <p className="font-display text-lg font-bold text-ink">Your payment authorisation has expired</p>
        <p className="mt-1 text-sm text-ink-soft">
          Card holds don&apos;t last for ever. Re-authorise {held ? penceToGBP(held) : "your delivery"} so your
          delivery can continue — nothing has been charged, and this is a hold until your item arrives.
        </p>
        <button
          onClick={() => void reauthorise()}
          disabled={replacing}
          className="mt-3 w-full rounded-pill px-5 py-2.5 text-sm font-bold text-paper shadow-soft transition hover:brightness-110 disabled:opacity-40"
          style={{ background: FETCH }}
        >
          {replacing ? "Setting up…" : held ? `Re-authorise ${penceToGBP(held)}` : "Re-authorise"}
        </button>
        {/* Shown here rather than replacing the panel: a failed attempt must
            leave the customer with the button that puts it right. */}
        {error && <p className="mt-2 text-sm font-medium text-rose-700">{error}</p>}
      </div>
    );
  }

  if (error) {
    return <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700">{error}</p>;
  }
  if (!state || state.authorised || !state.needs_action) {
    // Nothing for the customer to do — either it is held, or it is Stripe's
    // turn. `processing` says so rather than pretending to be finished.
    if (state && !state.authorised && state.message) {
      return (
        <div className="rounded-card border border-line bg-sand/60 p-4">
          <p className="text-sm text-ink-soft">{state.message}</p>
        </div>
      );
    }
    return null;
  }

  const amount = state.amount_pence ?? 0;

  if (paying && state.client_secret) {
    return (
      <div className="rounded-card border border-line bg-paper p-4">
        <p className="mb-1 font-display text-lg font-bold text-ink">
          {state.reason === "requires_action" ? "Confirm with your bank" : `Authorise ${penceToGBP(amount)}`}
        </p>
        {/* Said plainly, because it is not a charge. The money is held and only
            taken when the delivery arrives. */}
        <p className="mb-3 text-xs text-ink-muted">
          This is a hold for {penceToGBP(amount)} — nothing is taken until your item is delivered.
        </p>
        <PaymentCheckout
          clientSecret={state.client_secret}
          amountPence={amount}
          accent={FETCH}
          payLabel={`Authorise ${penceToGBP(amount)}`}
          // The browser reports only that it finished. Whether a hold exists is
          // re-read from Stripe by the server; nothing here claims success.
          onPaid={async () => { setPaying(false); await check(true); }}
          onCancel={() => setPaying(false)}
        />
      </div>
    );
  }

  return (
    <div className="rounded-card border p-4" style={{ borderColor: FETCH, background: `${FETCH}0c` }}>
      <p className="font-display text-lg font-bold text-ink">
        {state.reason === "requires_action"
          ? "Driver found — confirm your payment"
          : "Driver found — add a card to authorise"}
      </p>
      <p className="mt-1 text-sm text-ink-soft">{state.message}</p>
      <p className="mt-2 text-sm font-semibold text-ink">
        Hold of {penceToGBP(amount)} · nothing charged until delivery
      </p>
      <button
        onClick={() => setPaying(true)}
        className="mt-3 w-full rounded-pill px-5 py-2.5 text-sm font-bold text-paper shadow-soft transition hover:brightness-110"
        style={{ background: FETCH }}
      >
        {state.reason === "requires_action" ? "Confirm with my bank" : `Add a card · ${penceToGBP(amount)}`}
      </button>
    </div>
  );
}

"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { PaymentCheckout } from "@/components/payments/PaymentCheckout";
import { CardSetup } from "@/components/payments/CardSetup";
import { useConfirm } from "@/components/ui/ConfirmProvider";
import {
  BIZ, TIER_LABELS, TIER_PRICE, PLAN_COMPARISON, TIER_PITCH, PREMIUM_ANNUAL_PRICE, BOOKING_CAP_PENCE,
  tierMeets, tierFor, tierUnlocks, isOnBoost, NFC_TILE_URL_PREFIX,
  type ManagedBusiness,
} from "@/lib/business-data";
import {
  updateBusiness, createBusinessOnboardingLink, createSubscriptionIntent,
  previewSubscriptionChange, applySubscriptionChange, createBoostIntent,
  createBillingPortalLink, requestNfcTile, type BillingPeriod,
} from "@/lib/business-client";
import { HelpTip } from "@/components/help/HelpTip";

export function BillingManager({ business, intentTier, meter }: {
  business: ManagedBusiness;
  intentTier?: "pro" | "premium";
  /** Pro only — bookings billed this month, and whether the cap is reached. */
  meter?: { billed: number; feePence: number; capped: boolean } | null;
}) {
  const router = useRouter();
  const confirm = useConfirm();
  const b = business;
  const tier = b.subscription_tier;
  // Are they on yearly billing? No column records it, and none is needed: a
  // monthly subscription always renews within ~31 days, so a renewal date more
  // than 90 days out can only be an annual plan. An inference, but not a guess.
  const annualSubscriber =
    tier === "premium" &&
    !!b.subscription_until &&
    new Date(b.subscription_until).getTime() - Date.now() > 90 * 86_400_000;
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pay, setPay] = useState<{ clientSecret: string; amountPence: number; label: string } | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  function fail(e: unknown) { setError(e instanceof Error ? e.message : "Something went wrong."); setBusy(null); }

  // Arrived from a paid CTA (e.g. "Choose Premium" → create listing → here):
  // open that tier's checkout straight away so they can pay in one flow, unless
  // they're already on that tier or higher.
  const autoStarted = useRef(false);
  useEffect(() => {
    if (autoStarted.current || !intentTier || tierMeets(tier, intentTier)) return;
    autoStarted.current = true;
    void upgrade(intentTier);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [intentTier]);

  /* Toggles */
  async function toggle(field: "use_business_payment" | "use_business_payout", value: boolean) {
    setBusy(field); setError(null);
    try { await updateBusiness(b.id, { [field]: value } as Partial<ManagedBusiness>); router.refresh(); } catch (e) { fail(e); } finally { setBusy(null); }
  }

  /* Business bank (Stripe Connect) — popup + poll, same as hubs */
  async function connectBank() {
    setBusy("bank"); setError(null);
    const w = 680, h = 720;
    const popup = window.open("about:blank", "stripe-connect", `width=${w},height=${h},left=${(window.screen.width - w) / 2},top=${(window.screen.height - h) / 2},scrollbars=yes`);
    try {
      const { url } = await createBusinessOnboardingLink(b.id);
      if (popup && !popup.closed) { popup.location.href = url; pollRef.current = setInterval(() => { if (popup.closed) { clearInterval(pollRef.current!); router.refresh(); } }, 700); }
      else window.location.href = url;
    } catch (e) { popup?.close(); fail(e); } finally { setBusy(null); }
  }

  /* Upgrade / change plan */
  async function upgrade(target: "pro" | "premium", period: BillingPeriod = "monthly") {
    const annual = target === "premium" && period === "annual";
    const label = `${TIER_LABELS[target]}${annual ? " (yearly)" : ""}`;
    setBusy(annual ? `${target}-annual` : target); setError(null);
    try {
      if (b.stripe_subscription_id && !isOnBoost(b)) {
        // Existing subscriber → prorated change on the saved card. Switching
        // monthly↔yearly on the same tier goes down this path too: the tier is
        // unchanged but the price isn't, so Stripe still prorates it.
        const preview = await previewSubscriptionChange(b.id, target, period);
        if (preview.noChange) { setError(`You're already on ${label}.`); setBusy(null); return; }
        const charge = preview.previewAmountPence;
        const money = charge >= 0
          ? `You'll be charged about £${(charge / 100).toFixed(2)} now (prorated).`
          : `You'll be credited about £${(Math.abs(charge) / 100).toFixed(2)} against your next bill.`;
        if (!(await confirm({ title: `Switch to ${label}?`, body: money, confirmLabel: "Switch plan" }))) { setBusy(null); return; }
        await applySubscriptionChange(b.id, target, period);
        router.refresh();
      } else {
        // New subscription → saved card charged silently, else collect via Elements.
        const intent = await createSubscriptionIntent(b.id, target, period);
        if (intent.activated) { router.refresh(); pollTier(); }
        else if (intent.paymentIntent) setPay({ clientSecret: intent.paymentIntent, amountPence: annual ? 29000 : target === "pro" ? 1200 : 2900, label: `Subscribe to ${label}` });
        else throw new Error("Could not start subscription.");
      }
    } catch (e) { fail(e); } finally { setBusy(null); }
  }

  async function boost(weeks: 1 | 2 | 3) {
    setBusy(`boost${weeks}`); setError(null);
    try {
      const intent = await createBoostIntent(b.id, weeks);
      if (intent.charged) { router.refresh(); pollTier(); }
      else if (intent.paymentIntent) setPay({ clientSecret: intent.paymentIntent, amountPence: intent.amountPence, label: `${weeks} week${weeks > 1 ? "s" : ""} of Pro` });
      else throw new Error("Could not start boost.");
    } catch (e) { fail(e); } finally { setBusy(null); }
  }

  async function manageSubscription() {
    setBusy("portal"); setError(null);
    try { const { url } = await createBillingPortalLink(b.id); window.open(url, "_blank"); } catch (e) { fail(e); } finally { setBusy(null); }
  }

  async function requestNfc() {
    if (b.lat == null || b.lng == null) { setError("Add your address (with a map location) in Profile before requesting an NFC tile."); return; }
    setBusy("nfc"); setError(null);
    try { await requestNfcTile(b.id); router.refresh(); } catch (e) { fail(e); } finally { setBusy(null); }
  }

  function pollTier() {
    let n = 0;
    pollRef.current = setInterval(() => { n++; router.refresh(); if (n >= 6 && pollRef.current) clearInterval(pollRef.current); }, 2500);
  }

  const card = "rounded-card border border-line bg-paper p-5 shadow-soft";
  const btn = "rounded-pill px-5 py-2.5 text-sm font-semibold text-white shadow-soft transition hover:brightness-95 disabled:opacity-50";

  if (pay) {
    return (
      <div className={card}>
        <p className="mb-3 font-display text-lg font-bold text-ink">{pay.label}</p>
        <PaymentCheckout clientSecret={pay.clientSecret} amountPence={pay.amountPence} accent={BIZ}
          onPaid={() => { setPay(null); pollTier(); }} onCancel={() => setPay(null)} />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {error && <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700">{error}</p>}

      {/* Payments & payouts */}
      <section className={card}>
        <h2 className="font-display text-xl font-bold text-ink">Payments &amp; payouts</h2>
        <p className="mt-1 text-sm text-ink-muted">By default this business uses your central OneShetland card and bank. Toggle on to give it its own.</p>

        <ToggleRow label="Payment card" sub={b.use_business_payment ? (b.has_business_payment_method ? "✓ Business card set up" : "Business card — setup needed") : "Using your central OneShetland card"}
          checked={b.use_business_payment} disabled={busy === "use_business_payment"} onChange={(v) => toggle("use_business_payment", v)} />
        {b.use_business_payment && !b.has_business_payment_method && (
          <div className="mt-2"><CardSetup accent={BIZ} hasCard={false} businessId={b.id} /></div>
        )}
        {b.use_business_payment && b.has_business_payment_method && (
          <div className="mt-2"><CardSetup accent={BIZ} hasCard={true} businessId={b.id} /></div>
        )}

        <ToggleRow label="Payout bank account" sub={b.use_business_payout ? (b.payout_enabled ? "✓ Business bank connected" : "Business bank — setup needed") : "Using your central OneShetland bank"}
          checked={b.use_business_payout} disabled={busy === "use_business_payout"} onChange={(v) => toggle("use_business_payout", v)} />
        {b.use_business_payout && !b.payout_enabled && (
          <button onClick={connectBank} disabled={busy === "bank"} className={"mt-2 " + btn} style={{ background: BIZ }}>{busy === "bank" ? "Opening Stripe…" : "Connect business bank account"}</button>
        )}
        {b.use_business_payout && b.payout_enabled && (
          <p className="mt-2 rounded-lg bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-800">✓ Business bank connected — payouts go here.</p>
        )}
      </section>

      {/* Plan */}
      <section className={card}>
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-display text-xl font-bold text-ink">Your plan</h2>
          <span className="rounded-pill px-3 py-1 text-sm font-bold" style={{ background: `${BIZ}1a`, color: BIZ }}>{TIER_LABELS[tier]} · {TIER_PRICE[tier]}</span>
        </div>
        {b.subscription_until && (
          <p className="mt-1 text-sm text-ink-muted">{isOnBoost(b) ? "Boost expires" : b.subscription_cancel_at_period_end ? "Cancels on" : "Renews"} {new Date(b.subscription_until).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}</p>
        )}


        <p className="mt-2 text-sm text-ink-soft">{TIER_PITCH[tier].blurb}</p>

        <ul className="mt-3 space-y-1.5">
          {PLAN_COMPARISON.map((f) => {
            const req = f.tier;
            const ok = tierMeets(tier, req);
            return <li key={f.label} className={"flex items-center gap-2 text-sm " + (ok ? "text-ink" : "text-ink-faint")}>{ok ? "✅" : "🔒"} {f.label}{!ok && <span className="rounded-pill bg-sand px-2 py-0.5 text-[11px] font-semibold text-ink-muted">{TIER_LABELS[req]}</span>}</li>;
          })}
        </ul>

        <div className="mt-4 space-y-2">
          {tier === "free" && (
            <>
              <button onClick={() => upgrade("pro")} disabled={!!busy} className={btn + " w-full"} style={{ background: BIZ }}>{busy === "pro" ? "…" : `Upgrade to Pro · ${TIER_PRICE.pro}`}</button>
              <button onClick={() => upgrade("premium")} disabled={!!busy} className="w-full rounded-pill border border-line-strong px-5 py-2.5 text-sm font-semibold text-ink hover:bg-sand">{busy === "premium" ? "…" : `Or unlock everything with Premium · ${TIER_PRICE.premium}`}</button>
              <button onClick={() => upgrade("premium", "annual")} disabled={!!busy} className="w-full rounded-pill px-5 py-2 text-sm font-semibold text-ink-soft underline-offset-4 hover:text-ink hover:underline">{busy === "premium-annual" ? "…" : `Premium yearly · ${PREMIUM_ANNUAL_PRICE} — two months free, plus an NFC tile`}</button>
              <div className="mt-3 rounded-xl border border-line p-3">
                <p className="text-sm font-semibold text-ink">Or try Pro for a short time</p>
                <p className="text-xs text-ink-muted">One-off payment, no subscription — just unlocked for the duration.</p>
                <div className="mt-2 flex gap-2">
                  {([1, 2, 3] as const).map((w) => <button key={w} onClick={() => boost(w)} disabled={!!busy} className="flex-1 rounded-pill border border-line-strong px-3 py-2 text-sm font-semibold text-ink hover:bg-sand disabled:opacity-50">{busy === `boost${w}` ? "…" : `${w} wk`}</button>)}
                </div>
              </div>
            </>
          )}
          {tier === "pro" && meter && meter.billed > 0 && (
            <div className={"rounded-xl border p-3 text-sm " + (meter.capped ? "border-emerald-300 bg-emerald-50" : "border-line bg-cream/60")}>
              <p className="font-semibold text-ink">
                {meter.billed} booking{meter.billed === 1 ? "" : "s"} this month · £{(meter.feePence / 100).toFixed(2)} in booking fees
              </p>
              {meter.capped ? (
                <p className="mt-1 text-ink-soft">
                  You&apos;ve hit the monthly cap, so every booking from here is free — we don&apos;t let Pro cost more
                  than Premium. At this rate Premium is the cheaper plan and removes the fee entirely.
                </p>
              ) : (
                <p className="mt-1 text-ink-soft">
                  95p a booking, capped at £{(BOOKING_CAP_PENCE / 100).toFixed(2)} a month — Pro will never cost you more than Premium would have.
                </p>
              )}
            </div>
          )}
          {tier === "pro" && (
            <>
              <button onClick={() => upgrade("premium")} disabled={!!busy} className={btn + " w-full"} style={{ background: BIZ }}>{busy === "premium" ? "…" : `Upgrade to Premium · ${TIER_PRICE.premium}`}</button>
              <button onClick={() => upgrade("premium", "annual")} disabled={!!busy} className="w-full rounded-pill border border-line-strong px-5 py-2.5 text-sm font-semibold text-ink hover:bg-sand">{busy === "premium-annual" ? "…" : `Or yearly · ${PREMIUM_ANNUAL_PRICE} — two months free, plus an NFC tile`}</button>
            </>
          )}
          {tier === "premium" && (
            <>
              <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-800">👑 All features unlocked.</p>
              {!annualSubscriber && (
                <button onClick={() => upgrade("premium", "annual")} disabled={!!busy} className="w-full rounded-pill border border-line-strong px-5 py-2.5 text-sm font-semibold text-ink hover:bg-sand">
                  {busy === "premium-annual" ? "…" : `Switch to yearly · ${PREMIUM_ANNUAL_PRICE} — two months free, plus an NFC tile`}
                </button>
              )}
              {annualSubscriber && <p className="text-xs text-ink-muted">You&apos;re on yearly billing — two months free, and your NFC tile is included.</p>}
            </>
          )}
        </div>

        {b.subscription_cancel_at_period_end && <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">Cancels at period end — you keep access until then.</p>}
        {tierMeets(tier, "pro") && (
          <button onClick={manageSubscription} disabled={busy === "portal"} className="mt-3 w-full rounded-pill border border-line-strong px-5 py-2.5 text-sm font-semibold text-ink hover:bg-sand">{busy === "portal" ? "Opening…" : "Manage subscription · cancel · billing"}</button>
        )}
      </section>

      {/* NFC — gated on the feature, not on "has any paid plan". */}
      {tierUnlocks(tier, "nfc") && (
        <section className={card}>
          <h2 className="flex items-center gap-2.5 font-display text-xl font-bold text-ink">
            NFC tap-to-stamp tile
            <HelpTip topic="nfc-tile" />
          </h2>
          <p className="mt-1 text-sm text-ink-muted">
            {b.nfc_status === "active" ? "✓ Active — customers can tap to collect a stamp."
              : b.nfc_status === "dispatched" ? "Posted — stick it on the counter and tap it once with the app to activate."
              : b.nfc_status === "requested" ? "Requested · we'll ship within 3 working days."
              : "A branded tap-to-stamp tile, included with your subscription."}
          </p>
          {b.nfc_token && <p className="mt-2 break-all rounded-lg bg-sand/60 px-3 py-2 text-xs text-ink-soft">{NFC_TILE_URL_PREFIX}{b.nfc_token}</p>}
          {b.nfc_status === "none" && <button onClick={requestNfc} disabled={busy === "nfc"} className={"mt-3 " + btn} style={{ background: BIZ }}>{busy === "nfc" ? "…" : "Request my NFC tile"}</button>}
        </section>
      )}
    </div>
  );
}

function ToggleRow({ label, sub, checked, disabled, onChange }: { label: string; sub: string; checked: boolean; disabled?: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="mt-3 flex items-center justify-between gap-3 border-t border-line pt-3">
      <div className="min-w-0">
        <p className="text-sm font-semibold text-ink">{label}</p>
        <p className="text-xs text-ink-muted">{sub}</p>
      </div>
      <button type="button" onClick={() => onChange(!checked)} disabled={disabled} className="relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition disabled:opacity-50" style={{ background: checked ? BIZ : "var(--color-line-strong)" }}>
        <span className={"inline-block h-5 w-5 transform rounded-full bg-white shadow transition " + (checked ? "translate-x-5" : "translate-x-0.5")} />
      </button>
    </div>
  );
}

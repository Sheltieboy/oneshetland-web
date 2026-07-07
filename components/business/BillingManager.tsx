"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { PaymentCheckout } from "@/components/payments/PaymentCheckout";
import { CardSetup } from "@/components/payments/CardSetup";
import {
  BIZ, TIER_LABELS, TIER_PRICE, PLAN_FEATURES, ADDON_META, PREMIUM_ADDON_KEYS, EXTRA_ADDON_MONTHLY_PENCE,
  tierMeets, isOnBoost, NFC_TILE_URL_PREFIX,
  type ManagedBusiness, type BusinessAddon,
} from "@/lib/business-data";
import {
  updateBusiness, createBusinessOnboardingLink, createSubscriptionIntent,
  previewSubscriptionChange, applySubscriptionChange, createBoostIntent,
  createBillingPortalLink, requestNfcTile,
} from "@/lib/business-client";

export function BillingManager({ business, addons = [] }: { business: ManagedBusiness; addons?: BusinessAddon[] }) {
  const router = useRouter();
  const b = business;
  const tier = b.subscription_tier;
  // Enabled premium add-ons → the first is included, each extra is £10/mo.
  const enabledPremium = addons.filter((a) => a.enabled && PREMIUM_ADDON_KEYS.includes(a.addon_key));
  const extraAddons = enabledPremium.slice(1); // billable extras (beyond the included one)
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pay, setPay] = useState<{ clientSecret: string; amountPence: number; label: string } | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  function fail(e: unknown) { setError(e instanceof Error ? e.message : "Something went wrong."); setBusy(null); }

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
  async function upgrade(target: "pro" | "premium") {
    setBusy(target); setError(null);
    try {
      if (b.stripe_subscription_id && !isOnBoost(b)) {
        // Existing subscriber → prorated change on the saved card.
        const preview = await previewSubscriptionChange(b.id, target);
        if (!preview.noChange && !confirm(`Switch to ${TIER_LABELS[target]}? You'll be charged about £${(preview.previewAmountPence / 100).toFixed(2)} now (prorated).`)) { setBusy(null); return; }
        await applySubscriptionChange(b.id, target);
        router.refresh();
      } else {
        // New subscription → saved card charged silently, else collect via Elements.
        const intent = await createSubscriptionIntent(b.id, target);
        if (intent.activated) { router.refresh(); pollTier(); }
        else if (intent.paymentIntent) setPay({ clientSecret: intent.paymentIntent, amountPence: target === "pro" ? 1999 : 4999, label: `Subscribe to ${TIER_LABELS[target]}` });
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

        {/* Monthly breakdown — base + each extra premium add-on */}
        {tier === "premium" && (
          <div className="mt-3 rounded-xl border border-line bg-cream/60 p-3 text-sm">
            <div className="flex justify-between"><span className="text-ink-soft">Premium plan</span><span className="font-semibold text-ink">£49.99</span></div>
            {extraAddons.map((a) => (
              <div key={a.addon_key} className="flex justify-between"><span className="text-ink-soft">+ Add-on: {ADDON_META[a.addon_key].label}</span><span className="font-semibold text-ink">£{(EXTRA_ADDON_MONTHLY_PENCE / 100).toFixed(2)}</span></div>
            ))}
            <div className="mt-1 flex justify-between border-t border-line pt-1.5"><span className="font-bold text-ink">Total</span><span className="font-extrabold text-ink">£{((4999 + extraAddons.length * EXTRA_ADDON_MONTHLY_PENCE) / 100).toFixed(2)}/mo</span></div>
            {extraAddons.length === 0 && <p className="mt-1 text-xs text-ink-muted">Includes one premium add-on. Each additional add-on is £{(EXTRA_ADDON_MONTHLY_PENCE / 100).toFixed(0)}/mo.</p>}
          </div>
        )}

        <ul className="mt-3 space-y-1.5">
          {PLAN_FEATURES.map((f) => {
            const ok = tierMeets(tier, f.req);
            return <li key={f.label} className={"flex items-center gap-2 text-sm " + (ok ? "text-ink" : "text-ink-faint")}>{ok ? "✅" : "🔒"} {f.label}{!ok && <span className="rounded-pill bg-sand px-2 py-0.5 text-[11px] font-semibold text-ink-muted">{TIER_LABELS[f.req]}</span>}</li>;
          })}
        </ul>

        <div className="mt-4 space-y-2">
          {tier === "free" && (
            <>
              <button onClick={() => upgrade("pro")} disabled={!!busy} className={btn + " w-full"} style={{ background: BIZ }}>{busy === "pro" ? "…" : `Upgrade to Pro · ${TIER_PRICE.pro}`}</button>
              <button onClick={() => upgrade("premium")} disabled={!!busy} className="w-full rounded-pill border border-line-strong px-5 py-2.5 text-sm font-semibold text-ink hover:bg-sand">{busy === "premium" ? "…" : `Or unlock everything with Premium · ${TIER_PRICE.premium}`}</button>
              <div className="mt-3 rounded-xl border border-line p-3">
                <p className="text-sm font-semibold text-ink">Or try Pro for a short time</p>
                <p className="text-xs text-ink-muted">One-off payment, no subscription — just unlocked for the duration.</p>
                <div className="mt-2 flex gap-2">
                  {([1, 2, 3] as const).map((w) => <button key={w} onClick={() => boost(w)} disabled={!!busy} className="flex-1 rounded-pill border border-line-strong px-3 py-2 text-sm font-semibold text-ink hover:bg-sand disabled:opacity-50">{busy === `boost${w}` ? "…" : `${w} wk`}</button>)}
                </div>
              </div>
            </>
          )}
          {tier === "pro" && <button onClick={() => upgrade("premium")} disabled={!!busy} className={btn + " w-full"} style={{ background: BIZ }}>{busy === "premium" ? "…" : `Upgrade to Premium · ${TIER_PRICE.premium}`}</button>}
          {tier === "premium" && <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-800">👑 All features unlocked.</p>}
        </div>

        {b.subscription_cancel_at_period_end && <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">Cancels at period end — you keep access until then.</p>}
        {tierMeets(tier, "pro") && (
          <button onClick={manageSubscription} disabled={busy === "portal"} className="mt-3 w-full rounded-pill border border-line-strong px-5 py-2.5 text-sm font-semibold text-ink hover:bg-sand">{busy === "portal" ? "Opening…" : "Manage subscription · cancel · billing"}</button>
        )}
      </section>

      {/* NFC */}
      {tierMeets(tier, "pro") && (
        <section className={card}>
          <h2 className="font-display text-xl font-bold text-ink">NFC tap-to-stamp tile</h2>
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

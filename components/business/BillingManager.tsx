"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { PaymentCheckout } from "@/components/payments/PaymentCheckout";
import { CardSetup } from "@/components/payments/CardSetup";
import { useConfirm } from "@/components/ui/ConfirmProvider";
import {
  BIZ, TIER_LABELS, TIER_PRICE, PLAN_COMPARISON, TIER_PITCH, PREMIUM_ANNUAL_PRICE, PREMIUM_ANNUAL_PENCE, TIER_PRICE_PENCE, BOOKING_CAP_PENCE, BOOKING_CAP_UNITS,
  tierMeets, tierFor, tierUnlocks, isOnBoost, NFC_TILE_URL_PREFIX,
  type ManagedBusiness, type SubscriptionTier,
} from "@/lib/business-data";
import {
  updateBusiness, createBusinessOnboardingLink, createSubscriptionIntent,
  previewSubscriptionChange, applySubscriptionChange, createBoostIntent, previewBoost,
  getBoostHistory, type BoostOption, type BoostPreview, type BoostPurchase,
  createBillingPortalLink, requestNfcTile, setSubscriptionCancellation, type BillingPeriod,
} from "@/lib/business-client";
import { gbp } from "@/lib/stripe";
import { HelpTip } from "@/components/help/HelpTip";
import { InvoiceHistory } from "@/components/business/InvoiceHistory";
import { newCheckoutAttemptId } from "@/lib/checkout-attempt";
import { BoostCheckout } from "@/components/business/BoostCheckout";

export function BillingManager({ business, intentTier, meter }: {
  business: ManagedBusiness;
  intentTier?: "pro" | "premium";
  /** Pro only — bookings taken this month and what they cost. */
  meter?: { booked: number; billed: number; feePence: number; capped: boolean } | null;
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
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pay, setPay] = useState<{ clientSecret: string; amountPence: number; label: string } | null>(null);
  // Boost prices come from the server: admin_config is admin-only, so this
  // screen cannot read them and must not hardcode them.
  const [boostPreview, setBoostPreview] = useState<BoostPreview | null>(null);
  const [boostOption, setBoostOption] = useState<BoostOption | null>(null);
  // What they have actually paid for. Read from the purchase rows, never
  // inferred from the current expiry — that only shows the last one.
  const [boostHistory, setBoostHistory] = useState<BoostPurchase[]>([]);
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

  /* Cancel, or take a cancellation back */
  async function setCancellation(cancel: boolean) {
    const endsOn = b.subscription_until
      ? new Date(b.subscription_until).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })
      : "the end of your paid period";
    if (cancel) {
      const ok = await confirm({
        title: `Cancel ${TIER_LABELS[tier]}?`,
        body: (
          <div className="space-y-2 text-sm">
            <p className="text-ink">
              You&apos;ll keep everything until <strong>{endsOn}</strong> — you&apos;ve paid for it. Nothing is
              charged after that.
            </p>
            <p className="text-ink-soft">
              Your listing, photos, opening hours, jobs and event tickets are all free and stay exactly as they are.
              You can change your mind any time before then.
            </p>
          </div>
        ),
        confirmLabel: "Cancel my plan",
        cancelLabel: "Keep it",
        danger: true,
      });
      if (!ok) return;
    }
    setBusy("cancel"); setError(null);
    try { await setSubscriptionCancellation(b.id, cancel); router.refresh(); }
    catch (e) { fail(e); } finally { setBusy(null); }
  }

  /**
   * One reference per deliberate plan choice, held across renders.
   *
   * Deliberately NOT useAttemptId: that resets through an effect, which runs
   * AFTER the click has already minted and used an id, so the retry would mint
   * a fresh one and create a second subscription — the exact thing this fix
   * exists to prevent. Keyed synchronously instead: same tier and period means
   * the same purchase and therefore the same reference; choosing a different
   * plan is a different purchase and gets a new one.
   */
  const subAttempt = useRef<{ key: string; id: string } | null>(null);
  function subAttemptId(target: string, period: string): string {
    const key = `${target}:${period}`;
    if (!subAttempt.current || subAttempt.current.key !== key) {
      subAttempt.current = { key, id: newCheckoutAttemptId() };
    }
    return subAttempt.current.id;
  }

  /* Upgrade / change plan */
  async function upgrade(target: "pro" | "premium", period: BillingPeriod = "monthly") {
    const annual = target === "premium" && period === "annual";
    const label = `${TIER_LABELS[target]}${annual ? " (yearly)" : ""}`;
    setBusy(annual ? `${target}-annual` : target); setError(null);
    try {
      // A business on FREE has no live subscription to change, whatever id the
      // row still carries. Trusting a stale id sent it down the "change plan"
      // path, which found the cancelled subscription still on the Pro price and
      // answered "you're already on Pro" — leaving it unable to buy anything.
      const hasLiveSubscription = b.subscription_connected && tier !== "free" && !isOnBoost(b);
      if (hasLiveSubscription) {
        // Existing subscriber → prorated change on the saved card. Switching
        // monthly↔yearly on the same tier goes down this path too: the tier is
        // unchanged but the price isn't, so Stripe still prorates it.
        const preview = await previewSubscriptionChange(b.id, target, period);
        if (preview.noChange) { setError(`You're already on ${label}.`); setBusy(null); return; }
        // Itemise it — and get the timing right. Plan changes use
        // create_prorations, so NOTHING is charged on the day: the adjustment
        // lands on the next invoice. The first version of this said "to pay
        // today", which was simply untrue and the sort of thing somebody checks
        // their bank for.
        const charge = preview.previewAmountPence;
        const fullPrice = annual ? PREMIUM_ANNUAL_PRICE : TIER_PRICE[target];
        const renews = preview.nextRenewalAt
          ? new Date(preview.nextRenewalAt).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })
          : null;
        const money = (
          <div className="space-y-2">
            <dl className="space-y-1 text-sm tabular-nums">
              <div className="flex items-baseline justify-between gap-4">
                <dt className="text-ink-soft">Ongoing price</dt>
                <dd className="font-bold text-ink">{fullPrice}</dd>
              </div>
              <div className="flex items-baseline justify-between gap-4">
                <dt className="text-ink-soft">{charge >= 0 ? "Added to your next bill" : "Credited on your next bill"}</dt>
                <dd className="font-bold text-ink">£{(Math.abs(charge) / 100).toFixed(2)}</dd>
              </div>
            </dl>
            <p className="text-xs text-ink-muted">
              Nothing is charged today.{" "}
              {charge >= 0
                ? `That adjustment covers the days left on your old plan versus the new one.`
                : `You've paid ahead on your old plan, so that comes off what you owe next.`}
              {renews ? ` Your next bill is ${renews}.` : ""}
            </p>
          </div>
        );
        if (!(await confirm({ title: `Switch to ${label}?`, body: money, confirmLabel: "Switch plan" }))) { setBusy(null); return; }
        await applySubscriptionChange(b.id, target, period);
        // The tier lands via the webhook, not this call — wait for it.
        pollTier(target);
      } else {
        // New subscription → saved card charged silently, else collect via Elements.
        // The SAME reference for every retry of this attempt. Without it a
        // second click created a second recurring subscription and a second
        // first charge.
        const intent = await createSubscriptionIntent(b.id, target, period, subAttemptId(target, period));
        if (intent.activated) { router.refresh(); pollTier(); }
        else if (intent.paymentIntent) setPay({ clientSecret: intent.paymentIntent, amountPence: annual ? PREMIUM_ANNUAL_PENCE : TIER_PRICE_PENCE[target], label: `Subscribe to ${label}` });
        else throw new Error("Could not start subscription.");
      }
    } catch (e) { fail(e); } finally { setBusy(null); }
  }

  // Opening the checkout charges nothing. Only its Pay button does, and it
  // carries the price the server quoted.
  useEffect(() => {
    let live = true;
    previewBoost(b.id).then((p) => { if (live) setBoostPreview(p); }).catch(() => {});
    getBoostHistory(b.id).then((h) => { if (live) setBoostHistory(h); }).catch(() => {});
    return () => { live = false; };
  }, [b.id]);

  function openBoost(option: BoostOption) {
    setError(null);
    setBoostOption(option);
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

  /**
   * Wait for the webhook to catch up, then refresh.
   *
   * Changing plan returns as soon as Stripe accepts it, but the tier in our
   * database is written by the webhook a moment later — so refreshing straight
   * away showed the OLD plan and left people reloading by hand to see what they
   * had just done.
   *
   * This watches the row and refreshes the instant it changes, rather than
   * blind-refreshing on a timer. Gives up after ~20s and refreshes anyway, since
   * a webhook that slow is a problem the spinner can't fix.
   */
  function pollTier(expected?: SubscriptionTier) {
    let n = 0;
    const stop = () => { if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; } setSyncing(false); };
    setSyncing(true);
    pollRef.current = setInterval(async () => {
      n++;
      if (expected) {
        try {
          const sb = createClient();
          const { data } = await sb.from("local_businesses").select("subscription_tier").eq("id", b.id).maybeSingle();
          if (data?.subscription_tier === expected) { router.refresh(); stop(); return; }
        } catch { /* fall through to the timer */ }
      } else {
        router.refresh();
      }
      if (n >= 10) { router.refresh(); stop(); }
    }, 2000);
  }

  const card = "rounded-card border border-line bg-paper p-5 shadow-soft";
  const fmtDay = (iso: string) =>
    new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
  const btn = "rounded-pill px-5 py-2.5 text-sm font-semibold text-white shadow-soft transition hover:brightness-95 disabled:opacity-50";

  if (boostOption) {
    return (
      <BoostCheckout
        business={b}
        option={boostOption}
        hasSavedCard={boostPreview?.hasSavedCard ?? false}
        currentUntil={boostPreview?.currentUntil ?? null}
        onClose={() => setBoostOption(null)}
        onPaid={() => { setBoostOption(null); pollTier(); }}
      />
    );
  }

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
          {/* Whether a boost may be sold is the SERVER's answer, not this
              screen's guess. It used to sit inside `tier === "free"`, which hid
              it from a business already on a boost — the one case the webhook's
              stacking arithmetic exists for — while the backend would happily
              have sold a Premium business a downgrade. One rule now, decided in
              local-boost-checkout and reported by its preview. */}
          {boostPreview?.boost_eligible && (
            <div className="mt-3 rounded-xl border border-line p-3">
              <p className="text-sm font-semibold text-ink">Or try Pro for a short time</p>
              <p className="text-xs text-ink-muted">One-off payment, no subscription — just unlocked for the duration.</p>
              {/* Priced, because a control that takes money has to say how
                  much. These read "1 wk / 2 wk / 3 wk" and charged on the
                  press, with the amount shown nowhere at all. */}
              <div className="mt-2 flex gap-2">
                {boostPreview?.options.length
                  ? boostPreview.options.map((o) => (
                      <button
                        key={o.weeks}
                        onClick={() => openBoost(o)}
                        disabled={!!busy}
                        className="flex-1 rounded-pill border border-line-strong px-3 py-2 text-sm font-semibold text-ink hover:bg-sand disabled:opacity-50"
                      >
                        {o.weeks} week{o.weeks > 1 ? "s" : ""} · {gbp(o.amountPence)}
                      </button>
                    ))
                  : <p className="text-xs text-ink-muted">Loading boost prices…</p>}
              </div>
            </div>
          )}

          {tier === "free" && (
            <>
              <button onClick={() => upgrade("pro")} disabled={!!busy} className={btn + " w-full"} style={{ background: BIZ }}>{busy === "pro" ? "…" : `Upgrade to Pro · ${TIER_PRICE.pro}`}</button>
              <button onClick={() => upgrade("premium")} disabled={!!busy} className="w-full rounded-pill border border-line-strong px-5 py-2.5 text-sm font-semibold text-ink hover:bg-sand">{busy === "premium" ? "…" : `Or unlock everything with Premium · ${TIER_PRICE.premium}`}</button>
              <button onClick={() => upgrade("premium", "annual")} disabled={!!busy} className="w-full rounded-pill px-5 py-2 text-sm font-semibold text-ink-soft underline-offset-4 hover:text-ink hover:underline">{busy === "premium-annual" ? "…" : `Premium yearly · ${PREMIUM_ANNUAL_PRICE} — two months free, plus an NFC tile`}</button>

            </>
          )}
          {/* This month's bill, as a statement rather than a sentence. A business
              looking at a screen about money wants the arithmetic laid out and a
              total, not a paragraph it has to parse. */}
          {tier === "pro" && meter && meter.booked > 0 && (
            <div className="rounded-xl border border-line bg-cream/60 p-4">
              <p className="mb-2 text-xs font-bold uppercase tracking-widest text-ink-muted">This month so far</p>
              <dl className="space-y-1 text-sm tabular-nums">
                <div className="flex items-baseline justify-between gap-4">
                  <dt className="text-ink-soft">Pro plan</dt>
                  <dd className="font-semibold text-ink">£{(TIER_PRICE_PENCE.pro / 100).toFixed(2)}</dd>
                </div>
                <div className="flex items-baseline justify-between gap-4">
                  <dt className="text-ink-soft">
                    {meter.booked} booking{meter.booked === 1 ? "" : "s"} × 95p
                    {meter.capped && <span className="ml-1.5 rounded-pill bg-emerald-100 px-1.5 py-0.5 text-[10px] font-bold uppercase text-emerald-800">capped</span>}
                  </dt>
                  <dd className="font-semibold text-ink">£{(meter.feePence / 100).toFixed(2)}</dd>
                </div>
                <div className="mt-1 flex items-baseline justify-between gap-4 border-t border-line pt-2">
                  <dt className="font-bold text-ink">Total this month</dt>
                  <dd className="font-extrabold text-ink">£{((TIER_PRICE_PENCE.pro + meter.feePence) / 100).toFixed(2)}</dd>
                </div>
              </dl>
              <p className="mt-2.5 border-t border-line pt-2 text-xs leading-relaxed text-ink-muted">
                {meter.capped
                  ? `Every booking past ${BOOKING_CAP_UNITS} this month is free — Pro never costs more than Premium's ${TIER_PRICE.premium}. At this rate Premium is cheaper and drops the fee entirely.`
                  : `Booking fees stop at £${(BOOKING_CAP_PENCE / 100).toFixed(2)} a month, so Pro never costs more than Premium's ${TIER_PRICE.premium}.`}
                {meter.billed < meter.booked && ` ${meter.booked - meter.billed} booking${meter.booked - meter.billed === 1 ? "" : "s"} not yet on an invoice.`}
              </p>
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
              {annualSubscriber && (
                <>
                  <p className="text-xs text-ink-muted">You&apos;re on yearly billing — two months free, and your NFC tile is included.</p>
                  <button onClick={() => upgrade("premium", "monthly")} disabled={!!busy} className="w-full rounded-pill border border-line-strong px-5 py-2.5 text-sm font-semibold text-ink hover:bg-sand">
                    {busy === "premium" ? "…" : `Switch to monthly · ${TIER_PRICE.premium}`}
                  </button>
                </>
              )}
              {/* Moving DOWN was only possible by cancelling, which loses the
                  renewal date and the card on file. Stepping back a tier is a
                  normal thing to want and shouldn't cost you your subscription. */}
              <button onClick={() => upgrade("pro")} disabled={!!busy} className="w-full rounded-pill px-5 py-2 text-sm font-semibold text-ink-soft underline-offset-4 transition hover:text-ink hover:underline disabled:opacity-50">
                {busy === "pro" ? "…" : `Move down to Pro · ${TIER_PRICE.pro}`}
              </button>
              <p className="text-center text-xs text-ink-muted">
                On Pro you keep the counter tools and bookings, at 95p a booking capped at £{(BOOKING_CAP_PENCE / 100).toFixed(2)} a month.
                You&apos;d lose products, passes and the featured spot.
              </p>
            </>
          )}
        </div>

        {syncing && (
          <p className="mt-3 rounded-lg bg-sand px-3 py-2 text-sm text-ink-soft">
            Updating your plan… this takes a couple of seconds.
          </p>
        )}

        {b.subscription_cancel_at_period_end && (
          <div className="mt-3 rounded-lg bg-amber-50 px-3 py-2.5 text-sm text-amber-900">
            <p className="font-semibold">
              Ending{b.subscription_until ? ` on ${new Date(b.subscription_until).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}` : ""}
            </p>
            <p className="mt-0.5">You keep {TIER_LABELS[tier]} until then, and won&apos;t be charged again.</p>
            <button onClick={() => setCancellation(false)} disabled={busy === "cancel"} className="mt-2 rounded-pill bg-amber-900 px-4 py-1.5 text-xs font-bold text-white disabled:opacity-50">
              {busy === "cancel" ? "…" : "Keep my plan"}
            </button>
          </div>
        )}

        {tierMeets(tier, "pro") && (
          <div className="mt-3 space-y-2">
            {!b.subscription_cancel_at_period_end && !isOnBoost(b) && (
              <button onClick={() => setCancellation(true)} disabled={busy === "cancel"} className="w-full rounded-pill border border-line-strong px-5 py-2.5 text-sm font-semibold text-ink-soft transition hover:bg-sand hover:text-ink disabled:opacity-50">
                {busy === "cancel" ? "…" : "Cancel my plan"}
              </button>
            )}
            {/* Stripe's portal still holds invoices and card management. Named for
                what it's actually for now that cancelling lives here. */}
            <button onClick={manageSubscription} disabled={busy === "portal"} className="w-full rounded-pill px-5 py-2 text-sm font-semibold text-ink-muted underline-offset-4 hover:text-ink hover:underline">
              {busy === "portal" ? "Opening…" : "Manage payment methods"}
            </button>
          </div>
        )}
      </section>

      {/* Invoices — only meaningful once there is a Stripe customer behind them. */}
      {/* What they paid for a boost, kept as its own fact. A boost leaves no
          Stripe invoice — it is a one-off PaymentIntent — so it would never
          appear in InvoiceHistory below, and before this the payment simply
          vanished once it had been fulfilled. */}
      {boostHistory.length > 0 && (
        <div className={card}>
          <h3 className="font-display text-lg font-bold text-ink">Boost history</h3>
          <ul className="mt-3 space-y-2">
            {boostHistory.map((p) => {
              const refunded = p.refund_state === "full";
              const part = p.refund_state === "partial";
              const active = !refunded && !!p.expires_at && new Date(p.expires_at) > new Date();
              // A fully refunded boost is not "Expired" — it stopped counting
              // because the money went back, which is a different fact and the
              // one the business is owed an explanation for.
              const pill = refunded
                ? { label: "Refunded", cls: "bg-purple-50 text-purple-700" }
                : part
                  ? { label: "Partly refunded", cls: "bg-amber-50 text-amber-700" }
                  : active
                    ? { label: "Active", cls: "bg-emerald-50 text-emerald-700" }
                    : { label: "Expired", cls: "bg-sand text-ink-muted" };
              return (
                <li key={p.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line p-3">
                  <div className="min-w-0">
                    <p className="font-semibold text-ink">
                      {p.weeks} week{p.weeks > 1 ? "s" : ""} of Pro
                    </p>
                    <p className="text-xs text-ink-muted">
                      {fmtDay(p.created_at)} · {gbp(p.amount_pence)} · Paid by card
                    </p>
                    {refunded && <p className="text-xs font-semibold text-purple-700">Refunded in full</p>}
                    {/* Naming both figures makes it clear the time was kept. */}
                    {part && (
                      <p className="text-xs font-semibold text-amber-700">
                        {gbp(p.refunded_pence)} of {gbp(p.amount_pence)} refunded
                      </p>
                    )}
                    {p.expires_at && !refunded && (
                      <p className="text-xs text-ink-muted">Pro until {fmtDay(p.expires_at)}</p>
                    )}
                  </div>
                  {/* Each purchase judges itself by its OWN expiry. Reading the
                      business's current tier would mark an old, spent boost
                      "Active" whenever a newer one is running. */}
                  <span className={"rounded-pill px-3 py-1 text-xs font-bold " + pill.cls}>
                    {pill.label}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {(tierMeets(tier, "pro") || b.subscription_connected) && <InvoiceHistory businessId={b.id} />}

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

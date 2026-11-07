"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { reservePlace, releasePlace, setShowcase } from "@/lib/launch50-actions";
import {
  LAUNCH50_NAME, LAUNCH50_RESERVATION_MINUTES, LAUNCH50_DISCOUNT_MONTHS, LAUNCH50_LOCKED_NOTE, LAUNCH50_STATEMENT,
  launch50Price, standardPrice, launch50CardState, fmtLaunchDate, reservationLive,
  type Launch50Phase, type Launch50Place, type Launch50Tier,
} from "@/lib/launch50-core";

const TIERS: Launch50Tier[] = ["pro", "premium"];

/** The Launch 50 section of the billing page. Subscribing is NOT done here: it hands back to the page's one checkout code path. */
export function Launch50Card({ businessId, phase, tier, subscriptionConnected, hasLaunchGrant, place: placeProp, busy, message, onSubscribe }: {
  businessId: string;
  phase: Launch50Phase;
  tier: string;
  subscriptionConnected: boolean;
  hasLaunchGrant?: boolean;
  place: Launch50Place | null;
  /** Checkout in progress (owned by the billing page). */
  busy: boolean;
  /** A Launch 50 refusal from the checkout, shown here with the standard-price alternative. */
  message?: string | null;
  onSubscribe: (tier: Launch50Tier) => void;
}) {
  const router = useRouter();
  const [place, setPlace] = useState<Launch50Place | null>(placeProp);
  // Follow the server's copy whenever a refresh brings a new one (adjusted during render, not in an effect).
  const [seenProp, setSeenProp] = useState(placeProp);
  if (placeProp !== seenProp) { setSeenProp(placeProp); setPlace(placeProp); }
  const [choice, setChoice] = useState<Launch50Tier>("pro");
  const [showcase, setShowcaseTick] = useState(false);
  const [working, setWorking] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  // The clock only starts after mount (from a timer callback), so the server and the first client render agree.
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    const tick = () => {
      const t = Date.now();
      setNow(t);
      // A held place that has just run out: drop it and ask the server what is true now.
      if (place?.status === "reserved" && !reservationLive(place, t)) { setPlace(null); router.refresh(); }
    };
    const first = setTimeout(tick, 0);
    const every = setInterval(tick, 1000);
    return () => { clearTimeout(first); clearInterval(every); };
  }, [place, router]);

  // Until the clock has started, a reservation is treated as still live.
  const nowMs = now ?? (place?.reservation_expires_at ? Date.parse(place.reservation_expires_at) - 1 : 0);
  const state = launch50CardState({ phase, tier, subscriptionConnected, hasLaunchGrant, place, nowMs });

  if (state === "hidden") return null;

  const card = "scroll-mt-24 rounded-card border border-line bg-paper p-5 shadow-soft";
  const heading = <h2 className="font-display text-xl font-bold text-ink">OneShetland Launch 50</h2>;

  async function run(fn: () => Promise<{ ok: boolean; error?: string; expiresAt?: string | null }>, after?: (r: { expiresAt?: string | null }) => void) {
    setWorking(true); setErr(null);
    try {
      const r = await fn();
      if (!r.ok) setErr(r.error ?? "Something went wrong."); else { after?.(r); router.refresh(); }
    } catch { setErr("Something went wrong. Nothing has been charged. Please try again."); }
    finally { setWorking(false); }
  }

  const errorBox = (err || message) && (
    <p role="alert" className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700">
      {err ?? message}
      {!err && message && " You can still subscribe at the standard price, separately, from Your plan below."}
    </p>
  );

  if (state === "ended") {
    return (
      <section id="launch-50" className={card}>
        {heading}
        <p className="mt-2 text-sm text-ink-soft">Your Launch 50 place is complete. Standard prices apply.</p>
      </section>
    );
  }

  if (state === "pending") {
    return (
      <section id="launch-50" className={card}>
        {heading}
        <p className="mt-2 text-sm text-ink-soft">Your Launch 50 payment is being confirmed. This page will update when it is done.</p>
        <label className="mt-4 flex items-start gap-3 text-sm text-ink">
          <input type="checkbox" className="mt-0.5 h-4 w-4" checked={place!.showcase_opt_in} disabled={working}
            onChange={(e) => { const v = e.target.checked; run(() => setShowcase(businessId, v), () => setPlace({ ...place!, showcase_opt_in: v })); }} />
          <span>Show my business on the Launch 50 page (optional). You can change this at any time.</span>
        </label>
        <p className="mt-2 text-xs text-ink-muted">{LAUNCH50_LOCKED_NOTE}</p>
        {errorBox}
      </section>
    );
  }

  if (state === "active" && place) {
    const t = place.tier;
    const until = fmtLaunchDate(place.discount_ends_at);
    return (
      <section id="launch-50" className={card}>
        {heading}
        <p className="mt-2 text-sm font-semibold text-ink">
          Launch 50 member: Launch 50 price {launch50Price(t)}/month{until ? ` until ${until}` : ""}, then {standardPrice(t)}/month
        </p>
        <label className="mt-4 flex items-start gap-3 text-sm text-ink">
          <input type="checkbox" className="mt-0.5 h-4 w-4" checked={place.showcase_opt_in} disabled={working}
            onChange={(e) => { const v = e.target.checked; run(() => setShowcase(businessId, v), () => setPlace({ ...place, showcase_opt_in: v })); }} />
          <span>Show my business on the Launch 50 page (optional). You can change this at any time.</span>
        </label>
        <p className="mt-3 text-xs text-ink-muted">{LAUNCH50_LOCKED_NOTE}</p>
        {errorBox}
      </section>
    );
  }

  if (state === "held" && place) {
    const t = place.tier;
    const left = now !== null && place.reservation_expires_at ? Math.max(0, Math.floor((Date.parse(place.reservation_expires_at) - now) / 1000)) : null;
    const mm = left !== null ? `${Math.floor(left / 60)}:${String(left % 60).padStart(2, "0")}` : null;
    return (
      <section id="launch-50" className={card}>
        {heading}
        <p className="mt-2 rounded-lg bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-900">
          Place held for {LAUNCH50_RESERVATION_MINUTES} minutes{mm ? `: ${mm} left` : ""}
        </p>
        <p className="mt-3 text-sm text-ink-soft">{LAUNCH50_NAME[t]}: {launch50Price(t)}/month for {LAUNCH50_DISCOUNT_MONTHS} months, then {standardPrice(t)}/month. Monthly billing only.</p>
        <label className="mt-4 flex items-start gap-3 text-sm text-ink">
          <input type="checkbox" className="mt-0.5 h-4 w-4" checked={place.showcase_opt_in} disabled={working}
            onChange={(e) => { const v = e.target.checked; run(() => setShowcase(businessId, v), () => setPlace({ ...place, showcase_opt_in: v })); }} />
          <span>Show my business on the Launch 50 page (optional). You can change this at any time.</span>
        </label>
        <div className="mt-4 flex flex-wrap gap-2">
          <button type="button" onClick={() => onSubscribe(t)} disabled={busy || working}
            className="rounded-pill bg-navy px-5 py-2.5 text-sm font-semibold text-white shadow-soft transition hover:brightness-95 disabled:opacity-50">
            {busy ? "…" : "Subscribe at the Launch 50 price"}
          </button>
          <button type="button" onClick={() => run(() => releasePlace(businessId), () => setPlace(null))} disabled={busy || working}
            className="rounded-pill border border-line-strong px-5 py-2.5 text-sm font-semibold text-ink-soft hover:bg-sand disabled:opacity-50">
            Release my place
          </button>
        </div>
        <p className="mt-3 text-xs text-ink-muted">Nothing is charged until you confirm the price in the next step.</p>
        {errorBox}
      </section>
    );
  }

  // choose
  return (
    <section id="launch-50" className={card}>
      {heading}
      <p className="mt-1 text-sm text-ink-muted">{LAUNCH50_STATEMENT}</p>
      <fieldset className="mt-4">
        <legend className="text-sm font-semibold text-ink">Choose your Launch 50 plan</legend>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          {TIERS.map((t) => (
            <label key={t} className={"flex cursor-pointer items-start gap-3 rounded-xl border p-3 text-sm " + (choice === t ? "border-ink bg-sand/60" : "border-line")}>
              <input type="radio" name="launch50-tier" className="mt-1" checked={choice === t} onChange={() => setChoice(t)} />
              <span>
                <span className="block font-semibold text-ink">{LAUNCH50_NAME[t]} · {launch50Price(t)}/month</span>
                <span className="block text-xs text-ink-muted">for {LAUNCH50_DISCOUNT_MONTHS} months, then {standardPrice(t)}/month</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>
      <label className="mt-4 flex items-start gap-3 text-sm text-ink">
        <input type="checkbox" className="mt-0.5 h-4 w-4" checked={showcase} onChange={(e) => setShowcaseTick(e.target.checked)} />
        <span>Show my business on the Launch 50 page (optional)</span>
      </label>
      <button type="button" onClick={() => run(() => reservePlace(businessId, choice, showcase))} disabled={working}
        className="mt-4 w-full rounded-pill bg-navy px-5 py-2.5 text-sm font-semibold text-white shadow-soft transition hover:brightness-95 disabled:opacity-50 sm:w-auto">
        {working ? "…" : "Reserve my place"}
      </button>
      <p className="mt-3 text-xs text-ink-muted">Reserving holds a place for {LAUNCH50_RESERVATION_MINUTES} minutes. Nothing is charged until you subscribe. Monthly billing only; cancel any time.</p>
      {errorBox}
    </section>
  );
}

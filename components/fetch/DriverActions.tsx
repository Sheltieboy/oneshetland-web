"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useConfirm } from "@/components/ui/ConfirmProvider";
import {
  FETCH, calcWaitingFee, penceToGBP, WAIT_GRACE_SECS, WAIT_MAX_PENCE,
  type DeliveryRequest, type WaitingEvent,
} from "@/lib/fetch-data";

function fmtClock(secs: number): string {
  const m = Math.floor(secs / 60).toString().padStart(2, "0");
  const s = Math.floor(secs % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

/** Driver-side action panel on a request detail page (assigned driver only).
 *  Mirrors the app: arrive → collected (waiting fee) → delivered (capture). */
export function DriverActions({ req, waitingEvent }: { req: DeliveryRequest; waitingEvent: WaitingEvent | null }) {
  const router = useRouter();
  const confirm = useConfirm();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const arrivedNotCollected = waitingEvent && !waitingEvent.collected_at;

  // Is the money actually held? Only 'authorised' means a Stripe hold exists —
  // a PaymentIntent sitting in requires_action or requires_payment_method is
  // not one, and used to be recorded as authorised anyway. The database refuses
  // the transition too; this is so the driver is told why rather than shown a
  // button that errors.
  const funded = req.payment_status === "authorised" || req.payment_status === "captured";
  const awaitingCustomer =
    req.payment_status === "requires_action" || req.payment_status === "requires_payment_method";

  useEffect(() => {
    if (arrivedNotCollected && waitingEvent) {
      const arrived = new Date(waitingEvent.arrived_at);
      const tick = () => setElapsed(Math.floor((Date.now() - arrived.getTime()) / 1000));
      tick();
      timer.current = setInterval(tick, 1000);
    }
   return () => { if (timer.current) clearInterval(timer.current); };
  }, [arrivedNotCollected, waitingEvent]);

  const inGrace = elapsed < WAIT_GRACE_SECS;
  const liveFee = arrivedNotCollected && req.ready_for_collection && waitingEvent
    ? calcWaitingFee(new Date(waitingEvent.arrived_at), new Date())
    : 0;

  async function arrived() {
    setBusy(true); setError(null);
    try {
      const sb = createClient();
      const { data: { user } } = await sb.auth.getUser();
      if (!user) throw new Error("Please sign in.");
      const { error: e } = await sb.from("waiting_events").insert({ request_id: req.id, driver_id: user.id });
      if (e) throw e;
      router.refresh();
    } catch (e) { setError(e instanceof Error ? e.message : "Could not update."); } finally { setBusy(false); }
  }

  async function collected() {
    if (!waitingEvent) return;
    setBusy(true); setError(null);
    try {
      const sb = createClient();
      // The waiting fee is measured by the server from the arrival it stamped,
      // priced from delivery_pricing_config, and written in one transaction
      // with the status. The driver's device used to calculate the money and
      // write it to both rows — so a driver could charge a customer whatever
      // they typed, and a wound-back clock could manufacture waiting time.
      const { error: e } = await sb.rpc("fetch_mark_collected", { p_request: req.id });
      if (e) throw e;
      try { await sb.functions.invoke("notify-collected", { body: { request_id: req.id } }); } catch { /* non-fatal */ }
      router.refresh();
    } catch (e) { setError(e instanceof Error ? e.message : "Could not update."); } finally { setBusy(false); }
  }

  async function delivered() {
    if (!(await confirm({ title: "Mark as delivered?", body: "Confirm you've delivered the item? The customer's card will be charged now.", confirmLabel: "Yes, delivered" }))) return;
    setBusy(true); setError(null);
    try {
      const sb = createClient();
      const { data, error: fnErr } = await sb.functions.invoke("capture-payment", { body: { request_id: req.id } });
      if (fnErr || data?.error) throw new Error(data?.error ?? "Could not capture payment.");
      router.refresh();
    } catch (e) { setError(e instanceof Error ? e.message : "Could not capture payment."); } finally { setBusy(false); }
  }

  const btn = "w-full rounded-pill py-3 font-semibold text-white transition hover:brightness-110 disabled:opacity-40";

  if (!funded) {
    return (
      <div className="rounded-card border border-amber-300 bg-amber-50 p-4">
        <p className="font-display text-base font-bold text-amber-900">
          {awaitingCustomer ? "Waiting for the customer's payment" : "Payment not authorised yet"}
        </p>
        <p className="mt-1 text-sm text-amber-800">
          {awaitingCustomer
            ? "They have been asked to confirm the hold with their bank or add a card. Please don't collect until this clears."
            : "We could not place a hold on the customer's card. Please don't collect — this delivery isn't funded."}
        </p>
      </div>
    );
  }

   return (
    <div className="rounded-card border-2 p-4" style={{ borderColor: `${FETCH}55`, background: `${FETCH}0a` }}>
      <p className="mb-3 text-xs font-bold uppercase tracking-widest" style={{ color: FETCH }}>Driver actions</p>

      {arrivedNotCollected && (
        <div className={"mb-3 rounded-xl border p-3 " + (inGrace ? "border-amber-300 bg-amber-50" : "border-red-300 bg-red-50")}>
          <div className="flex items-center justify-between">
            <span className="text-sm font-bold text-ink">{inGrace ? "⏱ Grace period" : "⏳ Waiting fee running"}</span>
            <span className="font-display text-xl font-extrabold tabular-nums text-ink">{fmtClock(elapsed)}</span>
          </div>
          <p className="mt-0.5 text-xs text-ink-soft">
            {inGrace ? `Waiting fee starts in ${fmtClock(WAIT_GRACE_SECS - elapsed)}` : `Current fee: ${penceToGBP(liveFee)} · Max ${penceToGBP(WAIT_MAX_PENCE)}`}
          </p>
        </div>
      )}

      {req.status === "matched" && !waitingEvent && (
        <button onClick={arrived} disabled={busy} className={btn} style={{ background: FETCH }}>{busy ? "…" : "I've arrived at collection"}</button>
      )}
      {req.status === "matched" && arrivedNotCollected && (
        <button onClick={collected} disabled={busy} className={btn} style={{ background: FETCH }}>{busy ? "…" : "Mark as collected"}</button>
      )}
      {req.status === "collected" && (
        <button onClick={delivered} disabled={busy} className={btn} style={{ background: FETCH }}>{busy ? "…" : "Mark as delivered ✓"}</button>
      )}
      {req.status === "delivered" && <p className="text-center text-sm font-semibold text-green-700">🎉 This delivery is complete.</p>}

      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </div>
  );
}

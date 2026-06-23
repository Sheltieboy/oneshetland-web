"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
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
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const arrivedNotCollected = waitingEvent && !waitingEvent.collected_at;

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
      const collectedAt = new Date();
      const feePence = req.ready_for_collection ? calcWaitingFee(new Date(waitingEvent.arrived_at), collectedAt) : 0;
      await sb.from("waiting_events").update({ collected_at: collectedAt.toISOString(), waiting_fee_pence: feePence }).eq("id", waitingEvent.id);
      await sb.from("delivery_requests").update({ status: "collected", waiting_fee_pence: feePence }).eq("id", req.id);
      try { await sb.functions.invoke("notify-collected", { body: { request_id: req.id } }); } catch { /* non-fatal */ }
      router.refresh();
    } catch (e) { setError(e instanceof Error ? e.message : "Could not update."); } finally { setBusy(false); }
  }

  async function delivered() {
    if (!confirm("Confirm you've delivered the item? The customer's card will be charged now.")) return;
    setBusy(true); setError(null);
    try {
      const sb = createClient();
      const { data, error: fnErr } = await sb.functions.invoke("capture-payment", { body: { request_id: req.id } });
      if (fnErr || data?.error) throw new Error(data?.error ?? "Could not capture payment.");
      router.refresh();
    } catch (e) { setError(e instanceof Error ? e.message : "Could not capture payment."); } finally { setBusy(false); }
  }

  const btn = "w-full rounded-pill py-3 font-semibold text-white transition hover:brightness-110 disabled:opacity-40";

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

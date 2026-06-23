"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { calcWaitingFee, penceToGBP, WAIT_GRACE_SECS, type WaitingEvent } from "@/lib/fetch-data";

/** Shown to the requester while the driver is waiting at collection. Live grace
 *  countdown / waiting fee, plus a "confirm ready" action (parity with app). */
export function CustomerWaitingPanel({ requestId, waitingEvent, readyForCollection }: {
  requestId: string; waitingEvent: WaitingEvent; readyForCollection: boolean;
}) {
  const router = useRouter();
  const [now, setNow] = useState(() => Date.now());
  const [busy, setBusy] = useState(false);
  const arrived = new Date(waitingEvent.arrived_at);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 10_000);
    return () => clearInterval(t);
  }, []);

  const graceRemaining = Math.max(0, WAIT_GRACE_SECS - (now - arrived.getTime()) / 1000);
  const inGrace = graceRemaining > 0;
  const fee = calcWaitingFee(arrived, new Date(now));

  async function confirmReady() {
    setBusy(true);
    try {
      const sb = createClient();
      await sb.from("delivery_requests").update({ ready_for_collection: true }).eq("id", requestId);
      router.refresh();
    } finally { setBusy(false); }
  }

  return (
    <div className={"rounded-card border-2 p-4 " + (inGrace ? "border-amber-400 bg-amber-50" : "border-red-400 bg-red-50")}>
      <p className="font-bold text-ink">{inGrace ? "🕐 Your driver has arrived" : "⏱ Waiting fee in progress"}</p>
      <p className="mt-1 text-sm text-ink-soft">
        {inGrace
          ? "Your driver is at the collection point. Confirm your item is ready to avoid a waiting fee."
          : "Your driver has waited beyond the grace period. A waiting fee of up to £6.00 may apply."}
      </p>
      {inGrace ? (
        <p className="mt-2 text-sm font-semibold text-amber-900">{Math.ceil(graceRemaining / 60)} min until a fee may start</p>
      ) : fee > 0 ? (
        <p className="mt-2 font-display text-lg font-extrabold text-red-700">Current waiting fee: {penceToGBP(fee)}</p>
      ) : null}
      {readyForCollection ? (
        <p className="mt-3 rounded-lg bg-green-50 px-3 py-2 text-sm font-semibold text-green-700">✓ Collection confirmed — driver is on their way</p>
      ) : (
        <button onClick={confirmReady} disabled={busy} className="mt-3 w-full rounded-pill bg-navy py-2.5 text-sm font-semibold text-white disabled:opacity-40">
          {busy ? "…" : "I've confirmed collection is ready"}
        </button>
      )}
    </div>
  );
}

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { FETCH, runDestination, fmtDateTime, type Run } from "@/lib/fetch-data";

/** Driver "Accept this request" — mirrors the app: create a run if none, pick
 *  one if several, then match + pre-authorise the customer's card. */
export function AcceptRequestButton({
  requestId, destinationGuess, destRegionId, categorySlug, openRuns, disabled,
}: {
  requestId: string;
  destinationGuess: string;
  destRegionId: string | null;
  categorySlug: string;
  openRuns: Pick<Run, "id" | "notes" | "destination_area" | "departure_start">[];
  disabled?: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [picking, setPicking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function accept(runId: string) {
    setBusy(true); setPicking(false); setError(null);
    try {
      const sb = createClient();
      const { data, error: upErr } = await sb.from("delivery_requests")
        .update({ status: "matched", run_id: runId })
        .eq("id", requestId).eq("status", "pending").select("id");
      if (upErr) throw upErr;
      if (!data || data.length === 0) { setError("Another driver just took this one."); router.refresh(); return; }
      // Pre-authorise the customer's card (non-fatal if it fails — webhook/retry handles it).
      try { await sb.functions.invoke("authorise-payment", { body: { request_id: requestId } }); } catch { /* non-fatal */ }
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not accept this request.");
    } finally {
      setBusy(false);
    }
  }

  async function createRunAndAccept() {
    setBusy(true); setError(null);
    try {
      const sb = createClient();
      const { data: { user } } = await sb.auth.getUser();
      if (!user) throw new Error("Please sign in.");
      const now = new Date();
      const end = new Date(now.getTime() + 3 * 60 * 60 * 1000);
      // Seed a REAL run from the request: its drop-off area + category. The
      // driver can widen it and add more "along the way" requests afterwards.
      const { data: run, error: rErr } = await sb.from("runs").insert({
        driver_id: user.id,
        destination_region_id: destRegionId,
        destination_area: destinationGuess || null,
        departure_start: now.toISOString(),
        departure_end: end.toISOString(),
        status: "open",
        ferry_crossing: false,
        categories_accepted: [categorySlug],
        notes: null,
      }).select("id").single();
      if (rErr) throw rErr;
      await accept(run.id as string);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not start a run.");
      setBusy(false);
    }
  }

  function onClick() {
    if (openRuns.length === 0) { void createRunAndAccept(); return; }
    if (openRuns.length === 1) { void accept(openRuns[0].id); return; }
    setPicking((p) => !p);
  }

  return (
    <div className="relative">
      <button
        onClick={onClick}
        disabled={busy || disabled}
        className="w-full rounded-pill py-2.5 text-sm font-semibold text-white transition hover:brightness-110 disabled:opacity-40"
        style={{ background: FETCH }}
      >
        {busy ? "Accepting…" : openRuns.length === 0 ? "Start a run & take this" : "Accept this request"}
      </button>
      {picking && (
        <div className="absolute z-20 mt-2 w-full overflow-hidden rounded-xl border border-line bg-paper shadow-lift">
          <p className="border-b border-line px-3 py-2 text-xs font-semibold text-ink-muted">Add to which run?</p>
          {openRuns.map((r) => (
            <button key={r.id} onClick={() => accept(r.id)} className="block w-full px-3 py-2.5 text-left text-sm font-medium text-ink hover:bg-sand">
              → {runDestination(r)} · {fmtDateTime(r.departure_start)}
            </button>
          ))}
        </div>
      )}
      {error && <p className="mt-1.5 text-xs text-red-600">{error}</p>}
    </div>
  );
}

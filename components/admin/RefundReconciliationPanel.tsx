"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Card } from "@/components/admin/AdminUI";
import { useConfirm } from "@/components/ui/ConfirmProvider";
import { gbp } from "@/lib/currency";

/**
 * Refund reconciliation — did the MERCHANT's money come back, not just the
 * customer's?
 *
 * A refund order row saying "refunded" proves only that the customer was paid
 * back. On a destination charge the merchant keeps the money (and OneShetland
 * its fee) unless the transfer was reversed and the fee refunded. This lists
 * every refund whose merchant side is not fully reconciled, straight from the
 * refund-reconcile Edge Function (admin-only; the tables are not reachable
 * from a browser).
 *
 * Checking is read-only. "Repair" moves money, so it asks for explicit
 * confirmation, states exactly what will move, and is recorded server-side
 * against the admin who pressed it.
 */

type State = "reconciled" | "repaired" | "needs_repair" | "needs_review" | "repair_failed";

interface Row {
  charge_id: string;
  payment_intent_id: string | null;
  rail: string;
  state: State;
  charge_amount_pence: number;
  amount_refunded_pence: number;
  transfer_id: string | null;
  transfer_amount_pence: number | null;
  transfer_reversed_pence: number | null;
  fee_id: string | null;
  fee_amount_pence: number | null;
  fee_refunded_pence: number | null;
  transfer_gap_pence: number;
  fee_gap_pence: number;
  repair_attempts: number;
  last_error: string | null;
  first_flagged_at: string | null;
  repaired_at: string | null;
  last_checked_at: string;
}

interface Listing {
  open_count: number;
  rows: Row[];
  unverified_event_refunds: { order_id: string; payment_intent_id: string; total_pence: number; refunded_at: string | null }[];
}

const STATE_LABEL: Record<State, { label: string; bg: string; fg: string }> = {
  reconciled:   { label: "Reconciled",          bg: "#dcfce7", fg: "#166534" },
  repaired:     { label: "Repaired",            bg: "#dcfce7", fg: "#166534" },
  needs_repair: { label: "Merchant still paid", bg: "#fee2e2", fg: "#991b1b" },
  needs_review: { label: "Needs review",        bg: "#fef3c7", fg: "#92400e" },
  repair_failed:{ label: "Repair failed",       bg: "#fee2e2", fg: "#991b1b" },
};

async function invoke<T>(body: Record<string, unknown>): Promise<{ data: T | null; error: string | null }> {
  try {
    const sb = createClient();
    const { data, error } = await sb.functions.invoke("refund-reconcile", { body });
    let payload = data as (T & { error?: string }) | null;
    if (error && (error as { name?: string }).name === "FunctionsHttpError") {
      payload = await ((error as unknown as { context?: Response }).context?.json?.() ?? Promise.resolve(null)).catch(() => null);
    }
    if (error || payload?.error) return { data: null, error: payload?.error ?? error?.message ?? "Request failed." };
    return { data: payload, error: null };
  } catch (e) {
    return { data: null, error: e instanceof Error ? e.message : "Request failed." };
  }
}

export function RefundReconciliationPanel() {
  const confirm = useConfirm();
  const [listing, setListing] = useState<Listing | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    const r = await invoke<Listing>({ action: "list" });
    if (r.error || !r.data) { setError(r.error ?? "Could not load refund reconciliation."); return; }
    setListing(r.data); setError(null);
  }, []);
  useEffect(() => { load(); }, [load]);

  async function scan() {
    setBusy("scan"); setNotice(null);
    const r = await invoke<{ checked: number }>({ action: "scan" });
    setBusy(null);
    if (r.error) { setError(r.error); return; }
    setNotice(`Checked ${r.data?.checked ?? 0} refunded charges against Stripe. Nothing was moved.`);
    await load();
  }

  async function repair(row: Row) {
    const net = Math.max(0, row.transfer_gap_pence - row.fee_gap_pence);
    const ok = await confirm({
      title: "Repair this refund?",
      body:
        `This moves real money. OneShetland will reverse ${gbp(row.transfer_gap_pence)} of the merchant's transfer` +
        (row.fee_gap_pence > 0 ? ` and return the ${gbp(row.fee_gap_pence)} platform fee to them, ` : ", ") +
        `so the merchant's Stripe balance is debited about ${gbp(net)} net and OneShetland recovers about ${gbp(net)}. ` +
        "Stripe may refuse if the merchant's balance is too low; if so nothing moves and the reason is shown here. " +
        `Charge ${row.charge_id}.`,
      confirmLabel: "Reverse the transfer",
      danger: true,
    });
    if (!ok) return;
    setBusy(row.charge_id); setNotice(null); setError(null);
    const r = await invoke<{ result: { state: string; note: string } }>({ action: "repair", charge_id: row.charge_id, confirm: true });
    setBusy(null);
    if (r.error) { setError(r.error); return; }
    setNotice(`Repair result for ${row.charge_id}: ${r.data?.result.state}${r.data?.result.note ? ` — ${r.data.result.note}` : ""}`);
    await load();
  }

  const open = (listing?.rows ?? []).filter((r) => r.state !== "reconciled" && r.state !== "repaired");
  const settled = (listing?.rows ?? []).filter((r) => r.state === "reconciled" || r.state === "repaired");
  const unverified = listing?.unverified_event_refunds ?? [];

  return (
    <Card>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-display text-lg font-bold text-ink">Refund reconciliation</h2>
        <button
          onClick={scan} disabled={busy !== null}
          className="rounded-pill border border-line bg-paper px-3 py-1.5 text-xs font-bold text-ink disabled:opacity-50"
        >
          {busy === "scan" ? "Checking Stripe…" : "Check Stripe now"}
        </button>
      </div>
      <p className="mt-1 text-sm text-ink-faint">
        A refund is reconciled only when the customer was refunded, the merchant's transfer was reversed and the
        platform fee was returned. An order marked “refunded” does not prove the merchant's money came back.
      </p>

      {error && <p className="mt-3 text-sm text-rose-600">{error}</p>}
      {notice && <p className="mt-3 text-sm text-ink-muted">{notice}</p>}

      {!listing && !error ? (
        <p className="mt-4 text-sm text-ink-muted">Loading…</p>
      ) : listing ? (
        <>
          {open.length > 0 ? (
            <p className="mt-3 rounded-xl bg-rose-50 p-3 text-sm font-semibold text-rose-700">
              {open.length} refund{open.length === 1 ? "" : "s"} not fully reconciled — the merchant may still hold the money.
            </p>
          ) : unverified.length > 0 ? (
            <p className="mt-3 rounded-xl bg-amber-50 p-3 text-sm font-semibold text-amber-800">
              {unverified.length} refunded event order{unverified.length === 1 ? " has" : "s have"} not been checked against
              Stripe yet. Use “Check Stripe now”.
            </p>
          ) : (
            <p className="mt-3 rounded-xl bg-emerald-50 p-3 text-sm font-semibold text-emerald-800">
              Every refund checked so far is reconciled.
            </p>
          )}

          {open.map((r) => (
            <div key={r.charge_id} className="mt-3 rounded-xl border border-line p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span
                  className="rounded-pill px-3 py-1 text-xs font-bold"
                  style={{ background: STATE_LABEL[r.state].bg, color: STATE_LABEL[r.state].fg }}
                >
                  {STATE_LABEL[r.state].label}
                </span>
                <span className="text-xs text-ink-faint">{r.rail.replace("_", " ")}</span>
              </div>
              <dl className="mt-2 grid gap-1 text-sm sm:grid-cols-3">
                <div>
                  <dt className="text-[11px] font-semibold uppercase tracking-wide text-ink-faint">Customer</dt>
                  <dd className="font-semibold text-ink">refunded {gbp(r.amount_refunded_pence)} of {gbp(r.charge_amount_pence)}</dd>
                </div>
                <div>
                  <dt className="text-[11px] font-semibold uppercase tracking-wide text-ink-faint">Merchant</dt>
                  <dd className={"font-semibold " + (r.transfer_gap_pence > 0 ? "text-rose-600" : "text-ink")}>
                    {r.transfer_gap_pence > 0
                      ? `still holds ${gbp(r.transfer_gap_pence)} (transfer not reversed)`
                      : "transfer reversed"}
                  </dd>
                </div>
                <div>
                  <dt className="text-[11px] font-semibold uppercase tracking-wide text-ink-faint">OneShetland fee</dt>
                  <dd className={"font-semibold " + (r.fee_gap_pence > 0 ? "text-rose-600" : "text-ink")}>
                    {r.fee_gap_pence > 0 ? `${gbp(r.fee_gap_pence)} not refunded` : "refunded"}
                  </dd>
                </div>
              </dl>
              <p className="mt-2 break-all text-[11px] text-ink-faint">
                {r.payment_intent_id} · {r.charge_id}
                {r.transfer_id && ` · ${r.transfer_id}`}
                {r.fee_id && ` · ${r.fee_id}`}
              </p>
              {r.first_flagged_at && (
                <p className="text-[11px] text-ink-faint">First flagged {new Date(r.first_flagged_at).toLocaleString("en-GB")}</p>
              )}
              {r.last_error && <p className="mt-1 text-xs text-rose-600">Last repair attempt: {r.last_error}</p>}
              {r.state === "needs_review" ? (
                <p className="mt-2 text-xs text-ink-muted">
                  Partial refund — which part belongs to the merchant needs a person to decide in Stripe.
                </p>
              ) : (
                <button
                  onClick={() => repair(r)} disabled={busy !== null}
                  className="mt-2 rounded-pill px-4 py-1.5 text-xs font-bold text-paper disabled:opacity-50"
                  style={{ background: "#991b1b" }}
                >
                  {busy === r.charge_id ? "Repairing…" : "Repair…"}
                </button>
              )}
            </div>
          ))}

          {settled.length > 0 && (
            <details className="mt-3">
              <summary className="cursor-pointer text-xs font-semibold text-ink-faint">
                {settled.length} reconciled
              </summary>
              <div className="mt-1 divide-y divide-line">
                {settled.map((r) => (
                  <p key={r.charge_id} className="py-1 text-xs text-ink-muted">
                    {STATE_LABEL[r.state].label} · {gbp(r.amount_refunded_pence)} · {r.charge_id}
                  </p>
                ))}
              </div>
            </details>
          )}
        </>
      ) : null}
    </Card>
  );
}

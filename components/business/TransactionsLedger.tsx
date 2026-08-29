"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { BIZ } from "@/lib/business-data";
import { gbp } from "@/lib/currency";

/**
 * TransactionsLedger — the business's full money statement (v1). One read-time
 * UNION of every in-platform money event (get_business_transactions RPC),
 * filterable by period, with running totals and CSV export for their accounts.
 */

interface Txn {
  occurred_at: string;
  direction: "in" | "out";
  kind: string;
  description: string;
  counterparty: string;
  gross_pence: number;
  fee_pence: number;
  cashback_pence: number;
  net_pence: number;
  status: string;
  reference: string | null;
}

const KIND_LABEL: Record<string, string> = {
  wallet_payment: "Wallet payment",
  pass_sale: "Pass / pack",
  gift_sale: "Gift",
  booking_deposit: "Booking deposit",
  ticket_sale: "Event tickets",
  product_sale: "Shop order",
  boost: "Boost",
};

type PresetKey = "this_month" | "last_month" | "last_90" | "this_year" | "all";
const PRESETS: { key: PresetKey; label: string }[] = [
  { key: "this_month", label: "This month" },
  { key: "last_month", label: "Last month" },
  { key: "last_90", label: "Last 90 days" },
  { key: "this_year", label: "This year" },
  { key: "all", label: "All time" },
];

function rangeFor(key: PresetKey, now: Date): { from: string | null; to: string | null } {
  const y = now.getFullYear(), m = now.getMonth();
  switch (key) {
    case "this_month": return { from: new Date(y, m, 1).toISOString(), to: null };
    case "last_month": return { from: new Date(y, m - 1, 1).toISOString(), to: new Date(y, m, 1).toISOString() };
    case "last_90":    return { from: new Date(now.getTime() - 90 * 86_400_000).toISOString(), to: null };
    case "this_year":  return { from: new Date(y, 0, 1).toISOString(), to: null };
    case "all":        return { from: null, to: null };
  }
}

const fmtDate = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });

export function TransactionsLedger({ businessId, businessName }: { businessId: string; businessName: string }) {
  const [preset, setPreset] = useState<PresetKey>("this_month");
  const [rows, setRows] = useState<Txn[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (key: PresetKey) => {
    setLoading(true); setError(null);
    try {
      const { from, to } = rangeFor(key, new Date());
      const sb = createClient();
      const { data, error } = await sb.rpc("get_business_transactions", {
        p_business_id: businessId, p_from: from, p_to: to, p_limit: 5000,
      });
      if (error) throw error;
      setRows((data ?? []) as Txn[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load transactions");
      setRows([]);
    } finally { setLoading(false); }
  }, [businessId]);

  useEffect(() => { load(preset); }, [preset, load]);

  const totals = useMemo(() => {
    let grossIn = 0, fees = 0, cashback = 0, netIn = 0, costsOut = 0;
    for (const r of rows) {
      if (r.direction === "in") { grossIn += r.gross_pence; fees += r.fee_pence; cashback += r.cashback_pence; netIn += r.net_pence; }
      else costsOut += r.gross_pence;
    }
    return { grossIn, fees, cashback, netIn, costsOut, net: netIn - costsOut };
  }, [rows]);

  function exportCsv() {
    const head = ["Date", "Type", "Description", "Customer", "Direction", "Gross (£)", "Platform fee (£)", "Cashback (£)", "Net (£)", "Status", "Reference"];
    const esc = (v: string) => /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
    const p = (n: number) => (n / 100).toFixed(2);
    const lines = rows.map((r) => [
      new Date(r.occurred_at).toISOString().slice(0, 10),
      KIND_LABEL[r.kind] ?? r.kind, r.description, r.counterparty, r.direction,
      p(r.gross_pence), p(r.fee_pence), p(r.cashback_pence), p(r.net_pence), r.status, r.reference ?? "",
    ].map((c) => esc(String(c))).join(","));
    const csv = [head.join(","), ...lines].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${businessName.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}-transactions-${preset}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-5">
      {/* Period + export */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1.5">
          {PRESETS.map((p) => (
            <button key={p.key} onClick={() => setPreset(p.key)}
              className={"rounded-pill px-3.5 py-1.5 text-sm font-semibold transition " + (preset === p.key ? "text-white" : "border border-line text-ink-soft hover:bg-sand")}
              style={preset === p.key ? { background: BIZ } : undefined}>
              {p.label}
            </button>
          ))}
        </div>
        <button onClick={exportCsv} disabled={!rows.length}
          className="rounded-pill border border-line-strong px-4 py-1.5 text-sm font-bold text-ink transition hover:bg-sand disabled:opacity-40">
          ⬇ Export CSV
        </button>
      </div>

      {/* Totals */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Money in" value={gbp(totals.grossIn)} />
        <Stat label="Platform fees" value={`− ${gbp(totals.fees)}`} />
        <Stat label="Cashback funded" value={`− ${gbp(totals.cashback)}`} />
        <Stat label="Net to you" value={gbp(totals.net)} accent />
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-card border border-line bg-paper shadow-soft">
        {loading ? (
          <p className="p-6 text-center text-sm text-ink-muted">Loading…</p>
        ) : error ? (
          <p className="p-6 text-center text-sm text-rose-600">{error}</p>
        ) : rows.length === 0 ? (
          <p className="p-8 text-center text-sm text-ink-muted">No transactions in this period.</p>
        ) : (
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-ink-faint">
                <th className="px-4 py-3 font-bold">Date</th>
                <th className="px-4 py-3 font-bold">Type</th>
                <th className="px-4 py-3 font-bold">Customer</th>
                <th className="px-4 py-3 text-right font-bold">Gross</th>
                <th className="px-4 py-3 text-right font-bold">Fee</th>
                <th className="px-4 py-3 text-right font-bold">Cashback</th>
                <th className="px-4 py-3 text-right font-bold">Net</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i} className="border-b border-line/60 last:border-0">
                  <td className="whitespace-nowrap px-4 py-3 text-ink-soft">{fmtDate(r.occurred_at)}</td>
                  <td className="px-4 py-3">
                    <span className="font-semibold text-ink">{KIND_LABEL[r.kind] ?? r.kind}</span>
                    <span className="block text-xs text-ink-faint">{r.description}</span>
                  </td>
                  <td className="px-4 py-3 text-ink-soft">{r.counterparty}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-ink">{gbp(r.gross_pence)}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-ink-faint">{r.fee_pence ? `− ${gbp(r.fee_pence)}` : "—"}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-ink-faint">{r.cashback_pence ? `− ${gbp(r.cashback_pence)}` : "—"}</td>
                  <td className={"px-4 py-3 text-right font-semibold tabular-nums " + (r.direction === "out" ? "text-rose-600" : "text-emerald-700")}>
                    {r.direction === "out" ? `− ${gbp(r.gross_pence)}` : gbp(r.net_pence)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <p className="text-xs text-ink-faint">
        Covers wallet payments, pass &amp; gift sales, booking deposits, event tickets and boosts. Your monthly
        subscription and bank payouts are managed in Stripe — see <span className="font-semibold">Plan, payments &amp; payouts</span>.
        Platform fees on card sales are settled net through Stripe.
      </p>
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="rounded-xl border border-line bg-paper p-4 shadow-soft">
      <p className="text-xs font-semibold uppercase tracking-wide text-ink-faint">{label}</p>
      <p className={"mt-1 font-display text-xl font-bold " + (accent ? "" : "text-ink")} style={accent ? { color: BIZ } : undefined}>{value}</p>
    </div>
  );
}

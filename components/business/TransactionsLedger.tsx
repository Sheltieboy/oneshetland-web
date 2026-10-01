"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { BIZ } from "@/lib/business-data";
import { gbp } from "@/lib/currency";
import { fetchWalletSavingsBenchmark, type WalletSavingsBenchmark } from "@/lib/wallet-data";

/**
 * TransactionsLedger — the business's full money statement (v1). One read-time
 * UNION of every in-platform money event (get_business_transactions RPC),
 * filterable by period, with running totals and CSV export for their accounts.
 */

interface Txn {
  occurred_at: string;
  direction: "in" | "out" | "refund";
  kind: string;
  description: string;
  counterparty: string;
  gross_pence: number;
  fee_pence: number;
  cashback_pence: number;
  net_pence: number;
  status: string;
  reference: string | null;
  /**
   * The literal transfer_state of the underlying Wallet spend (null for
   * every non-Wallet rail). 'failed' is the only value ever synchronously
   * paired with an automatic reversal in the same request — Stripe
   * rejected the transfer outright and it never reached this business,
   * however this row's own fee/net figures read. 'reversed' means it
   * genuinely reached them before a later, separate refund clawed it back.
   */
  transfer_state: string | null;
}

const KIND_LABEL: Record<string, string> = {
  wallet_payment: "Wallet payment",
  pass_sale: "Pass / pack",
  gift_sale: "Gift",
  booking_deposit: "Booking deposit",
  ticket_sale: "Event tickets",
  product_sale: "Shop order",
  boost: "Boost",
  // A refund's kind names what it reverses (wallet_payment_refund vs.
  // gift_sale_refund etc.), so the savings calculator below can tell a
  // genuine till-payment refund apart from a refund of something wallet-
  // FUNDED — every one of them still just reads "Refund" here.
  wallet_payment_refund: "Refund",
  product_sale_refund: "Refund",
  pass_sale_refund: "Refund",
  gift_sale_refund: "Refund",
  ticket_sale_refund: "Refund",
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
  const [benchmark, setBenchmark] = useState<WalletSavingsBenchmark | null>(null);

  // Loaded once — the benchmark rarely changes and isn't period-dependent.
  useEffect(() => { fetchWalletSavingsBenchmark().then(setBenchmark).catch(() => {}); }, []);

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
    // A refund carries the mirror of its sale, so its fee and cashback are
    // negative and simply add in: the sale stays in Money in where it was
    // earned, and Refunds shows separately what went back.
    let grossIn = 0, refunds = 0, fees = 0, cashback = 0, netIn = 0, costsOut = 0;
    for (const r of rows) {
      if (r.direction === "in") { grossIn += r.gross_pence; fees += r.fee_pence; cashback += r.cashback_pence; netIn += r.net_pence; }
      else if (r.direction === "refund") { refunds += Math.abs(r.gross_pence); fees += r.fee_pence; cashback += r.cashback_pence; netIn += r.net_pence; }
      else costsOut += r.gross_pence;
    }
    return { grossIn, refunds, fees, cashback, netIn, costsOut, net: netIn - costsOut };
  }, [rows]);

  // Estimated against the configured benchmark — a comparison, never an
  // assertion about this merchant's real card-processing contract. Scoped to
  // genuine pay-at-till Wallet payments (kind "wallet_payment") AND their own
  // refunds (kind "wallet_payment_refund") only: a wallet-funded gift, pass
  // or shop order — and ITS refund — is charged at THAT rail's own
  // commission, not the wallet rate, so comparing either against a card
  // benchmark here would compare the wrong fee to the wrong thing.
  //
  // A refund row already carries the exact negative mirror of its sale
  // (gross_pence, fee_pence — see get_business_transactions), so summing
  // both kinds together nets a refunded payment to zero by construction:
  // "Saved with Wallet" must represent retained Wallet sales, not a gross
  // historical payment that has since been given back. The benchmark fee is
  // computed from the UNSIGNED gross and then given the row's own sign,
  // rather than floored on a negative number directly — floor() rounds a
  // negative amount further FROM zero, which would make a refund's benchmark
  // fee one penny more negative than its sale's was positive, and the pair
  // would no longer cancel exactly.
  const savings = useMemo(() => {
    if (!benchmark || !benchmark.enabled) return null;
    const walletRows = rows.filter((r) =>
      (r.direction === "in" && r.kind === "wallet_payment") ||
      (r.direction === "refund" && r.kind === "wallet_payment_refund"));
    if (walletRows.length === 0) return null;
    let sales = 0, walletFees = 0, cardFees = 0;
    for (const r of walletRows) {
      sales += r.gross_pence;
      walletFees += r.fee_pence;
      const sign = r.gross_pence < 0 ? -1 : 1;
      cardFees += sign * (Math.floor((Math.abs(r.gross_pence) * benchmark.card_percent_bps) / 10_000) + benchmark.card_fixed_pence);
    }
    // Never shown as a misleading negative "saved" figure — if a
    // misconfigured benchmark ever sits below the wallet rate, or a period
    // holds only a refund with no sale of its own, the honest commercial
    // answer is "nothing to show", not a negative figure.
    const estimatedSaved = Math.max(0, cardFees - walletFees);
    return { sales, walletFees, cardFees, estimatedSaved };
  }, [rows, benchmark]);

  function exportCsv() {
    const head = ["Date", "Type", "Description", "Customer", "Direction", "Gross (£)", "Platform fee (£)", "Cashback (£)", "Net (£)", "Status", "Reference", "Merchant paid"];
    // CR too: a description carrying a bare \r would otherwise split the row.
    const esc = (v: string) => /[",\r\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
    const p = (n: number) => (n / 100).toFixed(2);
    // "Merchant paid" distinguishes a failed, auto-reversed transfer (No —
    // the stored fee/net figures never actually moved) from a genuine sale,
    // refunded or not (Yes — gross/fee/net are what really happened, even if
    // later reversed). Read straight off the RPC's own transfer_state, never
    // inferred from amounts.
    const lines = rows.map((r) => [
      new Date(r.occurred_at).toISOString().slice(0, 10),
      r.transfer_state === "failed" ? "Failed wallet payment" : (KIND_LABEL[r.kind] ?? r.kind),
      r.description, r.counterparty, r.direction,
      p(r.gross_pence), p(r.fee_pence), p(r.cashback_pence), p(r.net_pence), r.status, r.reference ?? "",
      r.transfer_state === "failed" ? "No" : "Yes",
    ].map((c) => esc(String(c))).join(","));
    // U+FEFF, so the file opens EF BB BF. The data was always valid UTF-8;
    // without the mark Excel guesses the encoding from the bytes and renders
    // "DEMO — 3 Session Pass", "1× …" and the £ in these very headers as mojibake.
    const csv = "\uFEFF" + [head.join(","), ...lines].join("\n");
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
        {totals.refunds > 0 && <Stat label="Refunds" value={`− ${gbp(totals.refunds)}`} />}
        <Stat label="Platform fees" value={`− ${gbp(totals.fees)}`} />
        <Stat label="Cashback funded" value={`− ${gbp(totals.cashback)}`} />
        <Stat label="Net to you" value={gbp(totals.net)} accent />
      </div>

      {/* Saved with Wallet — commercial, not accounting-heavy. Hidden
          entirely when the benchmark is disabled or there's nothing to
          compare yet, rather than showing a £0.00 that reads as a bug. */}
      {savings && (
        <div className="rounded-card border border-line bg-paper p-4 shadow-soft">
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-faint">Saved with Wallet</p>
          <p className="mt-1 font-display text-2xl font-bold" style={{ color: BIZ }}>{gbp(savings.estimatedSaved)} this period</p>
          <p className="mt-1 text-xs text-ink-faint">
            Estimated against a {(benchmark!.card_percent_bps / 100).toFixed(2)}% card-payment benchmark
            {benchmark!.card_fixed_pence > 0 ? ` + ${gbp(benchmark!.card_fixed_pence)}` : ""} — a configured
            comparison, not your actual card-processing rate.
          </p>
          <div className="mt-3 grid grid-cols-3 gap-3 text-sm">
            <div><p className="text-ink-faint">Wallet sales</p><p className="font-semibold text-ink">{gbp(savings.sales)}</p></div>
            <div><p className="text-ink-faint">Wallet fees</p><p className="font-semibold text-ink">{gbp(savings.walletFees)}</p></div>
            <div><p className="text-ink-faint">Benchmark card fees</p><p className="font-semibold text-ink">{gbp(savings.cardFees)}</p></div>
          </div>
        </div>
      )}

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
                <th className="px-4 py-3 text-right font-bold">Merchant paid</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => {
                // 'failed' is the only transfer_state ever synchronously
                // paired with an automatic reversal — Stripe rejected this
                // transfer outright and it never reached this business,
                // however the stored fee/net figures read. Must never show
                // a fee or a net figure implying the money passed through.
                const failed = r.transfer_state === "failed";
                return (
                  <tr key={i} className="border-b border-line/60 last:border-0">
                    <td className="whitespace-nowrap px-4 py-3 text-ink-soft">{fmtDate(r.occurred_at)}</td>
                    <td className="px-4 py-3">
                      <span className="font-semibold text-ink">{failed ? "Failed wallet payment" : (KIND_LABEL[r.kind] ?? r.kind)}</span>
                      <span className="block text-xs text-ink-faint">
                        {failed
                          ? (r.direction === "in"
                              ? `${gbp(r.gross_pence)} attempted · customer automatically refunded`
                              : `${gbp(Math.abs(r.gross_pence))} automatically refunded · no fee was ever charged`)
                          : r.description}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-ink-soft">{r.counterparty}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-ink">{gbp(r.gross_pence)}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-ink-faint">{failed ? "—" : (r.fee_pence ? `− ${gbp(r.fee_pence)}` : "—")}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-ink-faint">{failed ? "—" : (r.cashback_pence ? `− ${gbp(r.cashback_pence)}` : "—")}</td>
                    <td className={"px-4 py-3 text-right font-semibold tabular-nums " + (failed ? "text-ink-faint" : r.direction === "in" ? "text-emerald-700" : "text-rose-600")}>
                      {failed ? gbp(0)
                        : r.direction === "in" ? gbp(r.net_pence)
                        : r.direction === "refund" ? `− ${gbp(Math.abs(r.net_pence))}`
                        : `− ${gbp(r.gross_pence)}`}
                    </td>
                    <td className={"px-4 py-3 text-right text-xs font-semibold " + (failed ? "text-rose-700" : "text-ink-faint")}>
                      {failed ? "No" : "Yes"}
                    </td>
                  </tr>
                );
              })}
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

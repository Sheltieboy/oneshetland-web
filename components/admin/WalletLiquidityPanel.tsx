"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Card } from "@/components/admin/AdminUI";
import { gbp } from "@/lib/currency";

/**
 * Local Wallet liquidity — admin visibility for the architecture that
 * replaced "debit the customer, hope Stripe can pay the merchant".
 *
 * Mirrors exactly what the Wallet-spend preflight gate itself checks (one
 * canonical read, via the wallet-liquidity-snapshot Edge Function — see
 * supabase/functions/_shared/wallet-liquidity.ts) so this panel and the gate
 * can never disagree about what "available" means.
 */

interface Snapshot {
  enabled: boolean;
  available_pence: number;
  pending_pence: number;
  liability_pence: number;
  reserve_pence: number;
  headroom_pence: number;
  gap_to_reserve_pence: number | null;
  coverage_bps: number | null;
  low_coverage_bps: number;
  critical_coverage_bps: number;
  status: "healthy" | "low" | "critical" | "disabled" | "unknown";
  error?: string;
}

// Representative Wallet till payments, used only to show "how much MORE is
// needed", never to claim a figure is already sufficient. Treated as the
// MERCHANT TRANSFER amount directly (not gross) — the same quantity the
// preflight gate itself checks — so this needs no fee-rate knowledge here.
const EXAMPLE_TRANSFERS_PENCE = [500, 2000, 5000];

const STATUS_STYLE: Record<Snapshot["status"], { label: string; bg: string; fg: string }> = {
  healthy:  { label: "Healthy",  bg: "#dcfce7", fg: "#166534" },
  low:      { label: "Low",      bg: "#fef3c7", fg: "#92400e" },
  critical: { label: "Critical", bg: "#fee2e2", fg: "#991b1b" },
  disabled: { label: "Protection disabled", bg: "#f3f4f6", fg: "#374151" },
  unknown:  { label: "Unreadable", bg: "#fee2e2", fg: "#991b1b" },
};

export function WalletLiquidityPanel() {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const sb = createClient();
        const { data, error: err } = await sb.functions.invoke("wallet-liquidity-snapshot");
        if (cancelled) return;
        if (err || (data as { error?: string })?.error) {
          setError((data as { error?: string })?.error ?? err?.message ?? "Could not load liquidity");
        } else {
          setSnapshot(data as Snapshot);
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Could not load liquidity");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  return (
    <Card>
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-display text-lg font-bold text-ink">Local Wallet liquidity</h2>
        {snapshot && (
          <span
            className="rounded-pill px-3 py-1 text-xs font-bold"
            style={{ background: STATUS_STYLE[snapshot.status].bg, color: STATUS_STYLE[snapshot.status].fg }}
          >
            {STATUS_STYLE[snapshot.status].label}
          </span>
        )}
      </div>
      <p className="mt-1 text-sm text-ink-faint">
        Wallet balances are customer liabilities. OneShetland keeps transferable Stripe funds available so merchants
        can be settled immediately.
      </p>

      {loading ? (
        <p className="mt-4 text-sm text-ink-muted">Loading…</p>
      ) : error ? (
        <p className="mt-4 text-sm text-rose-600">{error}</p>
      ) : snapshot ? (
        <>
          {snapshot.status === "unknown" && (
            <p className="mt-3 rounded-xl bg-rose-50 p-3 text-sm font-semibold text-rose-700">
              Stripe's balance could not be read just now. New Wallet payments are being declined safely until this
              clears.
            </p>
          )}

          {/* Wallet is spendable only once headroom (available − reserve) is
              ABOVE zero by at least the transfer size — reaching the reserve
              itself (gap_to_reserve_pence = 0) still leaves headroom at
              exactly 0, which permits NO transfer. These are deliberately two
              separate numbers, shown as two separate facts, so closing one is
              never read as "Wallet is ready". */}
          {snapshot.status !== "disabled" && snapshot.headroom_pence <= 0 && (
            <p className="mt-3 rounded-xl bg-rose-50 p-3 text-sm font-semibold text-rose-700">
              Wallet transfers are currently blocked — spendable headroom is {gbp(snapshot.headroom_pence)}, so the
              preflight check cannot permit any transfer above £0.00 right now.
              {snapshot.gap_to_reserve_pence !== null && snapshot.gap_to_reserve_pence > 0 && (
                <> Available balance is also {gbp(snapshot.gap_to_reserve_pence)} below the reserve floor — closing
                  that gap alone would only bring headroom to exactly £0.00, still not enough to permit a transfer.</>
              )}
            </p>
          )}
          {snapshot.status !== "disabled" && snapshot.gap_to_reserve_pence !== null && snapshot.gap_to_reserve_pence > 0 && snapshot.headroom_pence > 0 && (
            <p className="mt-3 rounded-xl bg-amber-50 p-3 text-sm font-semibold text-amber-800">
              Initial Wallet float required before launch — available balance is {gbp(snapshot.gap_to_reserve_pence)}{" "}
              below the configured reserve floor.
            </p>
          )}

          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="Customer Wallet liability" value={gbp(snapshot.liability_pence)} />
            <Stat label="Stripe available" value={gbp(snapshot.available_pence)} />
            <Stat label="Stripe pending" value={gbp(snapshot.pending_pence)} />
            <Stat label="Reserve target" value={gbp(snapshot.reserve_pence)} />
            <Stat
              label="Gap to reserve"
              value={snapshot.gap_to_reserve_pence === null ? "—" : gbp(snapshot.gap_to_reserve_pence)}
              hint="How far below the reserve floor available balance sits. Closing this to £0 does not permit any transfer."
            />
            <Stat
              label="Spendable headroom"
              value={gbp(snapshot.headroom_pence)}
              accent={snapshot.headroom_pence <= 0}
              hint="Available − reserve. Must exceed £0 by at least a transfer's size before that transfer can be permitted."
            />
            <Stat label="Coverage" value={snapshot.coverage_bps === null ? "—" : `${(snapshot.coverage_bps / 100).toFixed(0)}%`} />
          </div>

          <div className="mt-4 rounded-xl border border-line bg-paper p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-faint">Additional float needed to permit a transfer</p>
            <p className="mt-1 text-xs text-ink-faint">
              Reaching the reserve alone is never enough — a transfer also needs headroom for its own size. Figures
              below are illustrative transfer amounts, not gross payment amounts.
            </p>
            <div className="mt-2 grid grid-cols-3 gap-3">
              {EXAMPLE_TRANSFERS_PENCE.map((transferPence) => {
                const needed = Math.max(0, snapshot.reserve_pence + transferPence - snapshot.available_pence);
                return (
                  <div key={transferPence}>
                    <p className="text-xs text-ink-faint">For a {gbp(transferPence)} transfer</p>
                    <p className={"font-display text-base font-bold " + (needed > 0 ? "text-rose-600" : "text-ink")}>
                      {needed > 0 ? `+${gbp(needed)} needed` : "Already covered"}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>

          <p className="mt-3 text-xs text-ink-faint">
            Low below {(snapshot.low_coverage_bps / 100).toFixed(0)}% coverage · Critical below{" "}
            {(snapshot.critical_coverage_bps / 100).toFixed(0)}%. {snapshot.status === "disabled"
              ? "Liquidity protection is currently disabled in Admin Configuration — Wallet payments rely on the automatic reversal only."
              : "Below Critical, the preflight check declines new Wallet payments calmly, before the customer is debited."}
          </p>
        </>
      ) : null}
    </Card>
  );
}

function Stat({ label, value, accent, hint }: { label: string; value: string; accent?: boolean; hint?: string }) {
  return (
    <div className="rounded-xl border border-line bg-paper p-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-ink-faint">{label}</p>
      <p className={"mt-1 font-display text-lg font-bold " + (accent ? "text-rose-600" : "text-ink")}>{value}</p>
      {hint && <p className="mt-1 text-[11px] leading-tight text-ink-faint">{hint}</p>}
    </div>
  );
}

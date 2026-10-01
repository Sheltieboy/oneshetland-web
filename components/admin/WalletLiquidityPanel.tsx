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
  coverage_bps: number | null;
  low_coverage_bps: number;
  critical_coverage_bps: number;
  status: "healthy" | "low" | "critical" | "disabled" | "unknown";
  error?: string;
}

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
          {snapshot.available_pence < snapshot.reserve_pence && snapshot.status !== "disabled" && (
            <p className="mt-3 rounded-xl bg-amber-50 p-3 text-sm font-semibold text-amber-800">
              Initial Wallet float required before launch — available balance is below the configured reserve by{" "}
              {gbp(snapshot.reserve_pence - snapshot.available_pence)}.
            </p>
          )}
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="Customer Wallet liability" value={gbp(snapshot.liability_pence)} />
            <Stat label="Stripe available" value={gbp(snapshot.available_pence)} />
            <Stat label="Stripe pending" value={gbp(snapshot.pending_pence)} />
            <Stat label="Reserve target" value={gbp(snapshot.reserve_pence)} />
            <Stat label="Spendable headroom" value={gbp(snapshot.headroom_pence)} accent={snapshot.headroom_pence < 0} />
            <Stat label="Coverage" value={snapshot.coverage_bps === null ? "—" : `${(snapshot.coverage_bps / 100).toFixed(0)}%`} />
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

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="rounded-xl border border-line bg-paper p-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-ink-faint">{label}</p>
      <p className={"mt-1 font-display text-lg font-bold " + (accent ? "text-rose-600" : "text-ink")}>{value}</p>
    </div>
  );
}

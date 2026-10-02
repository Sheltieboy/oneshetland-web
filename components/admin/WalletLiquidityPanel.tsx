"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Card } from "@/components/admin/AdminUI";
import { useConfirm } from "@/components/ui/ConfirmProvider";
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

interface Topup {
  id: string;
  stripe_topup_id: string | null;
  amount_pence: number;
  status: string;
  reserve_target_pence: number;
  desired_headroom_pence: number;
  failure_message: string | null;
  expected_availability_date: string | null;
  created_at: string;
  updated_at: string;
}

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
  desired_headroom_pence: number;
  recommended_funding_pence: number | null;
  funding_enabled: boolean;
  status: "healthy" | "low" | "critical" | "disabled" | "unknown";
  error?: string;
  recent_topups: Topup[];
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

const TOPUP_STATUS_LABEL: Record<string, string> = {
  creating: "Creating…",
  pending: "Pending with Stripe",
  succeeded: "Succeeded",
  failed: "Failed",
  canceled: "Cancelled",
  reversed: "Reversed",
  error: "Error",
};

export function WalletLiquidityPanel() {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const sb = createClient();
      const { data, error: err } = await sb.functions.invoke("wallet-liquidity-snapshot");
      if (err || (data as { error?: string })?.error) {
        setError((data as { error?: string })?.error ?? err?.message ?? "Could not load liquidity");
      } else {
        setSnapshot(data as Snapshot);
        setError(null);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load liquidity");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

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
            <Stat
              label="Recommended funding"
              value={snapshot.recommended_funding_pence === null ? "—" : gbp(snapshot.recommended_funding_pence)}
              accent={!!snapshot.recommended_funding_pence}
              hint={`Targets reserve (${gbp(snapshot.reserve_pence)}) + desired headroom (${gbp(snapshot.desired_headroom_pence)}) together — reaching the reserve alone is not the goal.`}
            />
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

          <FundingSection snapshot={snapshot} onFunded={load} />

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

/**
 * Fund Wallet reserve — platform working capital only, never customer
 * Wallet credit. If wallet.liquidity.funding_enabled is false (the current
 * production setting — a live capability check found no bank-account
 * source and no topup capability flag on this account, but could not prove
 * either way without a real POST), this shows Stripe Dashboard funding
 * instructions instead of a live action. It never fakes the action.
 */
function FundingSection({ snapshot, onFunded }: { snapshot: Snapshot; onFunded: () => void }) {
  const confirm = useConfirm();
  const [amountInput, setAmountInput] = useState(
    snapshot.recommended_funding_pence ? (snapshot.recommended_funding_pence / 100).toFixed(2) : "",
  );
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  // One id per attempt, not per click — a double-tap of the same button reuses
  // the SAME client_request_id, so the server's unique constraint (and
  // Stripe's own Idempotency-Key) catch it as a replay, never a second Topup.
  // It is replaced only after the server DEFINITIVELY refused the attempt (an
  // HTTP error body): that attempt's row is dead, and reusing its id would
  // replay the failure forever instead of reaching Stripe again.
  const [requestId, setRequestId] = useState(() => crypto.randomUUID());

  async function fund() {
    const pence = Math.round(parseFloat(amountInput) * 100);
    if (!Number.isFinite(pence) || pence <= 0) { setSubmitError("Enter a valid amount."); return; }
    const ok = await confirm({
      title: "Fund Wallet reserve?",
      body: `This creates a real Stripe Topup for ${gbp(pence)} of OneShetland's own platform working capital. ` +
        "It does not credit any customer's Wallet balance and cannot be undone once Stripe accepts it.",
      confirmLabel: `Fund ${gbp(pence)}`,
      danger: true,
    });
    if (!ok) return;
    setSubmitting(true); setSubmitError(null);
    try {
      const sb = createClient();
      const { data, error } = await sb.functions.invoke("wallet-liquidity-fund", {
        body: { amount_pence: pence, client_request_id: requestId },
      });
      let body = data as { error?: string } | null;
      let refused = !!body?.error;
      if (error && (error as { name?: string }).name === "FunctionsHttpError") {
        refused = true;
        body = await ((error as unknown as { context?: Response }).context?.json?.() ?? Promise.resolve(null))
          .catch(() => null);
      }
      if (error || body?.error) {
        if (refused) setRequestId(crypto.randomUUID());
        setSubmitError(body?.error ?? error?.message ?? "Could not start funding.");
        return;
      }
      onFunded();
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : "Could not start funding.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mt-4 rounded-xl border border-line bg-paper p-4">
      <h3 className="font-display text-base font-bold text-ink">Fund Wallet reserve</h3>

      {snapshot.funding_enabled ? (
        <>
          <p className="mt-1 text-xs text-ink-faint">
            Creates a real Stripe Topup of OneShetland's own platform working capital — not customer Wallet credit.
          </p>
          <div className="mt-3 flex flex-wrap items-end gap-3">
            <label className="text-sm">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-ink-faint">Amount (£)</span>
              <input
                type="number" min="10" max="1000" step="0.01"
                value={amountInput}
                onChange={(e) => setAmountInput(e.target.value)}
                disabled={submitting}
                className="w-32 rounded-lg border border-line px-3 py-2 text-sm"
              />
            </label>
            <button
              onClick={fund}
              disabled={submitting}
              className="rounded-pill px-4 py-2 text-sm font-bold text-paper disabled:opacity-50"
              style={{ background: "#991b1b" }}
            >
              {submitting ? "Starting…" : "Fund Wallet reserve"}
            </button>
          </div>
          {submitError && <p className="mt-2 text-sm text-rose-600">{submitError}</p>}
        </>
      ) : (
        // The fallback — never a fake/dead action. Stated plainly, with the
        // exact amount and a direct path to do it manually in Stripe.
        <div className="mt-2 rounded-lg bg-amber-50 p-3">
          <p className="text-sm font-semibold text-amber-900">Funding must currently be completed in Stripe</p>
          <p className="mt-1 text-sm text-amber-800">
            {snapshot.recommended_funding_pence
              ? `Recommended: ${gbp(snapshot.recommended_funding_pence)}, to bring available balance up to the reserve (${gbp(snapshot.reserve_pence)}) plus the desired operating headroom (${gbp(snapshot.desired_headroom_pence)}).`
              : "Available balance already covers the reserve and desired headroom — no funding needed right now."}
          </p>
          <p className="mt-2 text-xs text-amber-800">
            Add funds specifically for Connect transfers / the platform's transferable balance — not a customer
            refund or a business payout. This panel updates automatically once Stripe reports the funds available.
          </p>
          <a
            href="https://dashboard.stripe.com/balance/overview"
            target="_blank" rel="noreferrer"
            className="mt-2 inline-block rounded-pill border border-amber-300 bg-paper px-3 py-1.5 text-xs font-bold text-amber-900 hover:bg-amber-100"
          >
            Open Stripe Dashboard →
          </a>
        </div>
      )}

      {snapshot.recent_topups.length > 0 && (
        <div className="mt-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-faint">Pending / recent funding</p>
          <div className="mt-2 divide-y divide-line">
            {snapshot.recent_topups.map((t) => (
              <div key={t.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                <div>
                  <p className="font-semibold text-ink">{gbp(t.amount_pence)} · {TOPUP_STATUS_LABEL[t.status] ?? t.status}</p>
                  <p className="text-xs text-ink-faint">
                    {t.stripe_topup_id ?? "no Stripe id yet"} · created {new Date(t.created_at).toLocaleDateString("en-GB")}
                    {t.expected_availability_date && ` · expected available ${t.expected_availability_date}`}
                  </p>
                  {t.failure_message && <p className="text-xs text-rose-600">{t.failure_message}</p>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
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

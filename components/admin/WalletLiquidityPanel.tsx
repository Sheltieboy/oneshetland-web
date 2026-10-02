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

interface FundingSession {
  id: string;
  requested_amount_pence: number;
  target_available_pence: number;
  baseline_available_pence: number;
  status: "awaiting_funds" | "pending_at_stripe" | "available" | "expired" | "cancelled" | "failed";
  received_amount_pence: number | null;
  resolution_note: string | null;
  created_at: string;
  updated_at: string;
}

interface FundingDetails {
  beneficiary: string;
  account_number: string;
  sort_code: string;
  instructions: string | null;
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
  funding_sessions: FundingSession[];
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
 * production setting — Stripe offers this account only a push bank transfer
 * for the Payments balance, not a linked-bank debit Topup), this shows the
 * push-transfer workflow instead of a live Stripe action. It never fakes it.
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
        // Routine funding: a push bank transfer from the business bank,
        // tracked and recognised by OneShetland. No Stripe Dashboard needed.
        <PushFunding snapshot={snapshot} onChanged={onFunded} />
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

const SESSION_LABEL: Record<FundingSession["status"], string> = {
  awaiting_funds: "Awaiting funds",
  pending_at_stripe: "Received by Stripe — pending",
  available: "Funded",
  expired: "Unresolved",
  cancelled: "Cancelled",
  failed: "Failed",
};

interface InvokeResult<T> { data: T | null; error: string | null; refused: boolean }

async function invokeAdmin<T>(fn: string, body: Record<string, unknown>): Promise<InvokeResult<T>> {
  try {
    const sb = createClient();
    const { data, error } = await sb.functions.invoke(fn, { body });
    let payload = data as (T & { error?: string }) | null;
    let refused = !!payload?.error;
    if (error && (error as { name?: string }).name === "FunctionsHttpError") {
      refused = true;
      payload = await ((error as unknown as { context?: Response }).context?.json?.() ?? Promise.resolve(null))
        .catch(() => null);
    }
    if (error || payload?.error) {
      return { data: null, error: payload?.error ?? error?.message ?? "Request failed.", refused };
    }
    return { data: payload, error: null, refused: false };
  } catch (e) {
    return { data: null, error: e instanceof Error ? e.message : "Request failed.", refused: false };
  }
}

/**
 * Push-transfer funding. Stripe offers this platform only "Transfer from your
 * bank" (FPS / BACS) for the Payments balance, so the operator sends the money
 * from the business bank; OneShetland works out the amount, shows the
 * beneficiary details (platform-admin only), and recognises the money when it
 * reaches Stripe.
 *
 * ORDER MATTERS. Arrival is matched only against Stripe credits created at or
 * after the funding session, so the session must exist BEFORE the bank
 * transfer is sent:
 *
 *   1. StartSessionView  — review amount and details; "Start funding transfer"
 *                          records the session. NO send instruction, NO copy
 *                          buttons here: nothing invites sending money yet.
 *   2. ActiveSessionView — the frozen exact amount and details with copy
 *                          buttons, and only now "Now send exactly £X".
 *   3. Stripe arrival is reconciled server-side against that session.
 *
 * Nothing here moves money.
 */
function PushFunding({ snapshot, onChanged }: { snapshot: Snapshot; onChanged: () => void }) {
  const sessions = snapshot.funding_sessions ?? [];
  const open = sessions.find((s) => s.status === "awaiting_funds" || s.status === "pending_at_stripe") ?? null;
  const latest = sessions[0] ?? null;

  return (
    <div className="mt-2 space-y-3">
      <SessionBanner session={open ?? latest} open={!!open} snapshot={snapshot} />

      {open ? (
        <ActiveSessionView session={open} snapshot={snapshot} onChanged={onChanged} />
      ) : (
        <StartSessionView snapshot={snapshot} onChanged={onChanged} />
      )}

      {sessions.length > 0 && (
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-faint">Funding transfers</p>
          <div className="mt-1 divide-y divide-line">
            {sessions.map((s) => (
              <div key={s.id} className="py-2 text-sm">
                <p className="font-semibold text-ink">{gbp(s.requested_amount_pence)} · {SESSION_LABEL[s.status]}</p>
                <p className="text-xs text-ink-faint">
                  started {new Date(s.created_at).toLocaleDateString("en-GB")}
                  {s.received_amount_pence !== null && ` · received ${gbp(s.received_amount_pence)}`}
                </p>
                {s.resolution_note && <p className="text-xs text-ink-faint">{s.resolution_note}</p>}
              </div>
            ))}
          </div>
        </div>
      )}

      <p className="text-[11px] text-ink-faint">
        For troubleshooting only:{" "}
        <a href="https://dashboard.stripe.com/balance/overview" target="_blank" rel="noreferrer" className="underline">
          View in Stripe
        </a>
      </p>
    </div>
  );
}

/** Step 1 — no session yet. Review, then start. Deliberately offers no send instruction and no copy buttons. */
function StartSessionView({ snapshot, onChanged }: { snapshot: Snapshot; onChanged: () => void }) {
  const confirm = useConfirm();
  const recommended = snapshot.recommended_funding_pence;
  const [amountInput, setAmountInput] = useState(recommended ? (recommended / 100).toFixed(2) : "");
  const [detailsConfigured, setDetailsConfigured] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [requestId, setRequestId] = useState(() => crypto.randomUUID());

  const amountPence = Math.round(parseFloat(amountInput) * 100);
  const targetAvailable = snapshot.reserve_pence + snapshot.desired_headroom_pence;
  const validAmount = Number.isFinite(amountPence) && amountPence > 0;

  async function startSession() {
    if (!validAmount) { setErr("Enter a valid amount."); return; }
    const ok = await confirm({
      title: "Start funding transfer?",
      body: "This records the transfer in OneShetland. No money is moved yet. You will then be shown the exact " +
        `amount (${gbp(amountPence)}) and the bank details to send it to.`,
      confirmLabel: "Start funding transfer",
    });
    if (!ok) return;
    setBusy(true); setErr(null);
    const r = await invokeAdmin("wallet-liquidity-funding-session", {
      action: "start", requested_amount_pence: amountPence, client_request_id: requestId,
    });
    setBusy(false);
    if (r.error) { if (r.refused) setRequestId(crypto.randomUUID()); setErr(r.error); return; }
    setRequestId(crypto.randomUUID());
    onChanged();
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        <MiniStat label="Recommended transfer" value={recommended === null ? "—" : gbp(recommended)} strong />
        <MiniStat label="Target available balance" value={gbp(targetAvailable)} />
        <MiniStat label="Current available" value={gbp(snapshot.available_pence)} />
        <MiniStat label="Reserve" value={gbp(snapshot.reserve_pence)} />
        <MiniStat label="Desired headroom" value={gbp(snapshot.desired_headroom_pence)} />
        <MiniStat label="Wallet status" value={STATUS_STYLE[snapshot.status].label} />
      </div>

      {recommended === 0 ? (
        <p className="rounded-lg bg-emerald-50 p-3 text-sm font-semibold text-emerald-800">
          Available balance already covers the reserve and desired headroom — no funding needed right now.
        </p>
      ) : (
        <>
          <p className="rounded-lg bg-amber-50 p-3 text-sm font-semibold text-amber-900">
            Do not send any money yet. Start the funding transfer first — OneShetland can only recognise money that
            reaches Stripe after the transfer has been started.
          </p>
          <div className="flex flex-wrap items-end gap-3">
            <label className="text-sm">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-ink-faint">Amount to fund (£)</span>
              <input
                type="number" min="10" step="0.01" value={amountInput}
                onChange={(e) => setAmountInput(e.target.value)} disabled={busy}
                className="w-36 rounded-lg border border-line px-3 py-2 text-sm"
              />
            </label>
            <button
              onClick={startSession} disabled={busy || !validAmount || detailsConfigured === false}
              className="rounded-pill px-4 py-2 text-sm font-bold text-paper disabled:opacity-50"
              style={{ background: "#166534" }}
            >
              {busy ? "Starting…" : "Start funding transfer"}
            </button>
          </div>
          {detailsConfigured === false && (
            <p className="text-xs text-ink-faint">Enter the Stripe funding bank details below first.</p>
          )}
        </>
      )}
      {err && <p className="text-sm text-rose-600">{err}</p>}

      <FundingDetailsBlock copyable={false} canEdit onConfiguredChange={setDetailsConfigured} />
    </div>
  );
}

/** Steps 2–3 — a session exists. Frozen amount + details; only now is the user told to send money. */
function ActiveSessionView({ session, snapshot, onChanged }: { session: FundingSession; snapshot: Snapshot; onChanged: () => void }) {
  const confirm = useConfirm();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function cancelSession() {
    const ok = await confirm({
      title: "Cancel this funding transfer?",
      body: "Use this only if you have NOT sent the transfer. It does not recall money already sent.",
      confirmLabel: "Cancel funding transfer",
      danger: true,
    });
    if (!ok) return;
    setBusy(true); setErr(null);
    const r = await invokeAdmin("wallet-liquidity-funding-session", { action: "cancel", session_id: session.id });
    setBusy(false);
    if (r.error) { setErr(r.error); return; }
    onChanged();
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        <MiniStat label="Exact amount to send" value={gbp(session.requested_amount_pence)} strong />
        <MiniStat label="Transfer started" value={new Date(session.created_at).toLocaleString("en-GB")} />
        <MiniStat label="Target available balance" value={gbp(session.target_available_pence)} />
        <MiniStat label="Available when started" value={gbp(session.baseline_available_pence)} />
        <MiniStat label="Current available" value={gbp(snapshot.available_pence)} />
        <MiniStat label="Wallet status" value={STATUS_STYLE[snapshot.status].label} />
      </div>

      {session.status === "awaiting_funds" ? (
        <>
          <div className="rounded-lg border-2 border-emerald-600 bg-emerald-50 p-3">
            <p className="text-sm font-bold text-emerald-900">
              Now send exactly {gbp(session.requested_amount_pence)} from the OneShetland business bank using FPS/BACS.
            </p>
            <p className="mt-1 text-xs text-emerald-900">
              FPS normally arrives faster (about 2 hours); BACS may take 2–3 business days. Send exactly this amount —
              OneShetland recognises the transfer by its amount, and watches Stripe automatically.
            </p>
            <div className="mt-2">
              <CopyButton label="Copy amount" value={(session.requested_amount_pence / 100).toFixed(2)} />
            </div>
          </div>
          <FundingDetailsBlock copyable canEdit={false} />
          <button
            onClick={cancelSession} disabled={busy}
            className="text-xs font-semibold text-rose-700 underline disabled:opacity-50"
          >
            I haven't sent it — cancel this funding transfer
          </button>
        </>
      ) : (
        <p className="rounded-lg border border-line p-3 text-sm text-ink-muted">
          Stripe has received {gbp(session.received_amount_pence ?? session.requested_amount_pence)}. Do not send it
          again — this page updates when it becomes available.
        </p>
      )}
      {err && <p className="text-sm text-rose-600">{err}</p>}
    </div>
  );
}

function SessionBanner({ session, open, snapshot }: { session: FundingSession | null; open: boolean; snapshot: Snapshot }) {
  if (!session) return null;
  if (session.status === "awaiting_funds") {
    return (
      <p className="rounded-lg bg-amber-50 p-3 text-sm font-semibold text-amber-900">
        {gbp(session.requested_amount_pence)} funding transfer awaiting Stripe
      </p>
    );
  }
  if (session.status === "pending_at_stripe") {
    return (
      <p className="rounded-lg bg-amber-50 p-3 text-sm font-semibold text-amber-900">
        Received by Stripe — pending availability
        <span className="block text-xs font-normal">
          {gbp(session.received_amount_pence ?? session.requested_amount_pence)} has reached Stripe but is not yet
          transferable. Wallet protection still treats it as unavailable.
        </span>
      </p>
    );
  }
  if (session.status === "available" && !open) {
    return (
      <div className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-900">
        <p className="font-semibold">Reserve funded</p>
        <p>Spendable headroom: {gbp(snapshot.headroom_pence)}</p>
        <p>Wallet status: {STATUS_STYLE[snapshot.status].label}</p>
      </div>
    );
  }
  if (session.status === "expired" || session.status === "failed") {
    return (
      <p className="rounded-lg bg-rose-50 p-3 text-sm font-semibold text-rose-700">
        {session.status === "expired" ? "Funding transfer unresolved" : "Funding transfer failed"}
        <span className="block text-xs font-normal">{session.resolution_note}</span>
      </p>
    );
  }
  return null;
}

function MiniStat({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="rounded-lg border border-line bg-paper p-2">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-faint">{label}</p>
      <p className={"font-display font-bold text-ink " + (strong ? "text-lg" : "text-base")}>{value}</p>
    </div>
  );
}

function CopyButton({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch { /* clipboard unavailable — the value is visible to copy by hand */ }
  }
  return (
    <button
      type="button" onClick={copy} disabled={!value}
      className="rounded-pill border border-line bg-paper px-3 py-1.5 text-xs font-bold text-ink hover:bg-surface disabled:opacity-40"
    >
      {copied ? "Copied" : label}
    </button>
  );
}

const fmtSortCode = (sc: string) => sc.replace(/^(\d{2})(\d{2})(\d{2})$/, "$1-$2-$3");

/** Stripe's push-funding beneficiary details. Platform-admin only, fetched on demand, never logged. */
function FundingDetailsBlock({ copyable, canEdit, onConfiguredChange }: {
  copyable: boolean; canEdit: boolean; onConfiguredChange?: (configured: boolean) => void;
}) {
  const [details, setDetails] = useState<FundingDetails | null>(null);
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ beneficiary: "", account_number: "", sort_code: "", instructions: "" });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    const r = await invokeAdmin<{ configured: boolean; details: FundingDetails | null }>("wallet-funding-details", { action: "get" });
    if (r.error || !r.data) { setErr(r.error ?? "Could not load the funding details."); return; }
    setConfigured(r.data.configured);
    setDetails(r.data.details);
    onConfiguredChange?.(r.data.configured);
    if (!r.data.configured) setEditing(true);
  }, [onConfiguredChange]);
  useEffect(() => { load(); }, [load]);

  function startEdit() {
    setForm({
      beneficiary: details?.beneficiary ?? "", account_number: details?.account_number ?? "",
      sort_code: details ? fmtSortCode(details.sort_code) : "", instructions: details?.instructions ?? "",
    });
    setEditing(true);
  }

  async function save() {
    setSaving(true); setErr(null);
    const r = await invokeAdmin<{ configured: boolean; details: FundingDetails }>("wallet-funding-details", { action: "set", ...form });
    setSaving(false);
    if (r.error || !r.data) { setErr(r.error ?? "Could not save."); return; }
    setDetails(r.data.details); setConfigured(true); setEditing(false);
    onConfiguredChange?.(true);
  }

  return (
    <div className="rounded-lg border border-line p-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-ink-faint">Stripe funding bank details</p>
      {configured === null && !err ? (
        <p className="mt-1 text-sm text-ink-muted">Loading…</p>
      ) : editing ? (
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          {!configured && (
            <p className="text-xs text-ink-faint sm:col-span-2">
              Enter the bank details Stripe shows under Balances → Add funds → Payments balance → “Transfer from your
              bank”. Stripe has no API for these, so they are entered once here. Only platform admins can see them.
            </p>
          )}
          <Field label="Beneficiary" value={form.beneficiary} onChange={(v) => setForm({ ...form, beneficiary: v })} />
          <Field label="Account number" value={form.account_number} onChange={(v) => setForm({ ...form, account_number: v })} />
          <Field label="Sort code" value={form.sort_code} onChange={(v) => setForm({ ...form, sort_code: v })} />
          <Field label="Payment instructions (optional)" value={form.instructions} onChange={(v) => setForm({ ...form, instructions: v })} />
          <div className="flex gap-2 sm:col-span-2">
            <button onClick={save} disabled={saving} className="rounded-pill bg-ink px-4 py-1.5 text-xs font-bold text-paper disabled:opacity-50">
              {saving ? "Saving…" : "Save details"}
            </button>
            {configured && (
              <button onClick={() => setEditing(false)} disabled={saving} className="text-xs font-semibold underline">Cancel</button>
            )}
          </div>
        </div>
      ) : details ? (
        <div className="mt-2 space-y-2 text-sm">
          <DetailRow label="Beneficiary" value={details.beneficiary} copyLabel="Copy beneficiary" copyable={copyable} />
          <DetailRow label="Account number" value={details.account_number} copyLabel="Copy account number" copyable={copyable} />
          <DetailRow label="Sort code" value={fmtSortCode(details.sort_code)} copyValue={details.sort_code} copyLabel="Copy sort code" copyable={copyable} />
          {details.instructions && <p className="text-xs text-ink-muted">{details.instructions}</p>}
          {canEdit && <button onClick={startEdit} className="text-xs font-semibold underline">Edit details</button>}
        </div>
      ) : null}
      {err && <p className="mt-2 text-sm text-rose-600">{err}</p>}
    </div>
  );
}

function DetailRow({ label, value, copyLabel, copyValue, copyable }: { label: string; value: string; copyLabel: string; copyValue?: string; copyable: boolean }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-faint">{label}</p>
        <p className="font-mono text-sm font-semibold text-ink">{value}</p>
      </div>
      {copyable && <CopyButton label={copyLabel} value={copyValue ?? value} />}
    </div>
  );
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="text-sm">
      <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-ink-faint">{label}</span>
      <input
        value={value} onChange={(e) => onChange(e.target.value)} autoComplete="off"
        className="w-full rounded-lg border border-line px-3 py-2 text-sm"
      />
    </label>
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

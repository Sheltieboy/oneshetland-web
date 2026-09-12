"use client";

import { createContext, useContext, useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "@/components/ui/Modal";
import { createClient } from "@/lib/supabase/client";
import { respondToCharge } from "@/lib/member-card-client";
import { gbp } from "@/lib/currency";

/**
 * ChargeApprovalListener — mounted once, wrapping the whole authenticated
 * layout. When a business sends this signed-in customer a Wallet charge
 * request (wallet_charge_requests INSERT), this pops the consent prompt so
 * they can Approve or Decline. No money moves without their tap.
 *
 * Realtime INSERT alone is not a reliable way to notice a request: a
 * backgrounded tab, a laptop that slept, or a socket that quietly dropped can
 * all mean the INSERT is never seen, with nothing to say so — the tab just
 * looks normal. So this also re-checks for a still-pending request whenever
 * the page becomes visible again or the window regains focus, in addition to
 * the realtime subscription and the one-off check on mount (which alone only
 * covers a request that already existed at load/refresh time). None of this
 * is a second financial state machine — every check reads the same
 * wallet_charge_requests row via the same RLS-scoped query, and approval
 * still goes through the one existing wallet-charge-approve endpoint.
 *
 * If the customer closes the pop-up instead of deciding, the request is not
 * lost: it stays known to this component (just hidden), and `usePendingCharge`
 * — read by the wallet page — can show a "review it" card and bring the
 * pop-up back with `reopen()`. Only Decline talks to the server; closing
 * never changes money state.
 */

interface ActiveRequest {
  id: string;
  businessId: string;
  businessName: string;
  amountPence: number;
  expiresAt: number; // epoch ms
}

type Row = { id: string; business_id: string; amount_pence: number; expires_at: string; status: string };

interface PendingSummary {
  businessName: string;
  amountPence: number;
}

const Ctx = createContext<{ pending: PendingSummary | null; reopen: () => void } | null>(null);

/**
 * Anywhere below <ChargeApprovalListener>: whether a payment request is
 * currently waiting on this customer (even if they dismissed the pop-up),
 * and a way to bring the approval pop-up back. Used by the wallet page to
 * show a persistent "you have a pending payment request" card — the
 * recovery path for a customer who closed the pop-up instead of acting on it.
 */
export function usePendingCharge() {
  const c = useContext(Ctx);
  if (!c) throw new Error("usePendingCharge must be used within ChargeApprovalListener");
  return c;
}

const ACCENT = "#0e7490";
const DANGER = "#e11d48";

/**
 * The states this pop-up distinguishes for the customer:
 *   ask       — a request is waiting on their decision
 *   working   — Approve/Decline is in flight
 *   succeeded — the wallet debit went through; this is the ONLY state that
 *               may say the payment is complete
 *   failed    — an approve attempt did not go through (declined card,
 *               insufficient funds, a transfer failure) — never rendered as
 *               success
 *   declined  — the customer chose Decline; nothing was ever charged
 *
 * "ask" is also the only phase in which a merchant cancellation or expiry is
 * allowed to silently close the request (see dismissIfSettledElsewhere) — a
 * customer who has moved past "ask" already has their own definitive answer
 * and must never have it snatched away by a realtime event arriving late.
 */
type Phase = "ask" | "working" | "succeeded" | "failed" | "declined";

interface Outcome {
  text: string;
  balancePence?: number;
  cashbackPence?: number;
}

export function ChargeApprovalListener({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [req, setReq] = useState<ActiveRequest | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [phase, setPhase] = useState<Phase>("ask");
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [secsLeft, setSecsLeft] = useState(0);

  // Read from the long-lived visibility/focus listeners below without
  // making them resubscribe every time phase/req change.
  const phaseRef = useRef(phase);
  useEffect(() => { phaseRef.current = phase; }, [phase]);
  const reqRef = useRef(req);
  useEffect(() => { reqRef.current = req; }, [req]);

  // Turn a raw request row into an ActiveRequest (fetching the business name).
  const activate = useCallback(async (row: Row) => {
    if (row.status !== "pending") return;
    const expiresAt = new Date(row.expires_at).getTime();
    if (expiresAt < Date.now()) return;
    // Already showing exactly this request — a visibility re-check finding
    // the same still-pending row must not restart its countdown or clear a
    // decision already in flight.
    if (reqRef.current?.id === row.id) return;
    const sb = createClient();
    const { data: biz } = await sb.from("local_businesses").select("name").eq("id", row.business_id).maybeSingle();
    setReq({
      id: row.id,
      businessId: row.business_id,
      businessName: (biz as { name?: string } | null)?.name ?? "A business",
      amountPence: row.amount_pence,
      expiresAt,
    });
    setDismissed(false);
    setPhase("ask");
    setOutcome(null);
  }, []);

  const checkPending = useCallback(async (uid: string) => {
    const sb = createClient();
    const { data: pending } = await sb
      .from("wallet_charge_requests")
      .select("id, business_id, amount_pence, expires_at, status")
      .eq("customer_id", uid).eq("status", "pending")
      .order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (pending) await activate(pending as Row);
  }, [activate]);

  /**
   * The merchant cancelled (status -> 'cancelled'), or the request otherwise
   * left 'pending' — expired, for instance — while this customer had it open
   * or merely pending in the background.
   *
   * "working", "succeeded" and "declined" are fully protected: once the
   * customer has an answer in flight or landed, nothing here may touch `req`
   * again. "succeeded" in particular guards against the request's own final
   * "paid" UPDATE — the very same realtime event this effect subscribes to —
   * arriving AFTER respondToCharge() already resolved locally and flipped
   * phase to "succeeded". Without that guard, the trailing UPDATE would clear
   * `req` a moment later and close the modal (open={!!req}) on top of the
   * success screen — the "modal just disappeared, no confirmation" defect a
   * live customer hit.
   *
   * "ask" and "failed" are NOT fully protected, and deliberately so:
   *   - "ask": a merchant cancel/expiry while the customer is still deciding
   *     must dismiss the request — always has.
   *   - "failed": unlike "succeeded", a local "failed" phase does not mean
   *     THIS row is settled. respondToCharge() throws for two different
   *     reasons — the server said no (already cancelled/expired/claimed, a
   *     structured 409/410 — genuinely terminal), or a transport failure
   *     (dropped connection, timeout) where the request may still be exactly
   *     as pending as before the tap, or — the case this specifically
   *     guards against — the charge actually completed and only the
   *     response back to this browser was lost. A "failed" phase must stay
   *     open to being corrected by the row's real state: a customer who hit
   *     a network blip must not be stuck looking at a stale "please try
   *     again" for a request the merchant has since cancelled, and must
   *     never be left with a silently-vanishing pop-up if the row turns out
   *     to actually be paid — that would be this exact defect happening
   *     again, just reached via "failed" instead of "working".
   *
   * Money safety never depended on any of this either way: an Approve tap
   * always gets its definitive answer from wallet-charge-approve's own
   * response (when that response arrives at all), regardless of what this
   * effect does.
   */
  const dismissIfSettledElsewhere = useCallback((row: Row) => {
    if (row.status === "pending") return;
    const phase = phaseRef.current;
    if (phase === "working" || phase === "succeeded" || phase === "declined") return;
    const current = reqRef.current;
    if (!current || current.id !== row.id) return;

    if (phase === "failed" && row.status === "paid") {
      // The one case where "failed" must not simply dismiss: the charge did
      // go through, just the confirmation didn't reach us. Show success —
      // never silence — matching the rule that a customer must never have
      // to infer the outcome from the pop-up closing.
      setOutcome({ text: `Paid ${gbp(row.amount_pence)} to ${current.businessName}.` });
      setPhase("succeeded");
      setDismissed(false);
      return;
    }

    setReq(null);
    setDismissed(false);
  }, []);

  // Subscribe to new/updated requests aimed at me, catch any already pending
  // on load, and re-check whenever the tab comes back — realtime alone can
  // silently miss an event on a backgrounded or sleeping tab.
  useEffect(() => {
    const sb = createClient();
    let channel: ReturnType<typeof sb.channel> | null = null;
    let cancelled = false;
    let uid = "";

    (async () => {
      const { data: auth } = await sb.auth.getUser();
      const authedUid = auth.user?.id;
      if (!authedUid || cancelled) return;
      uid = authedUid;

      await checkPending(uid);

      channel = sb
        .channel(`charge-approvals-${uid}`)
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "wallet_charge_requests", filter: `customer_id=eq.${uid}` },
          (payload) => { void activate(payload.new as Row); },
        )
        .on(
          "postgres_changes",
          { event: "UPDATE", schema: "public", table: "wallet_charge_requests", filter: `customer_id=eq.${uid}` },
          (payload) => dismissIfSettledElsewhere(payload.new as Row),
        )
        .subscribe();
    })();

    const recheck = () => {
      if (!uid) return;
      if (document.visibilityState === "visible") void checkPending(uid);
    };
    document.addEventListener("visibilitychange", recheck);
    window.addEventListener("focus", recheck);

    return () => {
      cancelled = true;
      if (channel) sb.removeChannel(channel);
      document.removeEventListener("visibilitychange", recheck);
      window.removeEventListener("focus", recheck);
    };
  }, [activate, checkPending, dismissIfSettledElsewhere]);

  // Countdown; auto-close when the request lapses.
  useEffect(() => {
    if (!req || phase !== "ask") return;
    const tick = () => {
      const left = Math.max(0, Math.round((req.expiresAt - Date.now()) / 1000));
      setSecsLeft(left);
      if (left <= 0) { setReq(null); setDismissed(false); }
    };
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [req, phase]);

  async function respond(decision: "approve" | "decline") {
    if (!req) return;
    setPhase("working");
    try {
      const r = await respondToCharge(req.id, decision);
      if (decision === "decline") {
        setOutcome({ text: "Declined — nothing was charged." });
        setPhase("declined");
      } else {
        // balance_pence is wallet-charge-approve's own return value — the
        // same canonical figure the wallet page reads, not recomputed here.
        setOutcome({
          text: `Paid ${gbp(req.amountPence)} to ${req.businessName}.`,
          balancePence: r.balance_pence,
          cashbackPence: r.cashback_pence,
        });
        setPhase("succeeded");
      }
    } catch (e) {
      // e.message is already a safe, friendly string: respondToCharge's
      // invokeErr() unwraps the edge function's own JSON `error` field
      // (a deliberate message such as "This request is already paid.", or
      // wallet-charge-approve's fixed catch-all sentence), never a raw
      // Postgres/PostgREST error.
      setOutcome({ text: e instanceof Error ? e.message : "Something went wrong. Please try again." });
      setPhase("failed");
    }
  }

  function finish() {
    setReq(null);
    setDismissed(false);
  }

  function viewWallet() {
    finish();
    router.push("/account/wallet");
  }

  const pending: PendingSummary | null =
    req && phase === "ask" ? { businessName: req.businessName, amountPence: req.amountPence } : null;
  const reopen = useCallback(() => setDismissed(false), []);

  const title =
    phase === "succeeded" ? "Payment complete"
    : phase === "failed" ? "Payment failed"
    : phase === "declined" ? "Request declined"
    : "Approve payment?";

  return (
    <Ctx.Provider value={{ pending, reopen }}>
      {children}
      <Modal
        open={!!req && !dismissed}
        onClose={() => { if (phase !== "working") setDismissed(true); }}
        title={title}
        accent={phase === "failed" ? DANGER : ACCENT}
      >
        {!req ? null : phase === "succeeded" ? (
          <div className="space-y-5 py-2 text-center">
            <span className="mx-auto grid h-16 w-16 place-items-center rounded-full text-3xl text-paper" style={{ background: ACCENT }}>✓</span>
            <div>
              <p className="font-display text-xl font-bold text-ink">Payment complete</p>
              <p className="mt-2 text-ink-soft">
                <span className="font-semibold text-ink">{gbp(req.amountPence)}</span> paid to{" "}
                <span className="font-semibold text-ink">{req.businessName}</span>
              </p>
              {!!outcome?.cashbackPence && (
                <p className="mt-1 text-sm text-ink-soft">You earned {gbp(outcome.cashbackPence)} cashback.</p>
              )}
              {outcome?.balancePence != null && (
                <p className="mt-1 text-sm text-ink-muted">New wallet balance: {gbp(outcome.balancePence)}</p>
              )}
            </div>
            <button
              onClick={viewWallet}
              className="block w-full rounded-pill py-3 text-center font-semibold text-paper transition hover:brightness-95"
              style={{ background: ACCENT }}
            >
              View wallet
            </button>
            <button onClick={finish} className="w-full rounded-pill border border-line-strong py-3 font-semibold text-ink-soft transition hover:bg-sand">
              Done
            </button>
          </div>
        ) : phase === "failed" ? (
          <div className="py-4 text-center">
            <span className="mx-auto grid h-14 w-14 place-items-center rounded-full text-2xl text-paper" style={{ background: DANGER }}>!</span>
            <p className="mt-4 text-ink-soft">{outcome?.text}</p>
            <button onClick={finish} className="mt-5 rounded-pill px-5 py-2.5 font-semibold text-paper" style={{ background: ACCENT }}>Close</button>
          </div>
        ) : phase === "declined" ? (
          <div className="py-4 text-center">
            <span className="mx-auto grid h-14 w-14 place-items-center rounded-full text-2xl text-paper" style={{ background: ACCENT }}>✓</span>
            <p className="mt-4 text-ink-soft">{outcome?.text}</p>
            <button onClick={finish} className="mt-5 rounded-pill px-5 py-2.5 font-semibold text-paper" style={{ background: ACCENT }}>Done</button>
          </div>
        ) : (
          <div className="py-2 text-center">
            <p className="text-ink-soft">
              <span className="font-bold text-ink">{req.businessName}</span> would like to charge your wallet
            </p>
            <p className="my-3 font-display text-4xl font-bold text-ink">{gbp(req.amountPence)}</p>
            <p className="text-xs text-ink-faint">Expires in {secsLeft}s</p>
            <div className="mt-5 flex gap-3">
              <button onClick={() => respond("decline")} disabled={phase === "working"} className="flex-1 rounded-pill border border-line-strong px-5 py-3 font-semibold text-ink transition hover:bg-sand disabled:opacity-50">Decline</button>
              <button onClick={() => respond("approve")} disabled={phase === "working"} className="flex-1 rounded-pill px-5 py-3 font-semibold text-paper transition hover:brightness-95 disabled:opacity-50" style={{ background: ACCENT }}>
                {phase === "working" ? "Paying…" : `Pay ${gbp(req.amountPence)}`}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </Ctx.Provider>
  );
}

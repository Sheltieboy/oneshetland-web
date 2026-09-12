"use client";

import { createContext, useContext, useEffect, useState, useCallback, useRef } from "react";
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

export function ChargeApprovalListener({ children }: { children: React.ReactNode }) {
  const [req, setReq] = useState<ActiveRequest | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [phase, setPhase] = useState<"ask" | "working" | "done">("ask");
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);
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
    setResult(null);
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
   * The merchant cancelled (or the request otherwise left 'pending' —
   * expired, for instance) while this customer had the request open or
   * merely pending in the background. Money safety does not depend on this:
   * an Approve tap always gets a definitive answer from wallet-charge-approve
   * regardless of whether this fires. This only clears a request that can no
   * longer be approved, so nothing stale lingers in the pop-up or the wallet
   * page's "pending" card. Left alone mid-tap ('working') — the in-flight
   * respond() call resolves it instead.
   */
  const dismissIfSettledElsewhere = useCallback((row: Row) => {
    if (row.status === "pending") return;
    if (phaseRef.current === "working") return;
    if (reqRef.current?.id !== row.id) return;
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
      if (decision === "decline") { setResult({ ok: true, text: "Declined — nothing was charged." }); }
      else { setResult({ ok: true, text: `Paid ${gbp(req.amountPence)} to ${req.businessName}.${r.cashback_pence ? ` You earned ${gbp(r.cashback_pence)} cashback.` : ""}` }); }
      setPhase("done");
    } catch (e) {
      setResult({ ok: false, text: e instanceof Error ? e.message : "Something went wrong." });
      setPhase("done");
    }
  }

  function finish() {
    setReq(null);
    setDismissed(false);
  }

  const pending: PendingSummary | null =
    req && phase === "ask" ? { businessName: req.businessName, amountPence: req.amountPence } : null;
  const reopen = useCallback(() => setDismissed(false), []);

  return (
    <Ctx.Provider value={{ pending, reopen }}>
      {children}
      <Modal
        open={!!req && !dismissed}
        onClose={() => { if (phase !== "working") setDismissed(true); }}
        title="Approve payment?"
        accent={ACCENT}
      >
        {!req ? null : phase === "done" ? (
          <div className="py-4 text-center">
            <span className="mx-auto grid h-14 w-14 place-items-center rounded-full text-2xl text-paper" style={{ background: result?.ok ? ACCENT : "#e11d48" }}>{result?.ok ? "✓" : "!"}</span>
            <p className="mt-4 text-ink-soft">{result?.text}</p>
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

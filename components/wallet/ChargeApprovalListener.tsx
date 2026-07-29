"use client";

import { useEffect, useState, useCallback } from "react";
import { Modal } from "@/components/ui/Modal";
import { createClient } from "@/lib/supabase/client";
import { respondToCharge } from "@/lib/member-card-client";
import { gbp } from "@/lib/stripe";

/**
 * ChargeApprovalListener — mounted globally. When a business scans this signed-in
 * customer's member card and requests a payment (wallet_charge_requests INSERT),
 * this pops the consent prompt so they can Approve or Decline. No money moves
 * without their tap. Renders nothing until a request arrives.
 */

interface ActiveRequest {
  id: string;
  businessId: string;
  businessName: string;
  amountPence: number;
  expiresAt: number; // epoch ms
}

const ACCENT = "#0e7490";

export function ChargeApprovalListener() {
  const [req, setReq] = useState<ActiveRequest | null>(null);
  const [phase, setPhase] = useState<"ask" | "working" | "done">("ask");
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);
  const [secsLeft, setSecsLeft] = useState(0);

  // Turn a raw request row into an ActiveRequest (fetching the business name).
  const activate = useCallback(async (row: { id: string; business_id: string; amount_pence: number; expires_at: string; status: string }) => {
    if (row.status !== "pending") return;
    const expiresAt = new Date(row.expires_at).getTime();
    if (expiresAt < Date.now()) return;
    const sb = createClient();
    const { data: biz } = await sb.from("local_businesses").select("name").eq("id", row.business_id).maybeSingle();
    setReq({
      id: row.id,
      businessId: row.business_id,
      businessName: (biz as { name?: string } | null)?.name ?? "A business",
      amountPence: row.amount_pence,
      expiresAt,
    });
    setPhase("ask");
    setResult(null);
  }, []);

  // Subscribe to new requests aimed at me, and catch any already pending on load.
  useEffect(() => {
    const sb = createClient();
    let channel: ReturnType<typeof sb.channel> | null = null;
    let cancelled = false;

    (async () => {
      const { data: auth } = await sb.auth.getUser();
      const uid = auth.user?.id;
      if (!uid || cancelled) return;

      // Catch a request that arrived while the page was loading.
      const { data: pending } = await sb
        .from("wallet_charge_requests")
        .select("id, business_id, amount_pence, expires_at, status")
        .eq("customer_id", uid).eq("status", "pending")
        .order("created_at", { ascending: false }).limit(1).maybeSingle();
      if (pending && !cancelled) activate(pending as { id: string; business_id: string; amount_pence: number; expires_at: string; status: string });

      channel = sb
        .channel("charge-approvals")
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "wallet_charge_requests", filter: `customer_id=eq.${uid}` },
          (payload) => activate(payload.new as { id: string; business_id: string; amount_pence: number; expires_at: string; status: string }),
        )
        .subscribe();
    })();

    return () => { cancelled = true; if (channel) sb.removeChannel(channel); };
  }, [activate]);

  // Countdown; auto-close when the request lapses.
  useEffect(() => {
    if (!req || phase !== "ask") return;
    const tick = () => {
      const left = Math.max(0, Math.round((req.expiresAt - Date.now()) / 1000));
      setSecsLeft(left);
      if (left <= 0) { setReq(null); }
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

  if (!req) return null;

  return (
    <Modal open onClose={() => { if (phase !== "working") setReq(null); }} title="Approve payment?" accent={ACCENT}>
      {phase === "done" ? (
        <div className="py-4 text-center">
          <span className="mx-auto grid h-14 w-14 place-items-center rounded-full text-2xl text-paper" style={{ background: result?.ok ? ACCENT : "#e11d48" }}>{result?.ok ? "✓" : "!"}</span>
          <p className="mt-4 text-ink-soft">{result?.text}</p>
          <button onClick={() => setReq(null)} className="mt-5 rounded-pill px-5 py-2.5 font-semibold text-paper" style={{ background: ACCENT }}>Done</button>
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
  );
}

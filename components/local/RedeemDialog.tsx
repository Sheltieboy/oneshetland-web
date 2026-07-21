"use client";

import { useEffect, useRef, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { startRedemption, getRedemptionStatus, type RedeemKind, type RedemptionTicket } from "@/lib/loyalty-redeem-client";

/**
 * RedeemDialog — the customer "show at till" modal. Starts a redemption, shows a
 * QR + short code + countdown, and polls until staff confirm on their side, then
 * flips to a success state. Mirrors the app's local-redeem screen.
 */
export function RedeemDialog({
  kind, refId, amount, accent, onClose, onDone,
}: {
  kind: RedeemKind;
  refId: string;
  amount?: number;
  accent: string;
  onClose: () => void;
  onDone?: () => void;
}) {
  const [ticket, setTicket] = useState<RedemptionTicket | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [secs, setSecs] = useState(15 * 60);
  const poll = useRef<ReturnType<typeof setInterval> | null>(null);
  const tick = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    let live = true;
    startRedemption(kind, refId, amount)
      .then((t) => { if (live) setTicket(t); })
      .catch((e) => { if (live) setError(e instanceof Error ? e.message : "Could not start."); });
    return () => { live = false; if (poll.current) clearInterval(poll.current); if (tick.current) clearInterval(tick.current); };
  }, [kind, refId, amount]);

  useEffect(() => {
    if (!ticket) return;
    tick.current = setInterval(() => {
      setSecs(Math.max(0, Math.round((new Date(ticket.expires_at).getTime() - Date.now()) / 1000)));
    }, 1000);
    poll.current = setInterval(async () => {
      if ((await getRedemptionStatus(ticket.id)) === "consumed") {
        if (poll.current) clearInterval(poll.current);
        if (tick.current) clearInterval(tick.current);
        setDone(true);
        onDone?.();
      }
    }, 2500);
    return () => { if (poll.current) clearInterval(poll.current); if (tick.current) clearInterval(tick.current); };
  }, [ticket, onDone]);

  const mm = Math.floor(secs / 60);
  const ss = String(secs % 60).padStart(2, "0");

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4" onClick={onClose}>
      <div className="w-full max-w-sm rounded-card bg-paper p-6 text-center shadow-lift" onClick={(e) => e.stopPropagation()}>
        {error ? (
          <>
            <p className="font-display text-xl font-bold text-ink">Can’t redeem</p>
            <p className="mt-2 text-sm text-ink-soft">{error}</p>
            <button onClick={onClose} className="mt-5 rounded-pill px-6 py-2.5 font-semibold text-paper" style={{ background: accent }}>Close</button>
          </>
        ) : done ? (
          <>
            <div className="mx-auto grid h-16 w-16 place-items-center rounded-full text-2xl text-paper" style={{ background: accent }}>✓</div>
            <p className="mt-4 font-display text-2xl font-bold text-ink">Redeemed!</p>
            <p className="mt-1 text-sm text-ink-soft">{ticket?.detail?.title ?? "Enjoy"} — confirmed by staff. 🎉</p>
            <button onClick={onClose} className="mt-5 rounded-pill px-6 py-2.5 font-semibold text-paper" style={{ background: accent }}>Done</button>
          </>
        ) : !ticket ? (
          <p className="py-10 text-ink-muted">Preparing…</p>
        ) : (
          <>
            <p className="font-display text-xl font-bold text-ink">{ticket.detail?.title ?? "Redemption"}</p>
            {ticket.detail?.subtitle && <p className="text-sm text-ink-muted">{ticket.detail.subtitle}</p>}
            <div className="mx-auto mt-4 w-fit rounded-xl bg-white p-4 shadow-soft"><QRCodeSVG value={ticket.token} size={180} /></div>
            <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-ink-faint">or read this code to staff</p>
            <p className="font-display text-4xl font-black tracking-[0.2em]" style={{ color: accent }}>{ticket.code}</p>
            <p className="mt-2 text-sm text-ink-muted">Staff scan or type it to confirm. Expires in {mm}:{ss}.</p>
            <p className="mt-4 text-sm text-ink-faint">Waiting for staff to confirm…</p>
            <button onClick={onClose} className="mt-4 text-sm font-semibold text-ink-muted hover:text-ink">Cancel</button>
          </>
        )}
      </div>
    </div>
  );
}

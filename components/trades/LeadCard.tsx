"use client";

import { useState, useTransition } from "react";
import { respondToBrief } from "@/lib/trades-actions";
import { SCALES, TRADE_LABEL, URGENCIES } from "@/lib/trades";

/**
 * One job, and the two buttons that matter.
 *
 * A decline is given equal weight to a yes, on purpose. A fast no is a service
 * — it frees somebody to look elsewhere the same day instead of waiting on a
 * call that was never coming — and the reason feeds the waiting-list figures
 * that recruit more trades. Making "no" feel like a failure would lose both.
 *
 * The contact details appear only after a yes. Nothing here can browse them.
 */

const ACCENT = "#2a8b5c";

const DECLINE: { key: string; label: string }[] = [
  { key: "booked_up",   label: "Booked up" },
  { key: "too_small",   label: "Too small" },
  { key: "too_far",     label: "Too far" },
  { key: "wrong_trade", label: "Not my trade" },
  { key: "other",       label: "Can't take it" },
];

export function LeadCard({
  matchId,
  status,
  brief,
  contact,
  alreadyAnswered,
}: {
  matchId: string;
  status: string;
  brief: { title: string; description: string; trades: string[]; scale: string; urgency: string; location: string; createdAt: string; closed: boolean };
  contact: { name: string | null; phone: string | null; email: string | null } | null;
  alreadyAnswered: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [answered, setAnswered] = useState(alreadyAnswered);
  const [current, setCurrent] = useState(status);
  const [revealed, setRevealed] = useState(contact);
  const [declining, setDeclining] = useState(false);

  const urgency = URGENCIES.find((u) => u.key === brief.urgency);
  const scale = SCALES.find((s) => s.key === brief.scale);
  const days = Math.floor((Date.now() - new Date(brief.createdAt).getTime()) / 86400000);

  function respond(kind: "interested" | "declined", reason?: string) {
    startTransition(async () => {
      const res = await respondToBrief(matchId, kind, reason);
      if (!res.ok) return;
      setAnswered(true); setCurrent(kind); setDeclining(false);
      if (res.contact) setRevealed(res.contact);
    });
  }

  return (
    <article className="rounded-xl border border-line bg-paper p-5 shadow-soft">
      <div className="flex flex-wrap items-center gap-2">
        {brief.urgency === "emergency" && (
          <span className="rounded-pill bg-rose-100 px-2.5 py-0.5 text-xs font-bold text-rose-800">Emergency</span>
        )}
        <span className="rounded-pill bg-sand px-2.5 py-0.5 text-xs font-bold text-ink-soft">{scale?.label}</span>
        <span className="text-xs text-ink-faint">
          {brief.location} · {days === 0 ? "today" : `${days}d ago`}
        </span>
        {brief.closed && (
          <span className="rounded-pill bg-sand px-2.5 py-0.5 text-xs font-bold text-ink-faint">Now closed</span>
        )}
      </div>

      <h3 className="mt-2 font-display text-xl font-bold text-ink">{brief.title}</h3>
      <p className="mt-1 text-sm text-ink-muted">
        {brief.trades.map((t) => TRADE_LABEL[t] ?? t).join(" · ")} · {urgency?.label.toLowerCase()}
      </p>
      <p className="mt-3 whitespace-pre-line text-ink-soft">{brief.description}</p>

      {revealed?.phone && (
        <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 p-3">
          <p className="text-sm font-semibold text-emerald-900">{revealed.name ?? "Contact"}</p>
          <a href={`tel:${revealed.phone}`} className="text-lg font-bold text-emerald-800 underline">{revealed.phone}</a>
          {revealed.email && (
            <a href={`mailto:${revealed.email}`} className="mt-0.5 block text-sm text-emerald-800 underline">{revealed.email}</a>
          )}
          <p className="mt-1.5 text-xs text-emerald-800">
            Give them a ring — OneShetland doesn&apos;t pass messages, it just puts you in touch.
          </p>
        </div>
      )}

      {!answered && !brief.closed && (
        <div className="mt-4 border-t border-line pt-4">
          {!declining ? (
            <div className="flex flex-wrap gap-2">
              <button onClick={() => respond("interested")} disabled={pending}
                className="rounded-pill px-5 py-2.5 font-bold text-white shadow-soft disabled:opacity-60"
                style={{ background: ACCENT }}>
                {pending ? "…" : "I'm interested — show me their number"}
              </button>
              <button onClick={() => setDeclining(true)} disabled={pending}
                className="rounded-pill border border-line-strong px-5 py-2.5 font-semibold text-ink-soft transition hover:bg-sand">
                Can&apos;t take it
              </button>
            </div>
          ) : (
            <div>
              <p className="text-sm font-semibold text-ink">Why not? It helps them find somebody else.</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {DECLINE.map((d) => (
                  <button key={d.key} onClick={() => respond("declined", d.key)} disabled={pending}
                    className="rounded-pill border border-line-strong px-3 py-1.5 text-sm font-semibold text-ink-soft transition hover:bg-sand disabled:opacity-50">
                    {d.label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {answered && current === "declined" && (
        <p className="mt-3 border-t border-line pt-3 text-sm text-ink-muted">
          You passed on this one. Thanks — telling them quickly is genuinely useful.
        </p>
      )}
    </article>
  );
}

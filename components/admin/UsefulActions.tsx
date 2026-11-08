"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { setActionState } from "@/app/admin/intelligence/actions";
import { StatusPill } from "@/components/admin/AdminUI";
import { CATEGORY_LABEL, PRIORITY_META, ago, type ActionHistoryItem, type UsefulAction } from "@/lib/admin-intel";

/**
 * Useful Actions: the day's most worthwhile things to do, from real platform data (rules in the database, no AI).
 * Shows `initial` actions prominently and the rest behind "Show more". Each card: what to do, why (the evidence), the expected benefit,
 * priority, and a direct link. Done / Not now / Dismiss are one tap and persist.
 */
export function UsefulActions({ actions, history = [], initial = 3, showHistory = false, generatedAt }: {
  actions: UsefulAction[]; history?: ActionHistoryItem[]; initial?: number; showHistory?: boolean; generatedAt?: string;
}) {
  const [gone, setGone] = useState<Set<string>>(new Set());
  const [expanded, setExpanded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const live = actions.filter((a) => !gone.has(a.key));
  const shown = expanded ? live : live.slice(0, initial);
  const urgent = live.filter((a) => a.priority === "urgent").length;

  function act(key: string, status: "done" | "dismissed" | "snoozed") {
    setError(null);
    start(async () => {
      const r = await setActionState(key, status, 7);
      if (r.ok) setGone((g) => new Set(g).add(key)); else setError("That didn't save. Try again.");
    });
  }

  return (
    <section aria-labelledby="useful-actions-h" className="rounded-card border border-teal/40 bg-paper p-4 shadow-soft sm:p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 id="useful-actions-h" className="font-display text-xl font-bold text-ink">Useful Actions</h2>
        <p className="text-xs text-ink-muted">{live.length} today{urgent > 0 && <> · <span className="font-bold text-rose-600">{urgent} urgent</span></>}{generatedAt && <> · checked {ago(generatedAt)}</>}</p>
      </div>
      <p className="mt-0.5 text-sm text-ink-soft">The most worthwhile things to do today, worked out from OneShetland&apos;s own data.</p>

      {live.length === 0 ? (
        <p className="mt-4 rounded-lg bg-sand/60 px-4 py-6 text-center text-sm text-ink-soft">Nothing needs doing today. New suggestions appear when the data gives a reason.</p>
      ) : (
        <ol className="mt-4 space-y-3">
          {shown.map((a) => {
            const meta = PRIORITY_META[a.priority];
            return (
              <li key={a.key} className={"rounded-xl border p-3.5 sm:p-4 " + (a.priority === "urgent" ? "border-rose-300 bg-rose-50/50" : "border-line bg-cream/40")}>
                <div className="flex flex-wrap items-center gap-2">
                  <StatusPill label={meta.label} tone={meta.tone} />
                  <span className="text-xs font-semibold text-ink-muted">{CATEGORY_LABEL[a.category]}</span>
                  {a.evidence === "partial" && <span className="rounded-pill bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-800" title="Based on incomplete evidence">Partial evidence</span>}
                </div>
                <h3 className="mt-1.5 font-display text-lg font-bold leading-snug text-ink">{a.title}</h3>
                <p className="mt-1 text-sm text-ink-soft">{a.what}</p>
                <dl className="mt-2 space-y-1 text-sm">
                  <div><dt className="inline font-bold text-ink">Why: </dt><dd className="inline text-ink-soft">{a.why}</dd></div>
                  <div><dt className="inline font-bold text-ink">Benefit: </dt><dd className="inline text-ink-soft">{a.benefit}</dd></div>
                </dl>
                {a.items && a.items.length > 0 && (
                  <ul className="mt-2 flex flex-wrap gap-1.5">
                    {a.items.map((i) => <li key={i.href + i.label}><Link href={i.href} className="inline-block rounded-pill bg-paper px-2.5 py-1 text-xs font-semibold text-ink-soft ring-1 ring-line hover:bg-sand">{i.label}</Link></li>)}
                  </ul>
                )}
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <Link href={a.link} className="inline-flex min-h-[44px] items-center rounded-pill bg-navy px-4 text-sm font-bold text-paper hover:bg-navy/90">Take action →</Link>
                  <button type="button" disabled={pending} onClick={() => act(a.key, "done")} className="min-h-[44px] rounded-pill border border-line bg-paper px-4 text-sm font-semibold text-ink hover:bg-sand disabled:opacity-60">Mark done</button>
                  <button type="button" disabled={pending} onClick={() => act(a.key, "snoozed")} className="min-h-[44px] rounded-pill px-3 text-sm font-semibold text-ink-soft hover:bg-sand disabled:opacity-60">Snooze 7 days</button>
                  <button type="button" disabled={pending} onClick={() => act(a.key, "dismissed")} className="min-h-[44px] rounded-pill px-3 text-sm font-semibold text-ink-muted hover:bg-sand disabled:opacity-60">Dismiss</button>
                </div>
              </li>
            );
          })}
        </ol>
      )}

      <div aria-live="polite" className="mt-2 min-h-[1.25rem] text-sm font-semibold text-rose-600">{error}</div>
      {live.length > initial && (
        <button type="button" onClick={() => setExpanded((v) => !v)} className="mt-1 min-h-[44px] rounded-pill px-3 text-sm font-bold text-teal-700 underline underline-offset-2">
          {expanded ? "Show fewer" : `Show ${live.length - initial} more`}
        </button>
      )}

      {showHistory && (
        <details className="mt-4 border-t border-line pt-3">
          <summary className="min-h-[44px] cursor-pointer text-sm font-bold text-ink">History ({history.length})</summary>
          {history.length === 0 ? <p className="mt-2 text-sm text-ink-muted">Nothing completed or dismissed yet.</p> : (
            <ul className="mt-2 divide-y divide-line">
              {history.map((h) => (
                <li key={h.key + h.acted_at} className="flex flex-wrap items-baseline justify-between gap-x-3 py-2 text-sm">
                  <span className="font-semibold text-ink">{h.title}</span>
                  <span className="text-xs text-ink-muted">
                    {h.status === "done" ? "Done" : "Dismissed"} {ago(h.acted_at)}
                    {h.then !== null && h.now !== null && <> · {h.then} → {h.now} {h.improved === true ? <span className="font-bold text-emerald-700">improved</span> : h.improved === false ? <span className="font-bold text-rose-600">not improved</span> : null}</>}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </details>
      )}
    </section>
  );
}

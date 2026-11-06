"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { withdrawSubmission, type Sb } from "@/lib/event-submissions-client";
import type { SubmissionView } from "@/lib/event-submissions-shape";
import { Notice, SecondaryButton, StatusChip, dangerBtn, focusRing, textBtn } from "@/components/events/submit-ui";

export function MySubmissionsList({ items, eventIds }: { items: SubmissionView[]; eventIds: Record<string, string> }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ id: string; text: string; good: boolean } | null>(null);
  const live = useRef<HTMLParagraphElement>(null);

  async function withdraw(id: string) {
    setBusy(id);
    const r = await withdrawSubmission(createClient() as unknown as Sb, id);
    setBusy(null); setConfirming(null);
    if (r.ok) { setMsg({ id, text: "Withdrawn. We won't look at it.", good: true }); router.refresh(); }
    else setMsg({ id, text: r.error.message, good: false });
    live.current?.focus();
  }

  return (
    <div className="mt-6">
      <p ref={live} tabIndex={-1} role="status" className="sr-only outline-none">{msg?.text ?? ""}</p>
      <ul className="space-y-4">
        {items.map((s) => (
          <li key={s.id} className="rounded-2xl border border-line-strong bg-paper p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-xl font-bold text-ink">{s.title}</h2>
              <StatusChip label={s.statusLabel} tone={s.tone} />
            </div>
            <p className="mt-1 text-base text-ink-soft">Run by {s.organiser} · {s.categoryLabel}</p>
            <p className="mt-3 text-base text-ink">{s.statusExplainer}</p>
            {s.reason && <p className="mt-3 rounded-xl bg-cream p-3 text-base text-ink"><span className="font-semibold">From OneShetland: </span>{s.reason}</p>}
            {s.dates.length > 0 && (
              <details className="mt-3">
                <summary className={`min-h-11 cursor-pointer py-2 text-base font-semibold text-navy ${focusRing}`}>{s.dates.length === 1 ? "1 date" : `${s.dates.length} dates`}</summary>
                <ul className="mt-1 list-disc pl-6 text-base text-ink">{s.dates.map((d) => <li key={d}>{d}</li>)}</ul>
              </details>
            )}
            <div className="mt-4 flex flex-wrap items-center gap-4">
              {s.canManage && eventIds[s.id] && (
                <Link href={`/account/event-submissions/event/${eventIds[s.id]}`} className={`inline-flex min-h-12 items-center rounded-pill bg-navy px-6 py-3 text-lg font-bold text-white ${focusRing}`}>Look after this event</Link>
              )}
              {s.canWithdraw && confirming !== s.id && (
                <SecondaryButton onClick={() => setConfirming(s.id)}>Withdraw<span className="sr-only"> {s.title}</span></SecondaryButton>
              )}
            </div>
            {confirming === s.id && (
              <Notice tone="warn">
                <p className="font-semibold">Take this back? We won&apos;t look at it.</p>
                <div className="mt-3 flex flex-wrap gap-4">
                  <button type="button" className={dangerBtn} disabled={busy === s.id} onClick={() => withdraw(s.id)}>{busy === s.id ? "Withdrawing..." : "Yes, withdraw it"}</button>
                  <button type="button" className={textBtn} onClick={() => setConfirming(null)}>No, keep it</button>
                </div>
              </Notice>
            )}
            {msg?.id === s.id && !msg.good && <p role="alert" className="mt-3 text-base font-semibold text-rose-700">{msg.text}</p>}
          </li>
        ))}
      </ul>
    </div>
  );
}

"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { adminSetEventStatus, adminSetOccurrenceStatus, type Result, type Sb } from "@/lib/event-submissions-client";
import { eventConfirm, performanceConfirm, submissionHref, type CommunityEventView, type ConfirmCopy, type PerformanceAction, type PerformanceView } from "@/lib/event-community-admin";
import { useConfirm } from "@/components/ui/ConfirmProvider";
import { Card, Empty } from "@/components/admin/AdminUI";
import { Notice, StatusChip, focusRing } from "@/components/events/submit-ui";

const smallBtn = `inline-flex min-h-11 items-center rounded-pill border border-line-strong bg-paper px-4 py-2 text-sm font-bold text-ink hover:bg-cream disabled:opacity-60 ${focusRing}`;
const linkCls = `inline-flex min-h-11 items-center text-sm font-semibold text-navy underline ${focusRing}`;

export function CommunityEventsList({ items, emptyText }: { items: CommunityEventView[]; emptyText: string }) {
  // A success is announced up here, not inside the card: after the refresh the card may leave this tab (a cancelled event leaves "Live"), so a message
  // kept inside it would vanish. A failure stays in its card, next to the thing that failed.
  const [done, setDone] = useState<string | null>(null);
  const live = useRef<HTMLDivElement>(null);
  useEffect(() => { if (done) live.current?.focus(); }, [done]);
  return (
    <div>
      <div ref={live} tabIndex={-1} role="status" aria-live="polite" className="outline-none">{done && <Notice tone="good">{done}</Notice>}</div>
      {items.length === 0
        ? <div className="mt-4"><Empty>{emptyText}</Empty></div>
        : <ul className="mt-4 space-y-4">{items.map((e) => <li key={e.id}><EventCard e={e} onDone={setDone} /></li>)}</ul>}
    </div>
  );
}

function EventCard({ e, onDone }: { e: CommunityEventView; onDone: (text: string) => void }) {
  const router = useRouter();
  const confirm = useConfirm();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ text: string } | null>(null);
  const failLive = useRef<HTMLDivElement>(null);
  const sb = () => createClient() as unknown as Sb;
  useEffect(() => { if (msg) failLive.current?.focus(); }, [msg]);

  async function act(copy: ConfirmCopy, run: () => Promise<Result<unknown>>) {
    const trigger = typeof document !== "undefined" ? document.activeElement : null;
    const yes = await confirm({ title: copy.title, body: copy.body, confirmLabel: copy.confirmLabel, cancelLabel: "No, leave it", danger: copy.danger });
    if (!yes) { if (trigger instanceof HTMLElement && trigger.isConnected) trigger.focus(); return; }
    setBusy(true); setMsg(null);
    const r = await run();
    setBusy(false);
    if (r.ok) { setMsg(null); onDone(`${e.title}: ${copy.success}`); router.refresh(); }
    else setMsg({ text: r.error.message });
  }
  const perf = (p: PerformanceView, action: PerformanceAction) => act(performanceConfirm(action, p.when), () => adminSetOccurrenceStatus(sb(), p.id, action === "cancel" ? "cancelled" : "scheduled"));
  const whole = (action: PerformanceAction) => act(eventConfirm(action, e.title), () => adminSetEventStatus(sb(), e.id, action === "cancel" ? "cancelled" : "published"));

  return (
    <Card>
      <div id={`ev-${e.id}`} className="scroll-mt-4">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <h2 className="text-xl font-bold text-ink">{e.title}</h2>
          <StatusChip label={e.chip.label} tone={e.chip.tone} />
        </div>
        <dl className="mt-2 grid gap-x-6 gap-y-1 text-base text-ink sm:grid-cols-2">
          <div><dt className="inline text-sm font-semibold text-ink-soft">Shown to the public as: </dt><dd className="inline">{e.organiser}</dd></div>
          <div><dt className="inline text-sm font-semibold text-ink-soft">Sent in by: </dt><dd className="inline">{e.submitter}</dd></div>
          <div><dt className="inline text-sm font-semibold text-ink-soft">First date: </dt><dd className="inline">{e.first ?? "None recorded"}</dd></div>
          <div><dt className="inline text-sm font-semibold text-ink-soft">Next live date: </dt><dd className="inline">{e.next ?? "None coming up"}</dd></div>
          <div><dt className="inline text-sm font-semibold text-ink-soft">Dates: </dt><dd className="inline">{e.count}</dd></div>
        </dl>

        {e.performances.length > 0 && (
          <details className="mt-3">
            <summary className={`min-h-11 cursor-pointer py-2 text-base font-semibold text-navy ${focusRing}`}>{e.count === 1 ? "1 date" : `${e.count} dates`} and their status</summary>
            <ul className="mt-1 divide-y divide-line rounded-xl border border-line">
              {e.performances.map((p) => (
                <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
                  <span className="text-base text-ink">{p.when}{p.note ? <span className="text-ink-soft"> ({p.note})</span> : null}</span>
                  <span className="flex flex-wrap items-center gap-2">
                    <StatusChip label={p.past ? `${p.statusLabel}, already happened` : p.statusLabel} tone={p.past ? "gray" : p.tone} />
                    {!p.past && p.status !== "cancelled" && <button type="button" disabled={busy} className={smallBtn} onClick={() => perf(p, "cancel")}>Cancel this date<span className="sr-only">: {p.when}</span></button>}
                    {!p.past && p.status === "cancelled" && <button type="button" disabled={busy} className={smallBtn} onClick={() => perf(p, "restore")}>Put this date back on<span className="sr-only">: {p.when}</span></button>}
                  </span>
                </li>
              ))}
            </ul>
          </details>
        )}

        <div ref={failLive} tabIndex={-1} role="status" aria-live="polite" className="outline-none">{msg && <Notice tone="warn">{msg.text}</Notice>}</div>

        <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1">
          <Link href={e.publicHref} className={linkCls}>View public page<span className="sr-only">: {e.title}</span></Link>
          {e.submissionId && <Link href={submissionHref(e.submissionId)} className={linkCls}>View original submission<span className="sr-only">: {e.title}</span></Link>}
          {e.canCancelEvent && <button type="button" disabled={busy} className={smallBtn} onClick={() => whole("cancel")}>Cancel the whole event<span className="sr-only">: {e.title}</span></button>}
          {e.canRestoreEvent && <button type="button" disabled={busy} className={smallBtn} onClick={() => whole("restore")}>Put the whole event back on<span className="sr-only">: {e.title}</span></button>}
        </div>
      </div>
    </Card>
  );
}

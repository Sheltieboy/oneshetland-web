"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { adminReviewChange, adminSetTrust, type Sb } from "@/lib/event-submissions-client";
import type { ChangeLine } from "@/lib/event-submissions-shape";
import Link from "next/link";
import { communityEventHref } from "@/lib/event-community-admin";
import { Card, StatusPill } from "@/components/admin/AdminUI";
import { Field, Notice, TextArea, TextInput, focusRing } from "@/components/events/submit-ui";

type Item = { id: string; event_id: string; event_title: string; requester: string; requester_id: string; status: string; label: string; lines: ChangeLine[]; trusted: boolean; trustNote: string | null; created_at: string };
const btn = `inline-flex min-h-11 items-center rounded-pill px-5 py-2 text-base font-bold disabled:opacity-60 ${focusRing}`;

export function EventChangesQueue({ items }: { items: Item[] }) {
  return <ul className="space-y-4">{items.map((c) => <li key={c.id}><ChangeCard c={c} /></li>)}</ul>;
}

function ChangeCard({ c }: { c: Item }) {
  const router = useRouter();
  const [mode, setMode] = useState<null | "reject" | "trust">(null);
  const [reason, setReason] = useState("");
  const [note, setNote] = useState(c.trustNote ?? "");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ text: string; good: boolean } | null>(null);
  const sb = () => createClient() as unknown as Sb;

  async function review(decision: "approve" | "reject") {
    setBusy(true); setMsg(null);
    const r = await adminReviewChange(sb(), c.id, decision, reason);
    setBusy(false);
    if (r.ok) { setMsg({ text: decision === "approve" ? "Approved. The change is live." : "Rejected.", good: true }); setMode(null); router.refresh(); }
    else setMsg({ text: r.error.message, good: false });
  }
  async function trust(next: boolean) {
    setBusy(true); setMsg(null);
    const r = await adminSetTrust(sb(), c.requester_id, next, note);
    setBusy(false);
    if (r.ok) { setMsg({ text: next ? "Marked as a trusted organiser: small changes now go live straight away." : "No longer trusted: every change waits for a look.", good: true }); setMode(null); router.refresh(); }
    else setMsg({ text: r.error.message, good: false });
  }

  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-xl font-bold text-ink">{c.event_title}</h2>
          <p className="text-sm font-semibold text-violet-800">{c.label}</p>
        </div>
        <StatusPill label={c.status === "pending" ? "Waiting" : "Applied automatically"} tone={c.status === "pending" ? "amber" : "green"} />
      </div>
      <p className="mt-1 text-sm text-ink-soft">Asked by {c.requester}{c.trusted ? " (trusted organiser)" : ""}</p>
      {c.event_id && (
        <p className="mt-1 flex flex-wrap items-center gap-x-5 gap-y-1">
          <Link href={`/whats-on/${c.event_id}`} className="inline-flex min-h-11 items-center text-sm font-semibold text-navy underline">View public page<span className="sr-only">: {c.event_title}</span></Link>
          <Link href={communityEventHref(c.event_id, c.event_title)} className="inline-flex min-h-11 items-center text-sm font-semibold text-navy underline">Manage on Community events<span className="sr-only">: {c.event_title}</span></Link>
        </p>
      )}
      <ul className="mt-3 space-y-3">
        {c.lines.map((l) => (
          <li key={l.field} className="rounded-xl bg-cream p-3">
            <p className="text-sm font-bold text-ink">{l.label}{l.needsLook ? " (always checked by staff)" : ""}</p>
            {l.field === "occurrences" ? (
              <div className="text-base text-ink">
                {l.added?.length ? <p>Add: {l.added.join("; ")}</p> : null}
                {l.removed?.length ? <p>Remove: {l.removed.join("; ")}</p> : null}
                {l.changed?.length ? <p>Change: {l.changed.join("; ")}</p> : null}
              </div>
            ) : (
              <div className="text-base text-ink"><p><span className="font-semibold">Was:</span> {l.before}</p><p><span className="font-semibold">Now:</span> {l.after}</p></div>
            )}
          </li>
        ))}
      </ul>
      <div role="status" aria-live="polite">{msg && <Notice tone={msg.good ? "good" : "warn"}>{msg.text}</Notice>}</div>
      <div className="mt-4 flex flex-wrap gap-3">
        {c.status === "pending" && mode === null && (<>
          <button type="button" disabled={busy} className={`${btn} bg-emerald-700 text-white`} onClick={() => review("approve")}>Approve<span className="sr-only">: {c.event_title}</span></button>
          <button type="button" className={`${btn} bg-rose-700 text-white`} onClick={() => setMode("reject")}>Reject<span className="sr-only">: {c.event_title}</span></button>
        </>)}
        {mode === null && <button type="button" className={`${btn} border border-line-strong bg-paper text-ink`} onClick={() => setMode("trust")}>{c.trusted ? "Trusted organiser: change" : "Trust this organiser"}<span className="sr-only"> ({c.requester})</span></button>}
      </div>
      {mode === "reject" && (
        <div>
          <Field id={`reject-${c.id}`} label="Why not? (the member sees this)">{(a) => <TextArea id={a.id} rows={3} maxLength={500} value={reason} aria-describedby={a.describedBy} onChange={(e) => setReason(e.target.value)} />}</Field>
          <div className="mt-3 flex gap-3">
            <button type="button" disabled={busy} className={`${btn} bg-rose-700 text-white`} onClick={() => review("reject")}>Reject it</button>
            <button type="button" className={`${btn} text-navy underline`} onClick={() => setMode(null)}>Cancel</button>
          </div>
        </div>
      )}
      {mode === "trust" && (
        <div>
          <p className="mt-3 text-base text-ink">A trusted organiser&apos;s changes to description, place, ticket link, contact details and dates go live straight away. Names, posters and prices are still checked, and dates never auto-apply on an event that sells tickets.</p>
          <Field id={`trust-${c.id}`} label="Note (only staff see this)" optional>{(a) => <TextInput id={a.id} value={note} maxLength={300} aria-describedby={a.describedBy} onChange={(e) => setNote(e.target.value)} />}</Field>
          <div className="mt-3 flex flex-wrap gap-3">
            <button type="button" disabled={busy} className={`${btn} ${c.trusted ? "bg-rose-700" : "bg-navy"} text-white`} onClick={() => trust(!c.trusted)}>{c.trusted ? "Stop trusting" : "Trust this organiser"}</button>
            <button type="button" className={`${btn} text-navy underline`} onClick={() => setMode(null)}>Cancel</button>
          </div>
        </div>
      )}
    </Card>
  );
}

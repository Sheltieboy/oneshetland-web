"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { adminReviewSubmission, notifyEventDecision, type ReviewDecision, type Sb, type SubmissionRow } from "@/lib/event-submissions-client";
import { describeOccurrence } from "@/lib/event-dates-builder";
import { eventLabelForCategory } from "@/lib/event-categories";
import { APPROVE_CONFIRM } from "@/lib/contributor-copy";
import { ageLabel } from "@/lib/event-submissions-shape";
import Link from "next/link";
import { communityEventHref } from "@/lib/event-community-admin";
import { Card } from "@/components/admin/AdminUI";
import { Field, Notice, TextArea, focusRing } from "@/components/events/submit-ui";

type Item = SubmissionRow & { submitter: string; label: string };
const btn = `inline-flex min-h-11 items-center rounded-pill px-5 py-2 text-base font-bold disabled:opacity-60 ${focusRing}`;

export function EventSubmissionsQueue({ items }: { items: Item[] }) {
  const [nowMs] = useState(() => Date.now());
  return (
    <ul className="space-y-4">
      {items.map((s) => <li key={s.id}><SubmissionCard s={s} nowMs={nowMs} /></li>)}
    </ul>
  );
}

function SubmissionCard({ s, nowMs }: { s: Item; nowMs: number }) {
  const router = useRouter();
  const [mode, setMode] = useState<null | "approve" | "reject" | "changes_requested">(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ text: string; good: boolean } | null>(null);
  const pending = s.status === "pending";

  async function go(decision: ReviewDecision) {
    setBusy(true); setMsg(null);
    const sb = createClient() as unknown as Sb;
    const r = await adminReviewSubmission(sb, s.id, decision, reason);
    // Only after the review succeeded (and not for a repeated approval): the contributor is emailed once. The message below says so only if it really happened.
    const mailed = r.ok && !r.data.duplicate ? (await notifyEventDecision(sb, s.id)).emailed : false;
    setBusy(false);
    if (r.ok) { setMsg({ text: (decision === "approve" ? "Approved. It is now published as a community event." : decision === "reject" ? "Rejected." : "Asked the member for changes.") + (mailed ? " The member has been emailed." : " The member was not emailed (no email address, a deleted account, an opt-out, or the email did not send)."), good: true }); setMode(null); router.refresh(); }
    else setMsg({ text: r.error.message, good: false });
  }
  const row = (k: string, v: string | null) => v ? <div className="py-1"><dt className="text-sm font-semibold text-ink-soft">{k}</dt><dd className="whitespace-pre-line text-base text-ink">{v}</dd></div> : null;

  return (
    <Card>
      <div id={`sub-${s.id}`} className="scroll-mt-4" />
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-xl font-bold text-ink">{s.title}</h2>
          <p className="text-sm font-semibold text-violet-800">{s.label}</p>
        </div>
        <p className="text-sm text-ink-soft">Sent {ageLabel(s.created_at, nowMs)} by {s.submitter}</p>
      </div>
      <dl className="mt-3 divide-y divide-line">
        {row("Kind", eventLabelForCategory(s.category) ?? s.category)}
        {row("About", s.description)}
        {row("Place", [s.venue, s.locality].filter(Boolean).join(", "))}
        {row("Price", s.price_text)}
        {row("Contact", s.contact_info)}
        {row("Ticket link", s.ticket_url)}
        {row("Poster", s.cover_url ? "Uploaded" : null)}
        <div className="py-1"><dt className="text-sm font-semibold text-ink-soft">Dates ({s.occurrences.length})</dt>
          <dd><ul className="list-disc pl-5 text-base text-ink">{s.occurrences.map((o) => <li key={o.starts_at}>{describeOccurrence(o)}{o.note ? ` (${o.note})` : ""}</li>)}</ul></dd></div>
        {!pending && row("Decision note", s.review_reason)}
      </dl>
      {s.cover_url && (<><img src={s.cover_url} alt={`Poster for ${s.title}`} className="mt-3 max-h-48 rounded-xl border border-line" /></>)}
      <div role="status" aria-live="polite">{msg && <Notice tone={msg.good ? "good" : "warn"}>{msg.text}</Notice>}</div>
      {s.status === "approved" && s.event_id && (
        <p className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1">
          <Link href={`/whats-on/${s.event_id}`} className="inline-flex min-h-11 items-center text-sm font-semibold text-navy underline">View published event<span className="sr-only">: {s.title}</span></Link>
          <Link href={communityEventHref(s.event_id, s.title)} className="inline-flex min-h-11 items-center text-sm font-semibold text-navy underline">Manage on Community events<span className="sr-only">: {s.title}</span></Link>
        </p>
      )}
      {pending && (
        <div className="mt-4">
          {mode === null && (
            <div className="flex flex-wrap gap-3">
              <button type="button" className={`${btn} bg-emerald-700 text-white`} onClick={() => setMode("approve")}>Approve<span className="sr-only">: {s.title}</span></button>
              <button type="button" className={`${btn} border border-line-strong bg-paper text-ink`} onClick={() => setMode("changes_requested")}>Ask for changes<span className="sr-only">: {s.title}</span></button>
              <button type="button" className={`${btn} bg-rose-700 text-white`} onClick={() => setMode("reject")}>Reject<span className="sr-only">: {s.title}</span></button>
            </div>
          )}
          {mode === "approve" && (
            <Notice tone="warn">
              <p className="font-semibold">{APPROVE_CONFIRM(s.organiser_name)}</p>
              <p className="mt-1">Public credit: {s.organiser_name}</p>
              <div className="mt-3 flex flex-wrap gap-3">
                <button type="button" disabled={busy} className={`${btn} bg-emerald-700 text-white`} onClick={() => go("approve")}>{busy ? "Approving..." : "Yes, publish as a community event"}</button>
                <button type="button" className={`${btn} text-navy underline`} onClick={() => setMode(null)}>Cancel</button>
              </div>
            </Notice>
          )}
          {(mode === "reject" || mode === "changes_requested") && (
            <div>
              <Field id={`reason-${s.id}`} label={mode === "reject" ? "Why can't we use it? (the member sees this)" : "What needs to change? (the member sees this)"}>
                {(a) => <TextArea id={a.id} rows={3} maxLength={500} value={reason} aria-describedby={a.describedBy} onChange={(e) => setReason(e.target.value)} />}
              </Field>
              <div className="mt-3 flex flex-wrap gap-3">
                <button type="button" disabled={busy} className={`${btn} ${mode === "reject" ? "bg-rose-700" : "bg-navy"} text-white`} onClick={() => go(mode)}>{mode === "reject" ? "Reject it" : "Send back for changes"}</button>
                <button type="button" className={`${btn} text-navy underline`} onClick={() => { setMode(null); setReason(""); }}>Cancel</button>
              </div>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}

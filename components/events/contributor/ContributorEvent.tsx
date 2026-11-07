"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  reportEventCancelled, reportEventRestored, reportPerformanceCancelled, reportPerformanceRestored, requestChange, setPerformanceNote, uploadPoster, withdrawChange,
  type ContributorView, type OccurrenceRow, type Result, type Sb,
} from "@/lib/event-submissions-client";
import { blankRow, describeOccurrence, rowsFromOccurrences, utcToLondonParts, type DateRow, type RowIssue } from "@/lib/event-dates-builder";
import { buildChange, currentFutureDates, isPast, restoreOption } from "@/lib/event-contributor-logic";
import { describeChange, publicCredit } from "@/lib/event-submissions-shape";
import {
  CANCEL_EVENT_CONFIRM, CANCEL_PERFORMANCE_CONFIRM, TRUSTED_CHANGE_INTRO, CHANGE_FORM_INTRO, CHANGE_FORM_NOTHING, EVENT_CANCELLED_BUTTON, HIDDEN_EVENT_LINE, PERFORMANCE_CANCELLED_BUTTON, RESTORE_HINT,
  cancelledReportedLine, changeRouteLine, changeDeclinedLine, changeOutcomeLine, historyLine, POSTER_HELP,
} from "@/lib/contributor-copy";
import { DatesBuilder } from "@/components/events/DatesBuilder";
import { ErrorSummary, Field, Notice, PrimaryButton, SecondaryButton, StatusChip, TextArea, TextInput, dangerBtn, focusRing, textBtn } from "@/components/events/submit-ui";

const sb = () => createClient() as unknown as Sb;

export function ContributorEvent({ eventId, view }: { eventId: string; view: ContributorView }) {
  const router = useRouter();
  const [nowMs] = useState(() => Date.now());
  const { submission, event, occurrences, log, changes, trusted } = view;
  const [message, setMessage] = useState<{ text: string; good: boolean } | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState<{ kind: "performance"; id: string } | { kind: "event" } | null>(null);
  const [showChange, setShowChange] = useState(false);
  const live = useRef<HTMLDivElement>(null);
  const confirmHeading = useRef<HTMLHeadingElement>(null);

  useEffect(() => { if (confirm) confirmHeading.current?.focus(); }, [confirm]);
  useEffect(() => { if (message) live.current?.focus(); }, [message]);

  const restore = restoreOption(log, nowMs);
  const cancelledEvent = !event || event.status === "cancelled";

  async function run(fn: () => Promise<Result<unknown>>, ok: string) {
    setBusy(true); setMessage(null);
    const r = await fn();
    setBusy(false); setConfirm(null);
    if (r.ok) { setMessage({ text: ok, good: true }); router.refresh(); }
    else setMessage({ text: r.error.message, good: false });
  }

  const title = event?.title || submission.title;
  const future = currentFutureDates(event, occurrences, nowMs);

  return (
    <div>
      <h1 className="mt-4 font-display text-3xl font-bold text-ink">{title}</h1>
      <p className="mt-1 text-lg text-ink-soft">{publicCredit(submission.organiser_name)}</p>
      <div ref={live} tabIndex={-1} role="status" className="outline-none">
        {message && <Notice tone={message.good ? "good" : "warn"}>{message.text}</Notice>}
      </div>
      <p className="mt-4 text-base text-ink">If a performance or the whole event is cancelled, tell us here straight away. You don&apos;t need to wait for anyone.</p>

      {cancelledEvent && (
        <Notice tone="warn">
          <p className="font-semibold">{HIDDEN_EVENT_LINE}</p>
          {restore ? (
            <>
              <p className="mt-2">{RESTORE_HINT}</p>
              <div className="mt-3"><PrimaryButton disabled={busy} onClick={() => run(() => (restore.kind === "event" ? reportEventRestored(sb(), eventId) : reportPerformanceRestored(sb(), restore.occurrenceId)), "Done. It's back on OneShetland.")}>Undo the cancellation</PrimaryButton></div>
            </>
          ) : <p className="mt-2">It&apos;s too late to undo this here. Please ask OneShetland and we&apos;ll sort it out.</p>}
        </Notice>
      )}

      {event && event.status !== "cancelled" && (
        <section aria-labelledby="ce-perf" className="mt-8">
          <h2 id="ce-perf" className="text-2xl font-bold text-ink">{occurrences.length > 1 ? "Performances" : "Date"}</h2>
          <ul className="mt-3 space-y-3">
            {occurrences.length === 0 && event.starts_at && (
              <li className="rounded-2xl border border-line-strong bg-paper p-4 text-lg text-ink">
                {describeOccurrence({ starts_at: event.starts_at, ends_at: event.ends_at })} {event.status === "cancelled" && <StatusChip label="Cancelled" tone="red" />}
              </li>
            )}
            {occurrences.map((o) => (
              <Performance key={o.id} o={o} nowMs={nowMs} busy={busy} restorable={restore?.kind === "performance" && restore.occurrenceId === o.id}
                onCancel={() => setConfirm({ kind: "performance", id: o.id })}
                onRestore={() => run(() => reportPerformanceRestored(sb(), o.id), "Done. That performance is back on.")}
                onNote={(n) => run(() => setPerformanceNote(sb(), o.id, n), "Saved.")} />
            ))}
          </ul>

          {confirm && (
            <div role="alertdialog" aria-labelledby="ce-confirm-h" className="mt-4 rounded-2xl border-2 border-rose-700 bg-rose-50 p-5">
              <h3 id="ce-confirm-h" ref={confirmHeading} tabIndex={-1} className="text-xl font-bold text-rose-950 outline-none">
                {confirm.kind === "event" ? "Cancel the whole event?" : "Cancel this performance?"}
              </h3>
              <p className="mt-2 text-base text-rose-950">{confirm.kind === "event" ? CANCEL_EVENT_CONFIRM : CANCEL_PERFORMANCE_CONFIRM}</p>
              <div className="mt-4 flex flex-wrap items-center gap-4">
                <button type="button" className={dangerBtn} disabled={busy} onClick={() => run(() => (confirm.kind === "event" ? reportEventCancelled(sb(), eventId) : reportPerformanceCancelled(sb(), confirm.id)), cancelledReportedLine(confirm.kind))}>
                  {busy ? "Please wait..." : confirm.kind === "event" ? "Yes, cancel the whole event" : "Yes, cancel it"}
                </button>
                <button type="button" className={textBtn} onClick={() => setConfirm(null)}>No, keep it</button>
              </div>
            </div>
          )}

          {event.status !== "cancelled" && !confirm && future.length > 0 && (
            <p className="mt-4"><button type="button" className={dangerBtn} onClick={() => setConfirm({ kind: "event" })}>{EVENT_CANCELLED_BUTTON}</button></p>
          )}
        </section>
      )}

      {event && event.status !== "cancelled" && (
        <section aria-labelledby="ce-change" className="mt-10">
          <h2 id="ce-change" className="text-2xl font-bold text-ink">Need to change something?</h2>
          <p className="mt-1 text-base text-ink-soft">Dates, place, description, ticket link or contact details. You don&apos;t need to email anyone.</p>
          {!showChange
            ? <p className="mt-3"><SecondaryButton onClick={() => setShowChange(true)}>Ask for a change</SecondaryButton></p>
            : <ChangeForm trusted={trusted} eventId={eventId} event={event} future={future} nowMs={nowMs} userId={submission.submitter_id}
                onClose={() => setShowChange(false)} onDone={(text) => { setMessage({ text, good: true }); setShowChange(false); router.refresh(); }} />}
        </section>
      )}

      <section aria-labelledby="ce-requests" className="mt-10">
        <h2 id="ce-requests" className="text-2xl font-bold text-ink">Changes you have asked for</h2>
        {changes === null ? <p className="mt-2 text-base text-ink-soft">This isn&apos;t available yet.</p>
          : changes.length === 0 ? <p className="mt-2 text-base text-ink-soft">None so far.</p>
          : (
            <ul className="mt-3 space-y-3">
              {changes.map((c) => (
                <li key={c.id} className="rounded-2xl border border-line-strong bg-paper p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <StatusChip label={c.status === "pending" ? "With us" : c.status === "rejected" ? "Not accepted" : c.status === "withdrawn" ? "Taken back" : "Live"} tone={c.status === "pending" ? "blue" : c.status === "rejected" ? "red" : c.status === "withdrawn" ? "gray" : "green"} />
                    <span className="text-sm text-ink-soft">{c.created_at ? new Date(c.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : ""}</span>
                  </div>
                  <ul className="mt-2 list-disc pl-5 text-base text-ink">
                    {describeChange(c.payload, c.before).map((l) => <li key={l.field}>{l.label}</li>)}
                  </ul>
                  <p className="mt-2 text-base text-ink">{c.status === "rejected" ? changeDeclinedLine(c.review_reason) : c.status === "pending" || c.status === "approved" || c.status === "auto_approved" ? changeOutcomeLine(c.status) : "You took this back."}</p>
                  {c.status === "pending" && (
                    <p className="mt-2"><button type="button" className={textBtn} disabled={busy} onClick={() => run(() => withdrawChange(sb(), c.id), "Taken back.")}>Take this back</button></p>
                  )}
                </li>
              ))}
            </ul>
          )}
      </section>

      <section aria-labelledby="ce-history" className="mt-10">
        <h2 id="ce-history" className="text-2xl font-bold text-ink">What has happened</h2>
        {log === null ? <p className="mt-2 text-base text-ink-soft">History isn&apos;t available yet.</p>
          : log.length === 0 ? <p className="mt-2 text-base text-ink-soft">Nothing yet.</p>
          : (
            <ul className="mt-3 divide-y divide-line rounded-2xl border border-line-strong bg-paper">
              {log.map((l) => (
                <li key={l.id} className="flex flex-wrap justify-between gap-2 px-4 py-3 text-base text-ink">
                  <span>{historyLine(l)}</span>
                  <span className="text-ink-soft">{l.created_at ? new Date(l.created_at).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Europe/London" }) : ""}</span>
                </li>
              ))}
            </ul>
          )}
      </section>
    </div>
  );
}

function Performance({ o, nowMs, busy, restorable, onCancel, onRestore, onNote }: {
  o: OccurrenceRow; nowMs: number; busy: boolean; restorable: boolean; onCancel: () => void; onRestore: () => void; onNote: (n: string) => void;
}) {
  const past = isPast(o.starts_at, nowMs);
  const [note, setNote] = useState(o.note ?? "");
  const cancelled = o.status === "cancelled";
  return (
    <li className="rounded-2xl border border-line-strong bg-paper p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-lg font-semibold text-ink">{describeOccurrence(o)}</p>
        <StatusChip label={past ? "Already happened" : cancelled ? "Cancelled" : "On"} tone={past ? "gray" : cancelled ? "red" : "green"} />
      </div>
      {!past && (
        <>
          <div className="mt-3 flex flex-wrap gap-4">
            {!cancelled && <SecondaryButton disabled={busy} onClick={onCancel}>{PERFORMANCE_CANCELLED_BUTTON}<span className="sr-only">: {describeOccurrence(o)}</span></SecondaryButton>}
            {cancelled && restorable && <SecondaryButton disabled={busy} onClick={onRestore}>Undo the cancellation<span className="sr-only">: {describeOccurrence(o)}</span></SecondaryButton>}
          </div>
          {cancelled && !restorable && <p className="mt-2 text-base text-ink-soft">To put this one back on, please ask OneShetland.</p>}
          <div className="mt-3">
            <label htmlFor={`note-${o.id}`} className="block text-base font-semibold">A note for this day <span className="font-normal text-ink-soft">(optional)</span></label>
            <div className="mt-1 flex flex-wrap gap-3">
              <TextInput id={`note-${o.id}`} value={note} maxLength={200} onChange={(e) => setNote(e.target.value)} className="min-w-0 flex-1" />
              <SecondaryButton disabled={busy || note.trim() === (o.note ?? "").trim()} onClick={() => onNote(note)}>Save note<span className="sr-only"> for {describeOccurrence(o)}</span></SecondaryButton>
            </div>
          </div>
        </>
      )}
    </li>
  );
}

function ChangeForm({ trusted, eventId, event, future, nowMs, userId, onClose, onDone }: {
  trusted: boolean | null; eventId: string; event: NonNullable<ContributorView["event"]>; future: ReturnType<typeof currentFutureDates>; nowMs: number; userId: string; onClose: () => void; onDone: (text: string) => void;
}) {
  const [f, setF] = useState({ title: event.title ?? "", description: event.description ?? "", venue: event.venue ?? "", price_text: event.price_text ?? "", contact_info: event.contact_info ?? "", ticket_url: event.ticket_url ?? "", cover_url: event.cover_url ?? null as string | null });
  const [rows, setRows] = useState<DateRow[]>(() => (future.length ? rowsFromOccurrences(future) : [blankRow()]));
  const [datesTouched, setDatesTouched] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [rowIssues, setRowIssues] = useState<RowIssue[]>([]);
  const [banner, setBanner] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [posterBusy, setPosterBusy] = useState(false);
  const [tick, setTick] = useState(0);
  const reqId = useRef<string | null>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const summary = useRef<HTMLDivElement>(null);
  useEffect(() => { heading.current?.focus(); }, []);
  useEffect(() => { if (tick) summary.current?.focus(); }, [tick]);
  const today = utcToLondonParts(new Date(nowMs).toISOString())?.date ?? "";
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((x) => ({ ...x, [k]: v }));

  async function send() {
    setBanner(null);
    const b = buildChange({ event, future }, { ...f, rows }, Date.now(), datesTouched);
    if (!b.ok) {
      setErrors(b.errors); setRowIssues(b.rowIssues);
      if (b.nothingChanged) setBanner(CHANGE_FORM_NOTHING);
      setTick((t) => t + 1);
      return;
    }
    setErrors({}); setRowIssues([]);
    setBusy(true);
    const r = await requestChange(sb(), eventId, b.payload, (reqId.current ??= crypto.randomUUID()));
    setBusy(false);
    if (r.ok) { reqId.current = null; onDone(changeOutcomeLine(r.data.status)); return; }
    if (r.error.kind === "validation" && r.error.field && ["title", "description", "venue", "price_text", "contact_info", "ticket_url", "cover_url", "occurrences"].includes(r.error.field)) {
      setErrors({ [r.error.field]: r.error.message });
    } else setBanner(r.error.message);
    setTick((t) => t + 1);
  }

  async function onPoster(file: File | undefined) {
    if (!file) return;
    setPosterBusy(true);
    const r = await uploadPoster(sb(), userId, file);
    setPosterBusy(false);
    if (r.ok) set("cover_url", r.data); else setErrors((e) => ({ ...e, cover_url: r.error.message }));
  }

  const items: { id: string; message: string }[] = [];
  for (const [k, m] of Object.entries(errors)) if (!(k === "occurrences" && rowIssues.length)) items.push({ id: k === "occurrences" ? "cf-dates" : `cf-${k}`, message: m });
  rowIssues.forEach((r) => items.push({ id: `cfd-${r.rowId}-${r.field === "row" ? "date" : r.field}`, message: `Date ${rows.findIndex((x) => x.id === r.rowId) + 1}: ${r.message}` }));
  if (banner) items.push({ id: "cf-head", message: banner });

  const text = (k: "title" | "venue" | "price_text" | "contact_info" | "ticket_url", label: string, help?: string) => (
    <Field id={`cf-${k}`} label={label} help={help} error={errors[k]}>
      {(a) => <TextInput id={a.id} value={f[k]} aria-invalid={a.invalid || undefined} aria-describedby={a.describedBy} onChange={(e) => set(k, e.target.value)} />}
    </Field>
  );

  return (
    <div className="mt-4 rounded-2xl border border-line-strong bg-paper p-5">
      <h3 id="cf-head" ref={heading} tabIndex={-1} className="text-xl font-bold text-ink outline-none">Ask for a change</h3>
      <p className="mt-1 text-base text-ink-soft">{trusted === true ? TRUSTED_CHANGE_INTRO : trusted === false ? changeRouteLine("after_approval") : CHANGE_FORM_INTRO}</p>
      <ErrorSummary ref={summary} items={items} />
      {text("title", "Event name", "A new name is checked by us before it goes live.")}
      <Field id="cf-description" label="Description" error={errors.description}>
        {(a) => <TextArea id={a.id} rows={5} value={f.description} aria-invalid={a.invalid || undefined} aria-describedby={a.describedBy} onChange={(e) => set("description", e.target.value)} />}
      </Field>
      {text("venue", "Place")}
      {text("price_text", "Price", "A new price is checked by us before it goes live.")}
      {text("contact_info", "Contact details")}
      {text("ticket_url", "Ticket link", "It must start with https://")}
      <Field id="cf-cover_url" label="Poster" help={`${POSTER_HELP} A new poster is checked by us before it goes live.`} error={errors.cover_url}>
        {(a) => (
          <div>
            <input id={a.id} type="file" accept="image/jpeg,image/png,image/webp" disabled={posterBusy} aria-describedby={a.describedBy} onChange={(e) => onPoster(e.target.files?.[0])}
              className={`block w-full min-h-12 rounded-xl border border-line-strong bg-paper p-3 text-base ${focusRing}`} />
            {f.cover_url && (<><img src={f.cover_url} alt="Your poster" className="mt-3 max-h-48 rounded-xl border border-line-strong" /></>)}
          </div>
        )}
      </Field>
      <div className="mt-6">
        <h4 className="text-lg font-semibold text-ink">Dates</h4>
        <p className="text-base text-ink-soft">Only dates still to come can be changed. Add, move or remove days here.</p>
        <div id="cf-dates" tabIndex={-1} className="mt-3 outline-none">
          <DatesBuilder rows={rows} onChange={(r) => { setRows(r); setDatesTouched(true); }} issues={rowIssues} today={today} idBase="cfd" />
        </div>
      </div>
      <div className="mt-8 flex flex-wrap items-center gap-4">
        <PrimaryButton onClick={send} disabled={busy} aria-busy={busy}>{busy ? "Sending..." : "Send this change"}</PrimaryButton>
        <button type="button" className={textBtn} onClick={onClose}>Never mind</button>
      </div>
    </div>
  );
}

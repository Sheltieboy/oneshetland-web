"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { blankRow, describeOccurrence, utcToLondonParts, type DateRow, type RowIssue } from "@/lib/event-dates-builder";
import {
  ADULT_CONFIRM_TEXT, FIELD_ORDER, STEP_FIELDS, validateStep, validateSubmission, type FieldName, type SubmissionForm as FormState,
} from "@/lib/event-submission-validate";
import { submitEvent, uploadPoster, type Sb } from "@/lib/event-submissions-client";
import {
  DATES_HELP, DESCRIPTION_HELP, FORM_INTRO, ORGANISER_HELP, POSTER_HELP, REVIEW_INTRO, SUBMIT_THANKS_BODY, SUBMIT_THANKS_TITLE, TICKET_LINK_HELP,
} from "@/lib/contributor-copy";
import { HubSuggestion } from "@/components/events/front-door/HubSuggestion";
import { DatesBuilder } from "@/components/events/DatesBuilder";
import { ErrorSummary, Field, Notice, PrimaryButton, SecondaryButton, TextArea, TextInput, textBtn, focusRing } from "@/components/events/submit-ui";

type Step = "about" | "where" | "when" | "more" | "review" | "done";
const STEPS: Step[] = ["about", "where", "when", "more", "review"];
const TITLES: Record<Step, string> = {
  about: "About your event", where: "Where is it?", when: "When is it?", more: "A few more details", review: "Check it, then send it", done: SUBMIT_THANKS_TITLE,
};
const FIELD_STEP: Partial<Record<FieldName, Step>> = {
  organiser_name: "about", title: "about", description: "about", venue: "where", locality: "where", occurrences: "when",
  price_text: "more", contact_info: "more", ticket_url: "more", cover_url: "more", adult_confirmed: "review",
};
const fid = (f: string) => `sf-${f}`;

export function SubmissionForm({ slug, categoryLabel, userId, staff, onRestart, onChangeOrganiser, suggestHub = false }: {
  slug: string; categoryLabel: string; userId: string; staff: boolean; onRestart: () => void; onChangeOrganiser?: () => void;
  /** Computed by the page from the member's own submissions (shouldSuggestHub); only ever a gentle note on the thank-you screen. */
  suggestHub?: boolean;
}) {
  const [step, setStep] = useState<Step>("about");
  const [form, setForm] = useState<Omit<FormState, "request_id" | "category" | "rows">>({
    organiser_name: "", title: "", description: "", venue: "", locality: "", price_text: "", contact_info: "", ticket_url: "", cover_url: null, adult_confirmed: false,
  });
  const [rows, setRows] = useState<DateRow[]>(() => [blankRow()]);
  const [errors, setErrors] = useState<Partial<Record<FieldName, string>>>({});
  const [rowIssues, setRowIssues] = useState<RowIssue[]>([]);
  const [banner, setBanner] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [posterBusy, setPosterBusy] = useState(false);
  const [posterNote, setPosterNote] = useState<string | null>(null);
  const [errTick, setErrTick] = useState(0);
  const requestId = useRef<string | null>(null);
  const inFlight = useRef(false);   // a double tap must not send twice (state updates are too slow to stop it)

  const heading = useRef<HTMLHeadingElement>(null);
  const summary = useRef<HTMLDivElement>(null);
  // Runs on arrival (the person has just chosen a kind) and on every step change, so focus never falls back to the page body.
  useEffect(() => { heading.current?.focus(); }, [step]);
  useEffect(() => { if (errTick > 0) summary.current?.focus(); }, [errTick]);

  const today = useMemo(() => utcToLondonParts(new Date().toISOString())?.date ?? "", []);
  const full = (): FormState => ({ ...form, request_id: (requestId.current ??= crypto.randomUUID()), category: slug, rows });
  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => {
    setForm((f) => ({ ...f, [k]: v }));
    setErrors((e) => { if (!(k in e)) return e; const n = { ...e }; delete n[k as FieldName]; return n; });   // fixing a box clears its message
  };
  const err = (f: FieldName) => errors[f];

  const summaryItems = () => {
    const items: { id: string; message: string }[] = [];
    for (const k of FIELD_ORDER) {
      if (!errors[k]) continue;
      if (k === "occurrences" && rowIssues.length) continue;
      items.push({ id: k === "occurrences" ? "sf-dates" : fid(k), message: errors[k]! });
    }
    rowIssues.forEach((r) => {
      const n = rows.findIndex((x) => x.id === r.rowId) + 1;
      items.push({ id: `dates-${r.rowId}-${r.field === "row" ? "date" : r.field}`, message: `Date ${n}: ${r.message}` });
    });
    return items;
  };

  function showProblems(e: Partial<Record<FieldName, string>>, ri: RowIssue[]) { setErrors(e); setRowIssues(ri); setErrTick((t) => t + 1); }

  function next() {
    setBanner(null);
    const v = validateStep(full(), STEP_FIELDS[step as keyof typeof STEP_FIELDS] ?? [], new Date(), userId);
    if (!v.ok) { showProblems(v.errors, v.rowIssues); return; }
    setErrors({}); setRowIssues([]);
    setStep(STEPS[STEPS.indexOf(step) + 1]);
  }
  function back() { setErrors({}); setRowIssues([]); setBanner(null); setStep(STEPS[Math.max(0, STEPS.indexOf(step) - 1)]); }

  async function send() {
    if (inFlight.current) return;
    setBanner(null);
    const v = validateSubmission(full(), new Date(), userId);
    if (!v.ok) {
      showProblems(v.errors, v.rowIssues);
      const firstBad = v.order[0];
      const s = firstBad ? FIELD_STEP[firstBad] : undefined;
      if (s && s !== "review") setStep(s);
      return;
    }
    inFlight.current = true; setBusy(true);
    const r = await submitEvent(createClient() as unknown as Sb, v.payload);
    inFlight.current = false; setBusy(false);
    if (r.ok) { setErrors({}); setRowIssues([]); setStep("done"); return; }
    const f = r.error.field as FieldName | undefined;
    if (r.error.kind === "validation" && f && FIELD_STEP[f]) {
      showProblems({ [f]: r.error.message }, []);
      setStep(FIELD_STEP[f]!);
      return;
    }
    setBanner(r.error.message);
  }

  async function onPoster(file: File | undefined) {
    if (!file) return;
    setPosterBusy(true); setPosterNote(null);
    const r = await uploadPoster(createClient() as unknown as Sb, userId, file);
    setPosterBusy(false);
    if (r.ok) set("cover_url", r.data); else setPosterNote(r.error.message);
  }

  const idx = STEPS.indexOf(step);
  const items = summaryItems();
  const mutedP = "mt-1 text-base text-ink-soft";

  if (step === "done") {
    return (
      <section aria-labelledby="sf-done" className="mt-6 rounded-2xl border border-emerald-700 bg-emerald-50 p-6">
        <h2 id="sf-done" ref={heading} tabIndex={-1} className="text-2xl font-bold text-emerald-950 outline-none">{TITLES.done}</h2>
        <p className="mt-3 text-lg text-emerald-950">{SUBMIT_THANKS_BODY}</p>
        <p className="mt-5"><Link href="/account/event-submissions" className={`inline-flex min-h-12 items-center rounded-pill bg-navy px-6 py-3 text-lg font-bold text-white ${focusRing}`}>See my event submissions</Link></p>
        <button type="button" className={`${textBtn} mt-3`} onClick={onRestart}>Add another event</button>
        {suggestHub && <HubSuggestion />}
      </section>
    );
  }

  return (
    <section aria-labelledby="sf-heading" className="mt-6">
      <p className="text-base font-semibold text-ink-soft">{categoryLabel} · Step {idx + 1} of {STEPS.length}</p>
      <h2 id="sf-heading" ref={heading} tabIndex={-1} className="mt-1 text-2xl font-bold text-ink outline-none">{TITLES[step]}</h2>
      {step === "about" && <p className={mutedP}>{FORM_INTRO}</p>}
      {staff && step === "about" && <Notice tone="warn">Staff preview. Your submission will wait in the queue like anyone else&apos;s.</Notice>}

      <ErrorSummary ref={summary} items={items} />
      {banner && <Notice tone="warn" role="alert">{banner}</Notice>}

      {step === "about" && (<>
        <Field id={fid("organiser_name")} label="Who is running this?" help={ORGANISER_HELP} error={err("organiser_name")}>
          {(a) => <TextInput id={a.id} value={form.organiser_name} maxLength={140} autoComplete="organization" aria-invalid={a.invalid || undefined} aria-describedby={a.describedBy} onChange={(e) => set("organiser_name", e.target.value)} />}
        </Field>
        <Field id={fid("title")} label="What is the event called?" error={err("title")}>
          {(a) => <TextInput id={a.id} value={form.title} maxLength={220} aria-invalid={a.invalid || undefined} aria-describedby={a.describedBy} onChange={(e) => set("title", e.target.value)} />}
        </Field>
        <Field id={fid("description")} label="Tell people about it" help={DESCRIPTION_HELP} error={err("description")}>
          {(a) => <TextArea id={a.id} rows={6} value={form.description} maxLength={2100} aria-invalid={a.invalid || undefined} aria-describedby={a.describedBy} onChange={(e) => set("description", e.target.value)} />}
        </Field>
      </>)}

      {step === "where" && (<>
        <Field id={fid("venue")} label="Where is it?" help="The name of the hall, pub, school or place." error={err("venue")}>
          {(a) => <TextInput id={a.id} value={form.venue} maxLength={220} aria-invalid={a.invalid || undefined} aria-describedby={a.describedBy} onChange={(e) => set("venue", e.target.value)} />}
        </Field>
        <Field id={fid("locality")} label="Which village or town?" optional error={err("locality")}>
          {(a) => <TextInput id={a.id} value={form.locality} maxLength={120} aria-invalid={a.invalid || undefined} aria-describedby={a.describedBy} onChange={(e) => set("locality", e.target.value)} />}
        </Field>
      </>)}

      {step === "when" && (
        <div className="mt-5">
          <p className={mutedP}>{DATES_HELP}</p>
          <div id="sf-dates" tabIndex={-1} className="mt-4 outline-none">
            <DatesBuilder rows={rows} onChange={setRows} issues={rowIssues} today={today} idBase="dates" />
          </div>
        </div>
      )}

      {step === "more" && (<>
        <Field id={fid("price_text")} label="What does it cost?" help="For example Free, £5 or Pay what you like." optional error={err("price_text")}>
          {(a) => <TextInput id={a.id} value={form.price_text} maxLength={120} aria-invalid={a.invalid || undefined} aria-describedby={a.describedBy} onChange={(e) => set("price_text", e.target.value)} />}
        </Field>
        <Field id={fid("contact_info")} label="How can people get in touch?" help="An email address or phone number people can use." optional error={err("contact_info")}>
          {(a) => <TextInput id={a.id} value={form.contact_info} maxLength={320} autoComplete="off" aria-invalid={a.invalid || undefined} aria-describedby={a.describedBy} onChange={(e) => set("contact_info", e.target.value)} />}
        </Field>
        <Field id={fid("ticket_url")} label="A link to book tickets" help={TICKET_LINK_HELP} optional error={err("ticket_url")}>
          {(a) => <TextInput id={a.id} type="url" inputMode="url" value={form.ticket_url} maxLength={520} placeholder="https://" aria-invalid={a.invalid || undefined} aria-describedby={a.describedBy} onChange={(e) => set("ticket_url", e.target.value)} />}
        </Field>
        <Field id={fid("cover_url")} label="A poster or picture" help={POSTER_HELP} optional error={err("cover_url")}>
          {(a) => (
            <div>
              <input id={a.id} type="file" accept="image/jpeg,image/png,image/webp" disabled={posterBusy} aria-describedby={a.describedBy} onChange={(e) => onPoster(e.target.files?.[0])}
                className={`block w-full min-h-12 rounded-xl border border-line-strong bg-paper p-3 text-base text-ink ${focusRing}`} />
              {posterBusy && <p role="status" className={mutedP}>Uploading your picture...</p>}
              {posterNote && <p role="alert" className="mt-2 text-base font-semibold text-rose-700">{posterNote}</p>}
              {form.cover_url && (
                <div className="mt-3">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={form.cover_url} alt="Your poster" className="max-h-56 rounded-xl border border-line-strong" />
                  <button type="button" className={textBtn} onClick={() => set("cover_url", null)}>Remove this picture</button>
                </div>
              )}
            </div>
          )}
        </Field>
      </>)}

      {step === "review" && (<>
        <p className={mutedP}>{REVIEW_INTRO}</p>
        <Review form={full()} />
        <div className="mt-6 rounded-2xl border border-line-strong bg-paper p-4">
          {/* The whole row is the tap target (the label), so the box itself can stay a normal size. */}
          <label htmlFor={fid("adult_confirmed")} className="flex min-h-14 cursor-pointer items-start gap-3 text-lg font-semibold text-ink">
            <input id={fid("adult_confirmed")} type="checkbox" checked={form.adult_confirmed} onChange={(e) => set("adult_confirmed", e.target.checked)}
              aria-invalid={err("adult_confirmed") ? true : undefined} aria-describedby={err("adult_confirmed") ? `${fid("adult_confirmed")}-err` : undefined}
              className={`mt-1 h-7 w-7 shrink-0 accent-navy ${focusRing}`} />
            <span>{ADULT_CONFIRM_TEXT}</span>
          </label>
          {err("adult_confirmed") && <p id={`${fid("adult_confirmed")}-err`} className="mt-2 text-base font-semibold text-rose-700">{err("adult_confirmed")}</p>}
        </div>
      </>)}

      <div className="mt-8 flex flex-wrap items-center gap-4">
        {idx > 0 && <SecondaryButton onClick={back} disabled={busy}>Back</SecondaryButton>}
        {step !== "review" ? <PrimaryButton onClick={next}>Next</PrimaryButton>
          : <PrimaryButton onClick={send} disabled={busy} aria-busy={busy}>{busy ? "Sending..." : "Send to OneShetland"}</PrimaryButton>}
        {onChangeOrganiser && <button type="button" className={textBtn} onClick={onChangeOrganiser}>Change who is organising this</button>}
        <button type="button" className={textBtn} onClick={onRestart}>Start again</button>
      </div>
    </section>
  );
}

function Review({ form }: { form: FormState }) {
  const v = validateSubmission({ ...form, adult_confirmed: true }, new Date());
  const occs = v.ok ? v.payload.occurrences : [];
  const row = (label: string, value: string | null | undefined) => (
    <div className="border-b border-line py-3"><dt className="text-base font-semibold text-ink-soft">{label}</dt><dd className="mt-1 whitespace-pre-line text-lg text-ink">{value && value.trim() ? value : "Not given"}</dd></div>
  );
  return (
    <dl className="mt-4 rounded-2xl border border-line-strong bg-paper px-4">
      {row("Shown to the public as", form.organiser_name.trim())}
      {row("Event name", form.title.trim())}
      {row("About", form.description.trim())}
      {row("Place", [form.venue.trim(), form.locality.trim()].filter(Boolean).join(", "))}
      <div className="border-b border-line py-3"><dt className="text-base font-semibold text-ink-soft">Dates</dt>
        <dd className="mt-1 text-lg text-ink"><ul className="list-disc pl-5">{occs.map((o) => <li key={o.starts_at}>{describeOccurrence(o)}{o.note ? ` (${o.note})` : ""}</li>)}</ul></dd></div>
      {row("Price", form.price_text.trim())}
      {row("Contact", form.contact_info.trim())}
      {row("Ticket link", form.ticket_url.trim())}
      <div className="py-3"><dt className="text-base font-semibold text-ink-soft">Poster</dt><dd className="mt-1 text-lg text-ink">{form.cover_url ? "Added" : "Not added"}</dd></div>
    </dl>
  );
}

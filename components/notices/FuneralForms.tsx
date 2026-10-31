"use client";

import { useState } from "react";
import Link from "next/link";
import { noticeWrite } from "@/app/notices/actions";
import { EMPTY_FUNERAL_FORM, buildFuneralPayload, buildFuneralUpdatePayload, validateFuneralEdit, validateFuneralForm, type FieldErrors, type FuneralFormInput } from "@/lib/notices-alerts";
import { Check, Field, Status, btnDanger, btnPrimary, btnQuiet, inputCls, useAction } from "@/components/notices/Fields";

const KINDS = [["funeral", "Funeral service"], ["burial", "Burial"], ["cremation", "Cremation"], ["memorial", "Memorial service"], ["private", "Private service"]];

/** The considerate submission form. Everything beyond the essentials is genuinely optional; arrangements are sent only on the explicit choice. */
export type FuneralEdit = { id: string; initial: FuneralFormInput; reviewMessage: string | null };
export function FuneralSubmitForm({ areas, edit }: { areas: { id: string; name: string }[]; edit?: FuneralEdit }) {
  const [f, setF] = useState<FuneralFormInput>(edit?.initial ?? EMPTY_FUNERAL_FORM);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [done, setDone] = useState(false);
  const { state, run } = useAction();
  const set = <K extends keyof FuneralFormInput>(k: K, v: FuneralFormInput[K]) => setF((p) => ({ ...p, [k]: v }));
  const txt = (k: keyof FuneralFormInput) => ({ value: f[k] as string, onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => set(k, e.target.value as never), className: inputCls });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const errs = edit ? validateFuneralEdit(f) : validateFuneralForm(f);
    setErrors(errs);
    if (Object.keys(errs).length) return;
    const r = await run(() => edit ? noticeWrite("update_my_funeral_submission", { p_id: edit.id, p: buildFuneralUpdatePayload(f) }) : noticeWrite("submit_funeral_notice", { p: buildFuneralPayload(f) }), "");
    if (r.ok) setDone(true);
  }

  if (done) {
    return (
      <div className="rounded-xl border border-line bg-paper p-6 shadow-soft">
        <h2 className="font-display text-2xl font-bold text-ink">{edit ? "Thank you. Your changes are saved." : "Thank you. We have your announcement."}</h2>
        <p className="mt-3 text-ink-soft">Nothing is published yet. We check every announcement before it appears, and we may telephone you (or the funeral director) to confirm the details. If anything is unclear we will say so on your submissions page.</p>
        <p className="mt-4"><Link href="/notices/funeral/mine" className={btnPrimary}>See my submissions</Link></p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} noValidate className="space-y-8">
      {edit?.reviewMessage && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950"><p className="font-bold">A message from our team</p><p className="mt-1 whitespace-pre-line">{edit.reviewMessage}</p></div>
      )}
      <div className="rounded-xl border border-line bg-sand/60 p-4 text-sm text-ink-soft">
        <p className="font-semibold text-ink">{edit ? "Changing your announcement" : "Before you begin"}</p>
        <p className="mt-1">Notices are checked before they are published, and we may telephone you to confirm them. Nothing appears on the website until we have done that. Your phone number or email address is only used for that check and is never published.</p>
      </div>

      <fieldset className="space-y-4">
        <legend className="font-display text-xl font-bold text-ink">The announcement</legend>
        <Field label="Full name" error={errors.fullName} htmlFor="fn"><input id="fn" autoComplete="off" {...txt("fullName")} /></Field>
        <Field label="Known as" optional hint="A preferred or familiar name, if different." htmlFor="pn"><input id="pn" {...txt("preferredName")} /></Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Date of birth" optional error={errors.bornOn} htmlFor="bo"><input id="bo" type="date" {...txt("bornOn")} /></Field>
          <Field label="Date of death" optional error={errors.diedOn} htmlFor="do"><input id="do" type="date" {...txt("diedOn")} /></Field>
        </div>
        <Field label="Announcement" optional hint="A few words, up to 1,500 characters. Please leave web addresses out." error={errors.announcement} htmlFor="an"><textarea id="an" rows={5} {...txt("announcement")} /></Field>
        {!edit && <Field label="Area" optional hint="Where the family would like this to appear. Leave blank to show it in every area." htmlFor="ar">
          <select id="ar" {...txt("areaId")}><option value="">No particular area</option>{areas.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</select>
        </Field>}
        <Field label="Photograph web address" optional hint="A link starting https://. It is shown as a small oval portrait." error={errors.photoUrl} htmlFor="ph"><input id="ph" type="url" inputMode="url" {...txt("photoUrl")} /></Field>
      </fieldset>

      <fieldset className="space-y-4">
        <legend className="font-display text-xl font-bold text-ink">Funeral arrangements</legend>
        <Check checked={f.publishArrangements} onChange={(v) => set("publishArrangements", v)}>I want to publish the funeral arrangements</Check>
        <p className="text-sm text-ink-muted">If you leave this unticked, no date, time or place is shown, even if you have them to hand.</p>
        {f.publishArrangements && (
          <div className="space-y-4 rounded-xl border border-line bg-paper p-4">
            <Field label="Kind of service" optional htmlFor="sk"><select id="sk" {...txt("serviceKind")}><option value="">Not stated</option>{KINDS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></Field>
            <Field label="Place" optional htmlFor="sv"><input id="sv" {...txt("serviceVenue")} /></Field>
            <Field label="Date and time" optional htmlFor="sa"><input id="sa" type="datetime-local" {...txt("serviceAt")} /></Field>
            <Field label="Notes" optional hint="For example, who is welcome to attend." error={errors.serviceNotes} htmlFor="sn"><textarea id="sn" rows={3} {...txt("serviceNotes")} /></Field>
          </div>
        )}
      </fieldset>

      <fieldset className="space-y-4">
        <legend className="font-display text-xl font-bold text-ink">Family requests</legend>
        <Field label="Flowers or other requests" optional error={errors.familyRequests} htmlFor="fr"><textarea id="fr" rows={2} {...txt("familyRequests")} /></Field>
        <Field label="Donations" optional hint="For example, a charity the family would like to support." error={errors.donationInfo} htmlFor="di"><textarea id="di" rows={2} {...txt("donationInfo")} /></Field>
        <Field label="Donation page web address" optional error={errors.donationUrl} htmlFor="du"><input id="du" type="url" inputMode="url" {...txt("donationUrl")} /></Field>
      </fieldset>

      <fieldset className="space-y-2">
        <legend className="font-display text-xl font-bold text-ink">Notifications</legend>
        <p className="text-sm text-ink-muted">Some people choose to be told about funeral announcements. Both choices are off unless you tick them.</p>
        <Check checked={f.announceInNotifications} onChange={(v) => { set("announceInNotifications", v); if (!v) set("announceNameInPreview", false); }}>The family is happy for a discreet notification to be sent to people who have opted in</Check>
        <Check checked={f.announceNameInPreview} disabled={!f.announceInNotifications} onChange={(v) => set("announceNameInPreview", v)}>The notification may show the name</Check>
      </fieldset>

      {!edit && <fieldset className="space-y-4">
        <legend className="font-display text-xl font-bold text-ink">About you</legend>
        <p className="text-sm text-ink-muted">So that we can check the details. This is private and never published.</p>
        <Field label="I am submitting this as" htmlFor="sr"><select id="sr" {...txt("submitterRole")}><option value="family">Family or a friend</option><option value="funeral_director">A funeral director</option></select></Field>
        <Field label="Your name" error={errors.submitterName} htmlFor="sname"><input id="sname" autoComplete="name" {...txt("submitterName")} /></Field>
        <Field label="Your relationship" optional htmlFor="rel"><input id="rel" {...txt("submitterRelationship")} /></Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Phone" optional htmlFor="ph1"><input id="ph1" type="tel" autoComplete="tel" {...txt("submitterPhone")} /></Field>
          <Field label="Email" optional htmlFor="em"><input id="em" type="email" autoComplete="email" {...txt("submitterEmail")} /></Field>
        </div>
        {errors.contact && <p role="alert" className="text-sm font-medium text-rose-700">{errors.contact}</p>}
        <Check checked={f.familyAuthorised} onChange={(v) => set("familyAuthorised", v)}>I am authorised by the family to make this announcement</Check>
        {errors.familyAuthorised && <p role="alert" className="text-sm font-medium text-rose-700">{errors.familyAuthorised}</p>}
      </fieldset>}
      {edit && <p className="text-sm text-ink-muted">Your contact details and the area stay as you first gave them. Saving sends the announcement back to us for checking.</p>}

      <Status state={state} />
      <button type="submit" disabled={state.busy} className={btnPrimary}>{state.busy ? "Sending…" : "Send for checking"}</button>
    </form>
  );
}

export type Submission = { id: string; status: string; full_name: string; created_at: string; published_at: string | null; review_message: string | null };

const STATUS_TEXT: Record<string, string> = {
  submitted: "Received. Waiting to be checked.",
  in_review: "Being checked by our team.",
  needs_info: "We need a little more from you.",
  approved: "Published.",
  rejected: "Not published.",
  withdrawn: "Withdrawn. Nothing is shown.",
  taken_down: "Removed from the website.",
};

/** A request to staff to correct (or remove) a PUBLISHED announcement. Any signed-in person can send one; staff decide. */
export function ChangeRequestForm({ id, signedIn, nextPath }: { id: string; signedIn: boolean; nextPath: string }) {
  const [kind, setKind] = useState<"correction" | "takedown">("correction");
  const [message, setMessage] = useState("");
  const [contact, setContact] = useState("");
  const { state, run } = useAction();
  if (!signedIn) return <p className="text-sm text-ink-soft"><Link className="font-semibold underline" href={`/sign-in?next=${encodeURIComponent(nextPath)}`}>Sign in</Link> to ask for a correction or removal.</p>;
  return (
    <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); void run(() => noticeWrite("request_funeral_notice_change", { p_id: id, p_kind: kind, p_message: message, p_contact: contact.trim() || null }), "Thank you. We have your request and will be in touch."); }}>
      <Field label="What would you like us to do?" htmlFor={`k${id}`}>
        <select id={`k${id}`} className={inputCls} value={kind} onChange={(e) => setKind(e.target.value as "correction" | "takedown")}><option value="correction">Correct something</option><option value="takedown">Remove this announcement</option></select>
      </Field>
      <Field label="Details" hint="At least five characters." htmlFor={`m${id}`}><textarea id={`m${id}`} rows={3} className={inputCls} value={message} onChange={(e) => setMessage(e.target.value)} /></Field>
      <Field label="How can we reach you?" optional htmlFor={`c${id}`}><input id={`c${id}`} className={inputCls} value={contact} onChange={(e) => setContact(e.target.value)} /></Field>
      <Status state={state} />
      <button type="submit" disabled={state.busy || message.trim().length < 5} className={btnQuiet}>{state.busy ? "Sending…" : "Send request"}</button>
    </form>
  );
}

export function MySubmissions({ rows }: { rows: Submission[] }) {
  const [list, setList] = useState(rows);
  const [open, setOpen] = useState<string | null>(null);
  const { state, run } = useAction();
  if (list.length === 0) return <p className="rounded-xl border border-line bg-sand/60 p-4 text-sm text-ink-soft">You have not submitted any announcements. <Link className="font-semibold underline" href="/notices/funeral/submit">Submit one</Link>.</p>;
  return (
    <div className="space-y-4">
      <Status state={state} />
      <ul className="space-y-4">
        {list.map((s) => {
          const live = ["submitted", "in_review", "needs_info", "approved"].includes(s.status);
          return (
            <li key={s.id} className="rounded-xl border border-line bg-paper p-5 shadow-soft">
              <p className="font-display text-xl font-bold text-ink">{s.full_name}</p>
              <p className="mt-1 text-sm font-semibold text-ink-soft">{STATUS_TEXT[s.status] ?? s.status}</p>
              {(s.status === "needs_info" || s.status === "rejected") && s.review_message && (
                <div className="mt-3 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950"><p className="font-bold">A message from our team</p><p className="mt-1 whitespace-pre-line">{s.review_message}</p>{s.status === "needs_info" && <p className="mt-2 text-amber-900">Please update the announcement below. We may also telephone you.</p>}</div>
              )}
              <div className="mt-3 flex flex-wrap gap-2">
                {(s.status === "submitted" || s.status === "needs_info") && <Link href={`/notices/funeral/mine/${s.id}`} className={btnPrimary}>Edit</Link>}
                {s.status === "approved" && <Link href={`/notices/funeral/${s.id}`} className={btnQuiet}>View the announcement</Link>}
                {s.status === "approved" && <button type="button" className={btnQuiet} onClick={() => setOpen(open === s.id ? null : s.id)}>{open === s.id ? "Close" : "Ask for a correction"}</button>}
                {live && <button type="button" className={btnDanger} disabled={state.busy} onClick={async () => {
                  if (!window.confirm("Withdraw this announcement? It will no longer be shown.")) return;
                  const r = await run(() => noticeWrite("withdraw_my_funeral_notice", { p_id: s.id }), "Withdrawn.");
                  if (r.ok) setList((l) => l.map((x) => (x.id === s.id ? { ...x, status: "withdrawn" } : x)));
                }}>Withdraw</button>}
              </div>
              {open === s.id && <div className="mt-4 border-t border-line pt-4"><ChangeRequestForm id={s.id} signedIn nextPath="/notices/funeral/mine" /></div>}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { cancelPromoBooking, featureEdition, featureEditionHouse, grantPromoRight, reschedulePromoBooking, setOrganiserHouse } from "@/app/admin/editions/promotions/actions";
import { GRANT_DAYS, HOUSE_DAYS, KIND_TITLE, lastBookableDay, londonToday, previewWindow, summarise, usageLabel, usageOf, windowFull, windowUnknown, type BookingRow, type CalendarDay, type FeatureCandidate, type PromoKind } from "@/app/admin/editions/promotions/calendar";
import { Field, Notice, Panel, Pill, btnPrimary, btnQuiet, btnSecondary, inputCls } from "@/components/editions-manage/kit";
import { useAction } from "@/components/editions-manage/use-action";
import { day as dayLabel } from "@/components/admin/EditionsAdminParts";

const USE_TONE = { free: "gray", some: "green", full: "amber", over: "red" } as const;
const KINDS: PromoKind[] = ["homepage", "discovery"];

/** The administrator's promotion calendar: capacity by day, who is booked, cancel or move with a reason, and grant promotion days. Every change is audited by the database. */
// `candidates` defaults to none: a caller that does not pass it gets the "nothing can be featured yet" message, not a crash.
export function EditionsPromoCalendar({ range, days, bookings, editions, candidates = [], error, candidatesError = null }: { range: { from: string; to: string }; days: CalendarDay[]; bookings: BookingRow[]; editions: { id: string; label: string }[]; candidates?: FeatureCandidate[]; error: string | null; candidatesError?: string | null }) {
  const router = useRouter();
  const act = useAction();
  const [open, setOpen] = useState<{ id: string; mode: "cancel" | "move" } | null>(null);
  const [reason, setReason] = useState(""); const [start, setStart] = useState("");
  const [g, setG] = useState({ edition: editions[0]?.id ?? "", kind: "homepage", days: "7", reason: "" }); const gA = useAction();
  // Featuring an Edition: the one action that grants the days AND books them, so no second screen is needed.
  const [f, setF] = useState({ edition: candidates[0]?.edition_id ?? "", kind: "homepage" as PromoKind, start: londonToday(), days: "7", reason: "" });
  const fA = useAction();
  const chosen = candidates.find((c) => c.edition_id === f.edition);
  // A house promotion is only ever offered for an Edition OneShetland runs itself, and is never on by default.
  const [house, setHouse] = useState(false);
  const asHouse = house && !!chosen?.is_house;
  const maxDays = asHouse ? HOUSE_DAYS.max : GRANT_DAYS.max;
  const daysOk = Number.isInteger(Number(f.days)) && Number(f.days) >= 1 && Number(f.days) <= maxDays;
  // Marking an organiser as OneShetland's own: one row per organiser among the Editions that can be featured.
  const organisers = [...new Map(candidates.map((c) => [c.organiser_id, { id: c.organiser_id, name: c.organiser_name, house: c.is_house }])).values()].sort((a, b) => a.name.localeCompare(b.name));
  const [h, setH] = useState({ organiser: "", reason: "" });
  const hA = useAction();
  const hChosen = organisers.find((o) => o.id === h.organiser) ?? organisers[0];
  const fWindow = previewWindow(days, f.kind, f.start, Number(f.days) || 0);
  const fFull = windowFull(fWindow);
  const fUnknown = windowUnknown(fWindow);
  const fLast = chosen ? lastBookableDay(chosen) : null;
  const fEnd = fWindow.length ? fWindow[fWindow.length - 1].day : null;
  const fBeyond = !!(fLast && fEnd && fEnd > fLast);
  const close = () => { setOpen(null); setReason(""); setStart(""); };
  const submit = () => { if (!open) return; const id = open.id;
    act.run(() => (open.mode === "cancel" ? cancelPromoBooking({ booking: id, reason }) : reschedulePromoBooking({ booking: id, start, reason })), { success: open.mode === "cancel" ? "Booking cancelled." : "Booking moved.", onOk: () => { close(); router.refresh(); } }); };

  return (
    <div className="space-y-8">
      <Panel title="Feature an Edition" sub="Choose an Edition, a place and the dates. This grants the promotion days and books them in one step — there is no need to open the entitlement or organiser screens. The same availability, capacity and fairness rules apply as when an organiser books.">
        {candidatesError ? (
          <p role="alert" className="rounded-card border border-rose-300 bg-rose-50/70 px-3 py-2 text-sm font-semibold text-rose-800">{candidatesError}</p>
        ) : candidates.length === 0 ? (
          <p className="text-sm text-ink-muted">Nothing can be featured yet. An Edition becomes available here once it is published and approved, run by a verified Business or Hub, and covered by a live publishing package.</p>
        ) : (
          <form className="grid gap-3 sm:grid-cols-3" onSubmit={(e) => { e.preventDefault(); fA.run(() => (asHouse ? featureEditionHouse({ ...f, days: f.days }) : featureEdition({ ...f, days: f.days })), { success: asHouse ? "House promotion booked. It will appear on its first day." : "Featured. It will appear on its first day.", onOk: () => { setF({ ...f, reason: "" }); router.refresh(); } }); }}>
            <div className="sm:col-span-2"><Field label="Edition" htmlFor="f-ed">
              <select id="f-ed" className={inputCls} value={f.edition} onChange={(e) => setF({ ...f, edition: e.target.value })}>
                {candidates.map((c) => <option key={c.edition_id} value={c.edition_id}>{c.title} — {c.organiser_name}{c.is_house ? " (OneShetland's own)" : ""}</option>)}
              </select></Field></div>
            <Field label="Where" htmlFor="f-kind">
              <select id="f-kind" className={inputCls} value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value as PromoKind })}>
                <option value="homepage">{KIND_TITLE.homepage}</option><option value="discovery">{KIND_TITLE.discovery}</option>
              </select></Field>
            <Field label="First day" htmlFor="f-start"><input id="f-start" type="date" className={inputCls} value={f.start} onChange={(e) => setF({ ...f, start: e.target.value })} /></Field>
            <Field label="Days" htmlFor="f-days" hint={`${GRANT_DAYS.min} to ${maxDays}`}><input id="f-days" className={inputCls} inputMode="numeric" value={f.days} onChange={(e) => setF({ ...f, days: e.target.value })} /></Field>
            <Field label="Why" htmlFor="f-reason" hint="At least 5 characters. Kept in the audit trail."><input id="f-reason" className={inputCls} value={f.reason} onChange={(e) => setF({ ...f, reason: e.target.value })} /></Field>

            {chosen?.is_house && (
              <div className="sm:col-span-3 rounded-card border border-teal/40 bg-teal/5 px-3 py-2">
                <label htmlFor="f-house" className="flex items-start gap-2 text-sm font-semibold text-ink">
                  <input id="f-house" type="checkbox" className="mt-1" checked={house} onChange={(e) => setHouse(e.target.checked)} />
                  <span>House promotion <span className="font-normal text-ink-soft">— an official OneShetland campaign, free of charge. It may run up to {HOUSE_DAYS.max} days instead of {GRANT_DAYS.max}, and is exempt from the 14-homepage-days-in-90 limit (and left out of that count, so it does not use up this organiser&rsquo;s commercial allowance). Every other rule still applies: it takes one of the {KIND_TITLE.homepage.toLowerCase()} places each day and is refused when a day is full.</span></span>
                </label>
              </div>
            )}
            {chosen && !chosen.is_house && house && <p className="sm:col-span-3 text-xs text-ink-muted">This Edition is not one of OneShetland&rsquo;s own, so it will be booked as an ordinary promotion.</p>}
            {chosen && (
              <p className="text-xs text-ink-muted sm:col-span-3">
                {chosen.title} runs {chosen.starts_on} to {chosen.ends_on}.{" "}
                {fLast ? `Its publishing period covers promotion up to ${fLast}.` : "It has no live publishing period, so it cannot be promoted."}{" "}
                {chosen.is_public ? "It is visible to visitors now." : "It is not visible to visitors yet, so featuring it will do nothing until Editions is switched on."}
              </p>
            )}
            {fWindow.length > 0 && (
              <div className="sm:col-span-3 rounded-card border border-line bg-sand/40 px-3 py-2 text-xs text-ink-soft">
                <strong className="text-ink">{fWindow[0].day} to {fWindow[fWindow.length - 1].day}</strong>{" · "}
                {fFull.length > 0
                  ? <span className="font-semibold text-rose-700">No place free on {fFull.slice(0, 3).join(", ")}{fFull.length > 3 ? ` and ${fFull.length - 3} more` : ""}. Choose other dates.</span>
                  : fBeyond
                    ? <span className="font-semibold text-rose-700">That runs past {fLast}, the end of this Edition&rsquo;s publishing period.</span>
                    : fUnknown.length > 0
                      ? <span className="font-semibold text-amber-800">{fUnknown.length === fWindow.length ? "This window is outside the range this page has loaded, so availability has not been checked." : `${fUnknown.length} of these days fall outside the range this page has loaded, so their availability has not been checked.`} Widen the date range below to see them. You can still book: the database checks availability either way, and will refuse if a day is full.</span>
                      : <span>Every day in this window has a free place.</span>}
              </div>
            )}
            <div className="sm:col-span-3"><button type="submit" className={btnPrimary} disabled={fA.pending || fFull.length > 0 || fBeyond || !chosen || !daysOk}>{fA.pending ? "Featuring…" : asHouse ? "Book the house promotion" : "Feature it"}</button></div>
          </form>
        )}
        <Notice msg={fA.msg} />
      </Panel>

      <Panel title="Date range" sub="Up to 400 days.">
        <form method="get" className="flex flex-wrap items-end gap-3">
          <Field label="From" htmlFor="pc-from"><input id="pc-from" name="from" type="date" className={inputCls} defaultValue={range.from} /></Field>
          <Field label="To" htmlFor="pc-to"><input id="pc-to" name="to" type="date" className={inputCls} defaultValue={range.to} /></Field>
          <button type="submit" className={btnSecondary}>Show</button>
        </form>
      </Panel>
      {error && <Notice msg={{ ok: false, text: error }} />}

      <div className="grid gap-4 sm:grid-cols-2">{KINDS.map((k) => { const s = summarise(days, k); return (
        <Panel key={k} title={KIND_TITLE[k]}><p className="text-sm text-ink-soft">{s.capacity ? `${s.capacity} places a day. ` : ""}{s.full === 0 ? "No full days in this range." : `${s.full} full ${s.full === 1 ? "day" : "days"} in this range.`}</p></Panel>); })}</div>

      <Panel title={`Bookings (${bookings.length})`} sub="Every booking that touches this range. Cancelling or moving always needs a reason, and staff are not held to the organiser notice period.">
        {bookings.length === 0 ? <p className="text-sm text-ink-muted">Nothing is booked in this range.</p> : (
          <ul className="divide-y divide-line overflow-hidden rounded-card border border-line">{bookings.map((b) => (
            <li key={b.booking_id} className="px-4 py-3 text-sm">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0"><p className="font-semibold text-ink">{b.edition_title} <Pill label={KIND_TITLE[b.kind]} tone={b.kind === "homepage" ? "blue" : "purple"} /></p><p className="text-ink-soft">{b.organiser_name} · {dayLabel(b.starts_on)} to {dayLabel(b.ends_on)}</p></div>
                <div className="flex gap-4"><button type="button" className={btnQuiet} onClick={() => { setOpen({ id: b.booking_id, mode: "move" }); setReason(""); setStart(b.starts_on); }}>Move</button><button type="button" className={btnQuiet} onClick={() => { setOpen({ id: b.booking_id, mode: "cancel" }); setReason(""); }}>Cancel booking</button></div>
              </div>
              {open?.id === b.booking_id && (
                <form className="mt-3 grid gap-3 rounded-card bg-sand/50 p-3 sm:grid-cols-3" onSubmit={(e) => { e.preventDefault(); submit(); }}>
                  {open.mode === "move" && <Field label="New first day" htmlFor="pc-start" hint="The booking keeps its length."><input id="pc-start" type="date" className={inputCls} value={start} onChange={(e) => setStart(e.target.value)} /></Field>}
                  <div className={open.mode === "move" ? "sm:col-span-2" : "sm:col-span-3"}><Field label="Reason" htmlFor="pc-reason" hint="At least 5 characters. Kept in the audit trail."><input id="pc-reason" className={inputCls} value={reason} maxLength={500} onChange={(e) => setReason(e.target.value)} /></Field></div>
                  <div className="flex gap-3 sm:col-span-3"><button type="submit" className={btnPrimary} disabled={act.pending}>{open.mode === "cancel" ? "Cancel this booking" : "Move booking"}</button><button type="button" className={btnSecondary} onClick={close}>Keep it</button></div>
                </form>
              )}
            </li>))}</ul>)}
        <Notice msg={act.msg} />
      </Panel>

      <Panel>
        {/* Long by nature — one row per day per kind — so it is closed until it is wanted. */}
        <details className="group">
          <summary className="cursor-pointer list-none">
            <span className="font-display text-xl font-bold text-ink">Day by day</span>
            <span className="ml-2 text-sm text-ink-soft">Places used on each day. <span className="font-semibold text-navy underline-offset-2 group-hover:underline">{days.length === 0 ? "nothing to show" : "show"}</span></span>
          </summary>
          <div className="mt-4">
        {days.length === 0 ? <p className="text-sm text-ink-muted">No days to show.</p> : KINDS.map((k) => (
          <div key={k} className="mb-5 last:mb-0"><h3 className="mb-2 text-sm font-bold text-ink">{KIND_TITLE[k]}</h3>
            <div className="overflow-x-auto rounded-card border border-line" role="region" aria-label={`${KIND_TITLE[k]} places by day`} tabIndex={0}><table className="w-full min-w-[22rem] text-left text-sm"><thead className="bg-sand/50 text-xs uppercase tracking-wider text-ink-soft"><tr><th scope="col" className="px-3 py-2">Day</th><th scope="col" className="px-3 py-2">Use</th><th scope="col" className="px-3 py-2">Who</th></tr></thead>
              <tbody className="divide-y divide-line">{days.filter((d) => d.kind === k).map((d) => (<tr key={`${d.day}-${k}`}><td className="whitespace-nowrap px-3 py-1.5">{dayLabel(d.day)}</td><td className="whitespace-nowrap px-3 py-1.5"><Pill label={usageLabel(d)} tone={USE_TONE[usageOf(d)]} /></td><td className="px-3 py-1.5 text-ink-soft">{d.bookings.map((b) => b.edition_title).join(", ") || "None"}</td></tr>))}</tbody></table></div></div>))}
          </div>
        </details>
      </Panel>

      <Panel title="Who is OneShetland’s own" sub="Only an Edition run by an organiser marked here can be given a house promotion. Marking one is recorded in the audit trail with the reason, and only a verified, non-test organiser can be marked.">
        {organisers.length === 0 ? <p className="text-sm text-ink-muted">No organisers to show yet.</p> : (
          <>
            <ul className="mb-4 divide-y divide-line overflow-hidden rounded-card border border-line">
              {organisers.map((o) => (
                <li key={o.id} className="flex items-center justify-between gap-3 px-4 py-2 text-sm">
                  <span className="text-ink">{o.name}</span>
                  {o.house ? <Pill label="OneShetland’s own" tone="blue" /> : <span className="text-ink-muted">Ordinary organiser</span>}
                </li>))}
            </ul>
            <form className="grid gap-3 sm:grid-cols-3" onSubmit={(e) => e.preventDefault()}>
              <div className="sm:col-span-2"><Field label="Organiser" htmlFor="h-org">
                <select id="h-org" className={inputCls} value={hChosen?.id ?? ""} onChange={(e) => setH({ ...h, organiser: e.target.value })}>
                  {organisers.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
                </select></Field></div>
              <Field label="Reason" htmlFor="h-reason" hint="At least 5 characters."><input id="h-reason" className={inputCls} value={h.reason} maxLength={500} onChange={(e) => setH({ ...h, reason: e.target.value })} /></Field>
              <div className="flex flex-wrap gap-3 sm:col-span-3">
                <button type="button" className={btnPrimary} disabled={hA.pending || !hChosen || hChosen.house}
                  onClick={() => hChosen && hA.run(() => setOrganiserHouse({ organiser: hChosen.id, house: true, reason: h.reason }), { success: "Marked as OneShetland’s own.", onOk: () => { setH({ ...h, reason: "" }); router.refresh(); } })}>
                  Mark as OneShetland’s own
                </button>
                <button type="button" className={btnSecondary} disabled={hA.pending || !hChosen || !hChosen.house}
                  onClick={() => hChosen && hA.run(() => setOrganiserHouse({ organiser: hChosen.id, house: false, reason: h.reason }), { success: "No longer marked.", onOk: () => { setH({ ...h, reason: "" }); router.refresh(); } })}>
                  Unmark
                </button>
              </div>
            </form>
            <Notice msg={hA.msg} />
          </>
        )}
      </Panel>

      <Panel title="Grant a promotion right" sub="Gives an Edition promotion days for the ORGANISER to schedule themselves — a goodwill or partnership grant where they pick the dates. To choose the dates yourself, use Feature an Edition above.">
        <form className="grid gap-3 sm:grid-cols-4" onSubmit={(e) => { e.preventDefault(); gA.run(() => grantPromoRight(g), { success: "Promotion days granted.", onOk: () => { setG({ ...g, reason: "" }); router.refresh(); } }); }}>
          <div className="sm:col-span-2"><Field label="Edition" htmlFor="pg-e"><select id="pg-e" className={inputCls} value={g.edition} onChange={(e) => setG({ ...g, edition: e.target.value })}>{editions.length === 0 && <option value="">No published Editions</option>}{editions.map((x) => <option key={x.id} value={x.id}>{x.label}</option>)}</select></Field></div>
          <Field label="Kind" htmlFor="pg-k"><select id="pg-k" className={inputCls} value={g.kind} onChange={(e) => setG({ ...g, kind: e.target.value })}><option value="homepage">Homepage days</option><option value="discovery">Enhanced discovery days</option></select></Field>
          <Field label="Days" htmlFor="pg-d" hint={`${GRANT_DAYS.min} to ${GRANT_DAYS.max}`}><input id="pg-d" className={inputCls} inputMode="numeric" value={g.days} onChange={(e) => setG({ ...g, days: e.target.value })} /></Field>
          <div className="sm:col-span-4"><Field label="Reason" htmlFor="pg-r" hint="At least 5 characters."><input id="pg-r" className={inputCls} value={g.reason} maxLength={500} onChange={(e) => setG({ ...g, reason: e.target.value })} /></Field></div>
          <div className="sm:col-span-4"><button type="submit" className={btnPrimary} disabled={gA.pending || !g.edition}>Grant days</button></div>
        </form><Notice msg={gA.msg} />
      </Panel>
    </div>
  );
}

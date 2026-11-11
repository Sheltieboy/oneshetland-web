"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { cancelPromoBooking, grantPromoRight, reschedulePromoBooking } from "@/app/admin/editions/promotions/actions";
import { GRANT_DAYS, KIND_TITLE, summarise, usageLabel, usageOf, type BookingRow, type CalendarDay, type PromoKind } from "@/app/admin/editions/promotions/calendar";
import { Field, Notice, Panel, Pill, btnPrimary, btnQuiet, btnSecondary, inputCls } from "@/components/editions-manage/kit";
import { useAction } from "@/components/editions-manage/use-action";
import { day as dayLabel } from "@/components/admin/EditionsAdminParts";

const USE_TONE = { free: "gray", some: "green", full: "amber", over: "red" } as const;
const KINDS: PromoKind[] = ["homepage", "discovery"];

/** The administrator's promotion calendar: capacity by day, who is booked, cancel or move with a reason, and grant promotion days. Every change is audited by the database. */
export function EditionsPromoCalendar({ range, days, bookings, editions, error }: { range: { from: string; to: string }; days: CalendarDay[]; bookings: BookingRow[]; editions: { id: string; label: string }[]; error: string | null }) {
  const router = useRouter();
  const act = useAction();
  const [open, setOpen] = useState<{ id: string; mode: "cancel" | "move" } | null>(null);
  const [reason, setReason] = useState(""); const [start, setStart] = useState("");
  const [g, setG] = useState({ edition: editions[0]?.id ?? "", kind: "homepage", days: "7", reason: "" }); const gA = useAction();
  const close = () => { setOpen(null); setReason(""); setStart(""); };
  const submit = () => { if (!open) return; const id = open.id;
    act.run(() => (open.mode === "cancel" ? cancelPromoBooking({ booking: id, reason }) : reschedulePromoBooking({ booking: id, start, reason })), { success: open.mode === "cancel" ? "Booking cancelled." : "Booking moved.", onOk: () => { close(); router.refresh(); } }); };

  return (
    <div className="space-y-8">
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

      <Panel title="Day by day" sub="Places used on each day.">
        {days.length === 0 ? <p className="text-sm text-ink-muted">No days to show.</p> : KINDS.map((k) => (
          <div key={k} className="mb-5 last:mb-0"><h3 className="mb-2 text-sm font-bold text-ink">{KIND_TITLE[k]}</h3>
            <div className="overflow-x-auto rounded-card border border-line"><table className="w-full min-w-[22rem] text-left text-sm"><thead className="bg-sand/50 text-xs uppercase tracking-wider text-ink-soft"><tr><th scope="col" className="px-3 py-2">Day</th><th scope="col" className="px-3 py-2">Use</th><th scope="col" className="px-3 py-2">Who</th></tr></thead>
              <tbody className="divide-y divide-line">{days.filter((d) => d.kind === k).map((d) => (<tr key={`${d.day}-${k}`}><td className="whitespace-nowrap px-3 py-1.5">{dayLabel(d.day)}</td><td className="whitespace-nowrap px-3 py-1.5"><Pill label={usageLabel(d)} tone={USE_TONE[usageOf(d)]} /></td><td className="px-3 py-1.5 text-ink-soft">{d.bookings.map((b) => b.edition_title).join(", ") || "None"}</td></tr>))}</tbody></table></div></div>))}
      </Panel>

      <Panel title="Grant a promotion right" sub="Gives an Edition promotion days without a payment (a goodwill or partnership grant). The organiser then schedules them, and the usual availability rules still apply. A reason is required and kept in the audit trail.">
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

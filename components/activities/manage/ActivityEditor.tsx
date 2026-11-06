"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  DAY_LONG, DAY_SHORT, WEEK_ORDER, dayLong, londonDate, patternText, timeHM, timeRange, validateBreakDraft, validateRuleDraft, SESSION_STATUS_LABEL,
  type SessionRow, type RuleRow,
} from "@/lib/activities";
import type { BreakRow, ExceptionRow } from "@/lib/activities-data";
import { addBreak, addExtraSession, addRules, cancelSession, changeSession, deleteBreak, deleteRule, restoreSession, setActivityStatus, deleteActivity } from "@/lib/activities-client";
import { btnDanger, btnGhost, btnPrimary, card, hint, input, label } from "./ui";

type Rule = RuleRow & { id: string };
type Props = {
  activityId: string; slug: string; title: string; status: "draft" | "published" | "ended"; paused: boolean; pauseReason: string | null;
  hubPendingApproval: boolean; followerCount: number | null; base: string;
  rules: Rule[]; sessions: SessionRow[]; exceptions: ExceptionRow[]; breaks: BreakRow[]; siblingIds: string[]; defaultVenue: string | null;
};

/** Hook: run a write, show its result, refresh the server data. */
function useDo() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function run(fn: () => Promise<void>) {
    setBusy(true); setError(null);
    try { await fn(); router.refresh(); } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }
  return { run, busy, error };
}
const Err = ({ e }: { e: string | null }) => (e ? <p role="alert" className="mt-2 text-sm font-semibold text-rose-700">{e}</p> : null);

/* ── Publish ─────────────────────────────────────────────────────────────────────────────────────────────────────────────── */
function PublishPanel(p: Props) {
  const { run, busy, error } = useDo();
  const router = useRouter();
  const live = p.status === "published";
  return (
    <section className={card} aria-labelledby="pub-h">
      <h2 id="pub-h" className="font-display text-lg font-bold">Visibility</h2>
      {p.paused && <p role="status" className="mt-2 rounded-lg bg-rose-50 p-3 text-sm text-rose-900"><strong>Paused by OneShetland.</strong> {p.pauseReason ?? ""} It isn&apos;t shown to the public. Get in touch if you think this is a mistake.</p>}
      <p className="mt-2 text-sm text-ink-soft">
        {p.status === "draft" && "It's a draft: only you can see it. Add the days and times, then publish."}
        {p.status === "published" && (p.hubPendingApproval ? "Published, but waiting for OneShetland to approve your hub before it shows publicly." : "It's live on What's On under Regular activities.")}
        {p.status === "ended" && "This activity has ended and is hidden from the public. You can publish it again."}
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {!live && <button className={btnPrimary} disabled={busy || p.rules.length === 0} onClick={() => void run(() => setActivityStatus(p.activityId, "published"))}>Publish</button>}
        {live && <button className={btnGhost} disabled={busy} onClick={() => void run(() => setActivityStatus(p.activityId, "draft"))}>Unpublish (back to draft)</button>}
        {p.status !== "ended" && <button className={btnGhost} disabled={busy} onClick={() => void run(() => setActivityStatus(p.activityId, "ended"))}>Mark as ended</button>}
        <Link href={`/whats-on/regular/${p.slug}`} className={btnGhost}>{live ? "View listing" : "Preview"}</Link>
        <button className={btnDanger} disabled={busy} onClick={() => { if (window.confirm(`Delete "${p.title}" and its schedule? This cannot be undone.`)) void run(async () => { await deleteActivity(p.activityId); router.push(p.base); }); }}>Delete</button>
      </div>
      {p.rules.length === 0 && !live && <p className={hint}>Add at least one day and time before publishing.</p>}
      {p.followerCount != null && <p className={hint}>{p.followerCount} {p.followerCount === 1 ? "person follows" : "people follow"} this for changes. You can see how many, never who.</p>}
      <Err e={error} />
    </section>
  );
}

/* ── Weekly schedule ─────────────────────────────────────────────────────────────────────────────────────────────────────── */
function SchedulePanel(p: Props) {
  const { run, busy, error } = useDo();
  const [days, setDays] = useState<number[]>([]);
  const [start, setStart] = useState("18:00"), [end, setEnd] = useState("19:00");
  const [show, setShow] = useState(false);
  const chk = validateRuleDraft({ day_of_week: days[0] ?? -1, start_time: start, end_time: end });
  return (
    <section className={card} aria-labelledby="sch-h">
      <h2 id="sch-h" className="font-display text-lg font-bold">Weekly times</h2>
      <p className="mt-1 text-sm text-ink-soft">{patternText(p.rules)}</p>
      {p.rules.length > 0 && (
        <ul className="mt-3 divide-y divide-line rounded-xl border border-line">
          {[...p.rules].sort((a, b) => WEEK_ORDER.indexOf(a.day_of_week) - WEEK_ORDER.indexOf(b.day_of_week) || a.start_time.localeCompare(b.start_time)).map((r) => (
            <li key={r.id} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
              <span className="font-semibold text-ink">{DAY_LONG[r.day_of_week]} · {r.start_time.slice(0, 5)}–{r.end_time.slice(0, 5)}</span>
              <button className="text-xs font-bold text-rose-700 underline" disabled={busy} onClick={() => { if (window.confirm("Remove this weekly time? Its cancellations and changes go with it.")) void run(() => deleteRule(r.id)); }}>Remove</button>
            </li>
          ))}
        </ul>
      )}
      <fieldset className="mt-4">
        <legend className={label}>Add days and a time</legend>
        <div className="mt-2 flex flex-wrap gap-2" role="group" aria-label="Days">
          {WEEK_ORDER.map((d) => (
            <button key={d} type="button" aria-pressed={days.includes(d)} onClick={() => setDays((x) => (x.includes(d) ? x.filter((y) => y !== d) : [...x, d]))}
              className={"rounded-pill px-3.5 py-1.5 text-sm font-semibold " + (days.includes(d) ? "bg-teal-700 text-paper" : "border border-line-strong text-ink-soft hover:bg-sand")}>{DAY_SHORT[d]}</button>
          ))}
        </div>
        <div className="mt-3 flex flex-wrap items-end gap-3">
          <div><label className={label} htmlFor="r-start">Starts</label><input id="r-start" type="time" className={input + " w-32"} value={start} onChange={(e) => setStart(e.target.value)} /></div>
          <div><label className={label} htmlFor="r-end">Ends</label><input id="r-end" type="time" className={input + " w-32"} value={end} onChange={(e) => setEnd(e.target.value)} /></div>
          <button className={btnPrimary} disabled={busy} onClick={() => { setShow(true); if (days.length && chk.ok) void run(async () => { await addRules(p.activityId, days, start, end); setDays([]); setShow(false); }); }}>Add</button>
        </div>
        {show && days.length === 0 && <p role="alert" className="mt-2 text-sm font-semibold text-rose-700">Pick at least one day.</p>}
        {show && days.length > 0 && !chk.ok && <p role="alert" className="mt-2 text-sm font-semibold text-rose-700">{Object.values(chk.errors)[0]}</p>}
        <p className={hint}>Times are Shetland time. Two sessions on the same day (say a morning and an evening class) are added as two times.</p>
      </fieldset>
      <Err e={error} />
    </section>
  );
}

/* ── Individual sessions ─────────────────────────────────────────────────────────────────────────────────────────────────── */
function SessionRowView({ s, p, ex }: { s: SessionRow; p: Props; ex?: ExceptionRow }) {
  const { run, busy, error } = useDo();
  const [mode, setMode] = useState<null | "cancel" | "change">(null);
  const [note, setNote] = useState(ex?.note ?? "");
  const [date, setDate] = useState(londonDate(s.starts_at)), [start, setStart] = useState(timeHM(s.starts_at)), [end, setEnd] = useState(timeHM(s.ends_at)), [venue, setVenue] = useState(ex?.new_venue ?? "");
  const off = s.status === "cancelled" || s.status === "break";
  const isExtra = s.status === "extra";
  const canAct = (s.rule_id && s.occurrence_date) || isExtra;
  const origDate = s.occurrence_date ?? "";
  return (
    <li className="px-3 py-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <p className={"text-sm font-semibold text-ink " + (off ? "line-through opacity-60" : "")}>{dayLong(s.starts_at)} · {timeRange(s.starts_at, s.ends_at)}</p>
          {(s.note || (s.venue && s.venue !== p.defaultVenue)) && <p className="text-xs text-ink-soft">{[s.venue && s.venue !== p.defaultVenue ? `At ${s.venue}` : null, s.note].filter(Boolean).join(" · ")}</p>}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {SESSION_STATUS_LABEL[s.status] && <span className="rounded-pill bg-sand px-2.5 py-0.5 text-xs font-bold text-ink">{SESSION_STATUS_LABEL[s.status]}</span>}
          {canAct && !isExtra && s.status !== "break" && !ex && <><button className="text-xs font-bold underline" onClick={() => setMode("cancel")}>Cancel</button><button className="text-xs font-bold underline" onClick={() => setMode("change")}>Change</button></>}
          {ex && ex.kind === "changed" && <button className="text-xs font-bold underline" onClick={() => setMode("change")}>Edit</button>}
          {ex && <button className="text-xs font-bold underline" disabled={busy} onClick={() => void run(() => restoreSession(ex.id))}>{ex.kind === "cancelled" ? "Restore" : ex.kind === "extra" ? "Remove" : "Undo change"}</button>}
        </div>
      </div>
      {mode === "cancel" && (
        <div className="mt-2 rounded-lg bg-sand/60 p-3">
          <label className={label} htmlFor={`c-${s.starts_at}`}>Reason people will see <span className="font-normal text-ink-muted">(optional)</span></label>
          <input id={`c-${s.starts_at}`} className={input} value={note} onChange={(e) => setNote(e.target.value)} maxLength={200} placeholder="e.g. Instructor away" />
          <div className="mt-2 flex gap-2"><button className={btnPrimary} disabled={busy} onClick={() => void run(async () => { await cancelSession(p.activityId, s.rule_id!, origDate, note); setMode(null); })}>Cancel this session</button><button className={btnGhost} onClick={() => setMode(null)}>Keep it</button></div>
          <p className={hint}>People who follow this activity are told.</p>
        </div>
      )}
      {mode === "change" && (
        <div className="mt-2 grid gap-3 rounded-lg bg-sand/60 p-3 sm:grid-cols-4">
          <div><label className={label}>Date</label><input type="date" className={input} value={date} onChange={(e) => setDate(e.target.value)} /></div>
          <div><label className={label}>Starts</label><input type="time" className={input} value={start} onChange={(e) => setStart(e.target.value)} /></div>
          <div><label className={label}>Ends</label><input type="time" className={input} value={end} onChange={(e) => setEnd(e.target.value)} /></div>
          <div><label className={label}>Venue</label><input className={input} value={venue} onChange={(e) => setVenue(e.target.value)} placeholder="unchanged" maxLength={160} /></div>
          <div className="sm:col-span-4"><label className={label}>Note people will see <span className="font-normal text-ink-muted">(optional)</span></label><input className={input} value={note} onChange={(e) => setNote(e.target.value)} maxLength={200} placeholder="e.g. Moved to Saturday this week" /></div>
          <div className="flex gap-2 sm:col-span-4">
            <button className={btnPrimary} disabled={busy || end <= start} onClick={() => void run(async () => {
              const moved = date !== londonDate(s.starts_at) || start !== timeHM(s.starts_at) || end !== timeHM(s.ends_at);
              await changeSession(p.activityId, s.rule_id!, origDate, { date: moved ? date : undefined, start: moved ? start : undefined, end: moved ? end : undefined, venue, note }, ex?.id);
              setMode(null);
            })}>Save change</button>
            <button className={btnGhost} onClick={() => setMode(null)}>Close</button>
          </div>
          {end <= start && <p role="alert" className="text-sm font-semibold text-rose-700 sm:col-span-4">The end must be after the start.</p>}
        </div>
      )}
      <Err e={error} />
    </li>
  );
}

function SessionsPanel(p: Props) {
  const { run, busy, error } = useDo();
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState(""), [start, setStart] = useState("18:00"), [end, setEnd] = useState("19:00"), [venue, setVenue] = useState(""), [note, setNote] = useState("");
  const exFor = (s: SessionRow) => p.exceptions.find((e) => (s.exception_id ? e.id === s.exception_id : false));
  return (
    <section className={card} aria-labelledby="ses-h">
      <h2 id="ses-h" className="font-display text-lg font-bold">Upcoming sessions</h2>
      <p className="mt-1 text-sm text-ink-soft">The next eight weeks. Cancel or change one session without touching the others.</p>
      {p.sessions.length === 0 ? <p className="mt-3 text-sm text-ink-muted">No sessions yet. Add weekly times above.</p> : (
        <ol className="mt-3 divide-y divide-line rounded-xl border border-line">
          {p.sessions.slice(0, 40).map((s, i) => <SessionRowView key={`${s.starts_at}-${s.rule_id ?? s.exception_id}-${i}`} s={s} p={p} ex={exFor(s)} />)}
        </ol>
      )}
      <div className="mt-4">
        {!open ? <button className={btnGhost} onClick={() => setOpen(true)}>+ Add an extra session</button> : (
          <div className="grid gap-3 rounded-lg bg-sand/60 p-3 sm:grid-cols-4">
            <div><label className={label}>Date</label><input type="date" className={input} value={date} onChange={(e) => setDate(e.target.value)} /></div>
            <div><label className={label}>Starts</label><input type="time" className={input} value={start} onChange={(e) => setStart(e.target.value)} /></div>
            <div><label className={label}>Ends</label><input type="time" className={input} value={end} onChange={(e) => setEnd(e.target.value)} /></div>
            <div><label className={label}>Venue</label><input className={input} value={venue} onChange={(e) => setVenue(e.target.value)} placeholder="same as usual" maxLength={160} /></div>
            <div className="sm:col-span-4"><label className={label}>Note <span className="font-normal text-ink-muted">(optional)</span></label><input className={input} value={note} onChange={(e) => setNote(e.target.value)} maxLength={200} placeholder="e.g. Christmas card special" /></div>
            <div className="flex gap-2 sm:col-span-4"><button className={btnPrimary} disabled={busy || !date || end <= start} onClick={() => void run(async () => { await addExtraSession(p.activityId, date, start, end, venue, note); setOpen(false); setDate(""); })}>Add session</button><button className={btnGhost} onClick={() => setOpen(false)}>Close</button></div>
          </div>
        )}
      </div>
      <Err e={error} />
    </section>
  );
}

/* ── Holiday breaks ──────────────────────────────────────────────────────────────────────────────────────────────────────── */
function BreaksPanel(p: Props) {
  const { run, busy, error } = useDo();
  const [s, setS] = useState(""), [e, setE] = useState(""), [reason, setReason] = useState(""), [all, setAll] = useState(false), [show, setShow] = useState(false);
  const chk = validateBreakDraft({ start_date: s, end_date: e, reason });
  const others = p.siblingIds.filter((id) => id !== p.activityId);
  return (
    <section className={card} aria-labelledby="brk-h">
      <h2 id="brk-h" className="font-display text-lg font-bold">Holiday breaks</h2>
      <p className="mt-1 text-sm text-ink-soft">Cancels every weekly session between two dates. Extra sessions you add are not affected.</p>
      {p.breaks.length > 0 && (
        <ul className="mt-3 divide-y divide-line rounded-xl border border-line">
          {p.breaks.map((b) => (
            <li key={b.id} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
              <span className="font-semibold text-ink">{b.start_date} to {b.end_date}{b.reason ? ` · ${b.reason}` : ""}</span>
              <button className="text-xs font-bold text-rose-700 underline" disabled={busy} onClick={() => void run(() => deleteBreak(b.id))}>Remove</button>
            </li>
          ))}
        </ul>
      )}
      <div className="mt-4 grid gap-3 sm:grid-cols-4">
        <div><label className={label} htmlFor="b-s">First day</label><input id="b-s" type="date" className={input} value={s} onChange={(x) => setS(x.target.value)} /></div>
        <div><label className={label} htmlFor="b-e">Last day</label><input id="b-e" type="date" className={input} value={e} onChange={(x) => setE(x.target.value)} /></div>
        <div className="sm:col-span-2"><label className={label} htmlFor="b-r">Reason</label><input id="b-r" className={input} value={reason} onChange={(x) => setReason(x.target.value)} maxLength={120} placeholder="e.g. Christmas break" /></div>
      </div>
      {others.length > 0 && <label className="mt-3 flex items-center gap-2 text-sm text-ink"><input type="checkbox" checked={all} onChange={(x) => setAll(x.target.checked)} /> Also add to my other {others.length} {others.length === 1 ? "activity" : "activities"}</label>}
      <div className="mt-3"><button className={btnPrimary} disabled={busy} onClick={() => { setShow(true); if (chk.ok) void run(async () => { await addBreak(all ? [p.activityId, ...others] : [p.activityId], s, e, reason); setS(""); setE(""); setReason(""); setShow(false); }); }}>Add break</button></div>
      {show && !chk.ok && <p role="alert" className="mt-2 text-sm font-semibold text-rose-700">{Object.values(chk.errors)[0]}</p>}
      <Err e={error} />
    </section>
  );
}

export function ActivityEditor(p: Props) {
  return (
    <div className="space-y-5">
      <PublishPanel {...p} />
      <SchedulePanel {...p} />
      <SessionsPanel {...p} />
      <BreaksPanel {...p} />
    </div>
  );
}

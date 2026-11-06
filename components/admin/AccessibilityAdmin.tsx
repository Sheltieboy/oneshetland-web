"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { adminCoverage, adminHide, adminReports, adminReviewReport, adminVerify, type AdminReport, type Coverage } from "@/lib/accessibility-client";
import { isSubjectType, subjectHref, TYPE_LABEL, type SubjectType } from "@/lib/accessibility";

const when = (iso: string) => new Date(iso).toLocaleString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Europe/London" });

/** Staff tools: read suggestions, record a note, and set provenance or hide a listing's access information. Nothing here sends anything to anyone. */
export function AccessibilityAdmin() {
  const [cov, setCov] = useState<Coverage | null>(null);
  const [rows, setRows] = useState<AdminReport[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [note, setNote] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [v, setV] = useState({ type: "business", id: "", level: "official_source", note: "", on: "", reason: "" });
  const [done, setDone] = useState<string | null>(null);
  const load = useCallback(async () => {
    try { const [c, r] = await Promise.all([adminCoverage(), adminReports(null)]); setCov(c); setRows(r); setErr(null); } catch (e) { setErr((e as Error).message); }
  }, []);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void load(); }, [load]);

  async function review(id: string, status: "accepted" | "rejected" | "applied") {
    setBusy(id); setErr(null);
    try { await adminReviewReport(id, status, note[id] ?? ""); await load(); } catch (e) { setErr((e as Error).message); } finally { setBusy(null); }
  }
  async function setVerification(e: React.FormEvent) {
    e.preventDefault(); setBusy("v"); setErr(null); setDone(null);
    try { await adminVerify(v.type as SubjectType, v.id.trim(), v.level, v.note, v.on); setDone("Provenance saved."); } catch (x) { setErr((x as Error).message); } finally { setBusy(null); }
  }
  async function hide(hideIt: boolean) {
    setBusy("h"); setErr(null); setDone(null);
    try { await adminHide(v.type as SubjectType, v.id.trim(), hideIt, v.reason); setDone(hideIt ? "Hidden from the public." : "Shown again."); } catch (x) { setErr((x as Error).message); } finally { setBusy(null); }
  }
  const input = "mt-1 w-full rounded-lg border border-line-strong bg-white px-3 py-2 text-sm";
  return (
    <div className="space-y-8">
      {err && <p role="alert" className="text-sm font-semibold text-rose-700">{err}</p>}
      <section aria-labelledby="cov"><h2 id="cov" className="font-display text-lg font-bold">Participation</h2>
        {!cov ? <p className="text-sm text-ink-muted">Loading…</p> : (
          <>
            <ul className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-4 text-sm">
              {[["Published", cov.profiles_published], ["Drafts", cov.profiles_draft], ["Claimed businesses", cov.claimed_businesses], ["New suggestions", cov.reports_new]].map(([l, n]) => <li key={String(l)} className="rounded-card border border-line bg-paper p-3"><span className="block text-2xl font-bold">{String(n)}</span>{String(l)}</li>)}
            </ul>
            <details className="mt-3"><summary className="cursor-pointer text-sm font-semibold">Claimed businesses with no published access information ({cov.claimed_without_profile.length})</summary>
              <p className="mt-2 text-xs text-ink-soft">For planning an invitation only. Nothing is sent from here: any email or notification needs your separate approval of wording and audience.</p>
              <ul className="mt-2 columns-1 text-sm sm:columns-2">{cov.claimed_without_profile.map((b) => <li key={b.id}>{b.name}</li>)}</ul>
            </details></>
        )}
      </section>

      <section aria-labelledby="rep"><h2 id="rep" className="font-display text-lg font-bold">Suggestions from the public</h2>
        <p className="text-sm text-ink-soft">A suggestion never changes what is shown. Read it, tell the owner or fix it yourself, then mark it.</p>
        {!rows ? <p className="text-sm text-ink-muted">Loading…</p> : rows.length === 0 ? <p className="mt-2 rounded-card border border-line bg-paper p-4 text-sm text-ink-muted">No suggestions yet.</p> : (
          <ul className="mt-3 space-y-3">{rows.map((r) => (
            <li key={r.id} className="rounded-card border border-line bg-paper p-4">
              <div className="flex flex-wrap items-baseline justify-between gap-2"><span className="font-bold">{isSubjectType(r.subject_type) ? <Link className="underline" href={subjectHref(r.subject_type, r.subject_id)}>{r.subject_label ?? "Listing"}</Link> : r.subject_label} <span className="font-normal text-ink-soft">({isSubjectType(r.subject_type) ? TYPE_LABEL[r.subject_type] : r.subject_type}, {r.kind})</span></span><span className="text-xs text-ink-muted">{when(r.created_at)} · {r.status}</span></div>
              <p className="mt-2 whitespace-pre-line text-sm">{r.message}</p>
              {r.staff_note && <p className="mt-1 text-xs text-ink-soft">Note: {r.staff_note}</p>}
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <label className="sr-only" htmlFor={`n-${r.id}`}>Note</label>
                <input id={`n-${r.id}`} className="min-w-0 flex-1 rounded-lg border border-line-strong bg-white px-3 py-2 text-sm" maxLength={500} placeholder="Note (optional)" value={note[r.id] ?? ""} onChange={(e) => setNote({ ...note, [r.id]: e.target.value })} />
                {(["accepted", "applied", "rejected"] as const).map((s) => <button key={s} type="button" disabled={busy === r.id} onClick={() => void review(r.id, s)} className="min-h-11 rounded-pill border border-line-strong px-4 text-sm font-bold capitalize disabled:opacity-50">{s === "applied" ? "Mark applied" : s}</button>)}
              </div>
            </li>))}</ul>
        )}
      </section>

      <section aria-labelledby="ver"><h2 id="ver" className="font-display text-lg font-bold">Provenance and hiding</h2>
        <p className="text-sm text-ink-soft">“Independently checked” and “official source” need a note saying who checked or which source, and the date. Only use them when that is true.</p>
        <form onSubmit={setVerification} className="mt-3 grid gap-3 sm:grid-cols-2">
          <label className="text-sm font-semibold">Type<select className={input} value={v.type} onChange={(e) => setV({ ...v, type: e.target.value })}><option value="business">Business</option><option value="hub">Hub</option><option value="activity">Regular activity</option><option value="event">Event</option></select></label>
          <label className="text-sm font-semibold">Listing id<input className={input} required value={v.id} onChange={(e) => setV({ ...v, id: e.target.value })} placeholder="uuid" /></label>
          <label className="text-sm font-semibold">Level<select className={input} value={v.level} onChange={(e) => setV({ ...v, level: e.target.value })}><option value="owner_provided">Owner-provided</option><option value="official_source">Official source</option><option value="independently_checked">Independently checked</option></select></label>
          <label className="text-sm font-semibold">Date<input type="date" className={input} value={v.on} onChange={(e) => setV({ ...v, on: e.target.value })} /></label>
          <label className="text-sm font-semibold sm:col-span-2">Who checked / which source<input className={input} value={v.note} onChange={(e) => setV({ ...v, note: e.target.value })} maxLength={300} /></label>
          <div className="sm:col-span-2"><button type="submit" disabled={busy === "v" || !v.id.trim()} className="min-h-11 rounded-pill bg-ink px-5 text-sm font-bold text-white disabled:opacity-50">Save provenance</button></div>
          <label className="text-sm font-semibold sm:col-span-2">Reason for hiding (shown to the owner)<input className={input} value={v.reason} onChange={(e) => setV({ ...v, reason: e.target.value })} maxLength={300} /></label>
          <div className="flex gap-3 sm:col-span-2"><button type="button" disabled={busy === "h" || !v.id.trim() || v.reason.trim().length < 5} onClick={() => void hide(true)} className="min-h-11 rounded-pill border border-rose-300 px-5 text-sm font-bold text-rose-800 disabled:opacity-50">Hide from public</button><button type="button" disabled={busy === "h" || !v.id.trim()} onClick={() => void hide(false)} className="min-h-11 rounded-pill border border-line-strong px-5 text-sm font-bold disabled:opacity-50">Show again</button></div>
        </form>
        {done && <p role="status" className="mt-3 text-sm font-semibold text-emerald-800">{done}</p>}
      </section>
    </div>
  );
}

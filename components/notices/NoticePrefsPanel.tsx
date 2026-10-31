"use client";

import { useMemo, useState } from "react";
import { noticeWrite } from "@/app/notices/actions";
import { MAX_MEMBER_AREAS, NOTICE_CATEGORIES, prefsArgs, type NoticePrefs } from "@/lib/notices-alerts";
import { Status, btnPrimary, inputCls, useAction } from "@/components/notices/Fields";

type Area = { id: string; name: string };

function Switch({ on, onChange, label, disabled }: { on: boolean; onChange: () => void; label: string; disabled?: boolean }) {
  return (
    <button type="button" onClick={onChange} disabled={disabled} aria-pressed={on} aria-label={label}
      className={"relative h-7 w-12 shrink-0 rounded-pill transition disabled:opacity-40 " + (on ? "bg-navy" : "bg-line-strong")}>
      <span className={"absolute top-0.5 h-6 w-6 rounded-full bg-white transition-all " + (on ? "left-[22px]" : "left-0.5")} />
    </button>
  );
}

/**
 * Account -> Notifications -> "Notices & alerts". Two separate things, kept visibly separate:
 *   1. AREAS - which places you care about (what the site shows you, and which notices can reach you). Choosing areas turns NOTHING on.
 *   2. FOUR independent opt-ins, all off until you switch them on. The master switch, the "Notices & safety" toggle and quiet hours above still apply.
 * With no areas chosen you hear about Shetland-wide notices only (never "everything").
 */
export function NoticePrefsPanel({ areas, initialAreas, initialPrefs, loadError }: { areas: Area[]; initialAreas: string[]; initialPrefs: NoticePrefs; loadError: string | null }) {
  const [chosen, setChosen] = useState<string[]>(initialAreas);
  const [saved, setSaved] = useState<string[]>(initialAreas);
  const [prefs, setPrefs] = useState<NoticePrefs>(initialPrefs);
  const [q, setQ] = useState("");
  const areaAction = useAction();
  const prefAction = useAction();
  const shown = useMemo(() => areas.filter((a) => a.name.toLowerCase().includes(q.trim().toLowerCase())), [areas, q]);
  const names = (ids: string[]) => ids.map((id) => areas.find((a) => a.id === id)?.name ?? id);
  const dirty = chosen.slice().sort().join("|") !== saved.slice().sort().join("|");
  const toggleArea = (id: string) => setChosen((c) => (c.includes(id) ? c.filter((x) => x !== id) : c.length >= MAX_MEMBER_AREAS ? c : [...c, id]));

  async function saveAreas() {
    const r = await areaAction.run(() => noticeWrite("set_my_notice_areas", { p_areas: chosen }), chosen.length ? "Your areas are saved." : "Saved. With no areas chosen you will only hear about Shetland-wide notices.");
    if (r.ok) setSaved(chosen);
  }
  async function savePrefs(next: NoticePrefs) {
    const before = prefs;
    setPrefs(next);
    const r = await prefAction.run(() => noticeWrite("set_my_notice_prefs", prefsArgs(next)), "Saved.");
    if (!r.ok) setPrefs(before);   // never show a choice as saved when it was not
  }
  const cats = prefs.community_categories;

  const rows: { key: keyof Pick<NoticePrefs, "essential_alerts" | "official_notices" | "community_notices" | "funeral_notices">; title: string; desc: string }[] = [
    { key: "essential_alerts", title: "Essential alerts", desc: "Urgent, verified alerts such as road closures, power cuts and ferry suspensions. Rare." },
    { key: "official_notices", title: "Health & official", desc: "Notices from the council, NHS Shetland and other verified organisations." },
    { key: "community_notices", title: "Community", desc: "Notices from hubs, businesses and neighbours." },
    { key: "funeral_notices", title: "Deaths & funeral", desc: "Funeral announcements, sent discreetly and only where the family has agreed." },
  ];

  return (
    <section aria-labelledby="notices-alerts-h" className="mt-10 border-t border-line pt-8">
      <h2 id="notices-alerts-h" className="font-display text-2xl font-bold text-ink">Notices &amp; alerts</h2>
      <p className="mt-1 text-ink-soft">Choose where you care about, and which kinds of notice you are happy to be told about.</p>
      {loadError && <p role="alert" className="mt-3 rounded-lg border border-rose-300 bg-rose-50 px-3 py-2 text-sm text-rose-900">Your notice choices could not be loaded ({loadError}). Changes below may not save.</p>}

      <div className="mt-5 rounded-card border border-line bg-paper p-5 shadow-soft">
        <h3 className="font-display text-lg font-bold text-ink">Your areas</h3>
        <p className="mt-1 text-sm text-ink-soft">Pick up to {MAX_MEMBER_AREAS} places. <strong>Choosing areas does not turn any notifications on</strong> &mdash; that is the switches below. If you choose no areas, you will only be told about Shetland-wide notices, never everything.</p>
        {chosen.length > 0 && <ul className="mt-3 flex flex-wrap gap-2" aria-label="Chosen areas">{chosen.map((id) => <li key={id}><button type="button" onClick={() => toggleArea(id)} className="inline-flex min-h-[44px] items-center gap-2 rounded-pill bg-navy px-4 text-sm font-semibold text-paper">{names([id])[0]}<span aria-hidden>{"×"}</span><span className="sr-only">Remove</span></button></li>)}</ul>}
        <label className="mt-3 block"><span className="sr-only">Search areas</span><input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search areas" className={inputCls} /></label>
        <ul className="mt-2 max-h-64 overflow-y-auto rounded-lg border border-line">
          {shown.map((a) => (
            <li key={a.id} className="border-b border-line last:border-0">
              <label className="flex min-h-[44px] cursor-pointer items-center gap-3 px-3">
                <input type="checkbox" checked={chosen.includes(a.id)} onChange={() => toggleArea(a.id)} className="h-5 w-5 accent-[#032f4c]" disabled={!chosen.includes(a.id) && chosen.length >= MAX_MEMBER_AREAS} />
                <span className="text-sm text-ink">{a.name}</span>
              </label>
            </li>
          ))}
          {shown.length === 0 && <li className="px-3 py-3 text-sm text-ink-muted">{areas.length === 0 ? "The list of areas could not be loaded." : "No area matches that search."}</li>}
        </ul>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <button type="button" onClick={saveAreas} disabled={!dirty || areaAction.state.busy} className={btnPrimary}>{areaAction.state.busy ? "Saving…" : "Save my areas"}</button>
          <button type="button" onClick={() => setChosen([])} disabled={chosen.length === 0} className="text-sm font-semibold text-navy-light underline disabled:opacity-40">Clear</button>
        </div>
        <div className="mt-3"><Status state={areaAction.state} /></div>
      </div>

      <div className="mt-5 rounded-card border border-line bg-paper shadow-soft">
        <div className="border-b border-line px-5 py-4">
          <h3 className="font-display text-lg font-bold text-ink">What you want to hear about</h3>
          <p className="mt-1 text-sm text-ink-soft">All four are off until you switch them on. The &ldquo;All notifications&rdquo; switch, the &ldquo;Notices &amp; safety&rdquo; choice and your quiet hours (above) still apply &mdash; you will always find every notice on the website and in the app without notifications.</p>
        </div>
        <ul className="divide-y divide-line">
          {rows.map((r) => (
            <li key={r.key} className="px-5 py-4">
              <div className="flex items-center justify-between gap-4">
                <div className="min-w-0"><p className="font-semibold text-ink">{r.title}</p><p className="text-sm text-ink-muted">{r.desc}</p></div>
                <Switch on={prefs[r.key]} onChange={() => savePrefs({ ...prefs, [r.key]: !prefs[r.key] })} label={r.title} disabled={prefAction.state.busy} />
              </div>
              {r.key === "community_notices" && prefs.community_notices && (
                <div className="mt-3" role="group" aria-label="Community categories">
                  <p className="text-sm text-ink-soft">{cats === null || cats.length === 0 ? "You will hear about every community category." : "Only these categories:"}</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <button type="button" aria-pressed={cats === null} onClick={() => savePrefs({ ...prefs, community_categories: null })} className={"inline-flex min-h-[44px] items-center rounded-pill px-4 text-sm font-semibold " + (cats === null ? "bg-navy text-paper" : "border border-line-strong text-ink-soft hover:bg-sand")}>All</button>
                    {NOTICE_CATEGORIES.map((c) => {
                      const on = !!cats && cats.includes(c.id);
                      return <button key={c.id} type="button" aria-pressed={on} onClick={() => { const next = on ? (cats ?? []).filter((x) => x !== c.id) : [...(cats ?? []), c.id]; savePrefs({ ...prefs, community_categories: next.length ? next : null }); }} className={"inline-flex min-h-[44px] items-center rounded-pill px-4 text-sm font-semibold " + (on ? "bg-navy text-paper" : "border border-line-strong text-ink-soft hover:bg-sand")}>{c.label}</button>;
                    })}
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
        <div className="px-5 pb-4"><Status state={prefAction.state} /></div>
      </div>
    </section>
  );
}

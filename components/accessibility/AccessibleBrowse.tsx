"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { FILTERS, highlights, PROVENANCE_LABEL, TYPE_LABEL, dateLine, type SubjectType } from "@/lib/accessibility";
import type { BrowseItem } from "@/lib/accessibility-data";

const TYPES: { key: SubjectType | "all"; label: string }[] = [
  { key: "all", label: "Everything" }, { key: "business", label: "Places and businesses" }, { key: "event", label: "Events" }, { key: "activity", label: "Regular activities" }, { key: "hub", label: "Hubs and groups" },
];

/** Filtering is done in the browser over the (small, already fetched) published list, so it costs the database nothing. A filter means "answered Yes or Partly for that facility". */
export function AccessibleBrowse({ items }: { items: BrowseItem[] }) {
  const [type, setType] = useState<SubjectType | "all">("all");
  const [need, setNeed] = useState<string[]>([]);
  const [q, setQ] = useState("");
  const shown = useMemo(() => items.filter((i) => (type === "all" || i.type === type)
    && need.every((k) => i.facts.some((f) => f.facility === k && (f.status === "available" || f.status === "partial")))
    && (!q.trim() || i.name.toLowerCase().includes(q.trim().toLowerCase()))), [items, type, need, q]);
  const toggle = (k: string) => setNeed((n) => (n.includes(k) ? n.filter((x) => x !== k) : [...n, k]));
  return (
    <div>
      <div className="grid gap-4 rounded-card border border-line bg-paper p-4 sm:p-5">
        <div>
          <label htmlFor="acc-q" className="text-sm font-bold">Search by name</label>
          <input id="acc-q" type="search" value={q} onChange={(e) => setQ(e.target.value)} className="mt-1 w-full rounded-lg border border-line-strong bg-white p-3 text-base" />
        </div>
        <fieldset>
          <legend className="text-sm font-bold">What are you looking for?</legend>
          <div className="mt-2 flex flex-wrap gap-2">
            {TYPES.map((t) => (<label key={t.key} className={"inline-flex min-h-11 cursor-pointer items-center rounded-pill border px-4 text-sm font-semibold " + (type === t.key ? "border-ink bg-ink text-white" : "border-line-strong bg-white")}><input type="radio" name="acc-type" className="sr-only" checked={type === t.key} onChange={() => setType(t.key)} />{t.label}</label>))}
          </div>
        </fieldset>
        <fieldset>
          <legend className="text-sm font-bold">It should have (choose any)</legend>
          <div className="mt-2 flex flex-wrap gap-2">
            {FILTERS.map((f) => (<label key={f.key} className={"inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-pill border px-4 text-sm font-semibold " + (need.includes(f.key) ? "border-ink bg-ink text-white" : "border-line-strong bg-white")}><input type="checkbox" className="sr-only" checked={need.includes(f.key)} onChange={() => toggle(f.key)} />{f.label}</label>))}
          </div>
        </fieldset>
      </div>
      <p role="status" aria-live="polite" className="mt-4 text-sm text-ink-soft">{shown.length === 1 ? "1 listing" : `${shown.length} listings`} with information shared by their owners.</p>
      {shown.length === 0 ? (
        <p className="mt-4 rounded-card border border-line bg-paper p-5">Nothing matches those choices yet. Fewer filters may help, and a place missing from this list has not necessarily got no access: it may just not have shared details yet.</p>
      ) : (
        <ul className="mt-4 grid gap-4 sm:grid-cols-2">
          {shown.map((i) => (
            <li key={`${i.type}-${i.id}`} className="rounded-card border border-line bg-white p-5 shadow-soft">
              <p className="text-xs font-bold uppercase tracking-wide text-ink-soft">{TYPE_LABEL[i.type]}{i.place ? ` · ${i.place}` : ""}</p>
              <h3 className="mt-1 font-display text-lg font-bold"><Link href={i.href} className="underline-offset-2 hover:underline">{i.name}</Link></h3>
              {i.summary && <p className="mt-1 line-clamp-3 text-sm text-ink-soft">{i.summary}</p>}
              {highlights(i.facts).length > 0 && <ul className="mt-3 flex flex-wrap gap-2" aria-label="Facilities they say they have">{highlights(i.facts).map((h) => <li key={h} className="rounded-md border border-emerald-700 bg-emerald-50 px-2 py-0.5 text-xs font-bold text-emerald-950">{h}</li>)}</ul>}
              <p className="mt-3 text-xs text-ink-soft">{PROVENANCE_LABEL[i.verification]} · updated {dateLine(i.updated_at)}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

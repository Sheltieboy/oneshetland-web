"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { noticesHref, type NoticesQuery } from "@/lib/notices-alerts";

type Option = { id: string; name: string };

/**
 * The area filter on /notices: a searchable list of the physical areas, "My areas" for a member who has chosen some, and "Shetland-wide only".
 * Every choice is a plain link (URL state, shareable); the search box only narrows the visible list. Works without scripts as a <details> list.
 */
export function AreaFilter({ options, query, hasMyAreas, base = "/notices" }: { options: Option[]; query: NoticesQuery; hasMyAreas: boolean; base?: string }) {
  const [q, setQ] = useState("");
  const shown = useMemo(() => options.filter((o) => o.name.toLowerCase().includes(q.trim().toLowerCase())), [options, q]);
  const current =
    query.area.mode === "my" ? "My areas"
    : query.area.mode === "wide" ? "Shetland-wide only"
    : query.area.mode === "ids" ? query.area.ids.map((id) => options.find((o) => o.id === id)?.name ?? id).join(", ")
    : "All of Shetland";
  const go = (area: NoticesQuery["area"]) => noticesHref({ ...query, area, page: 1 }, base);
  const row = "flex min-h-[44px] items-center rounded-lg px-3 text-sm font-medium text-ink hover:bg-sand";
  return (
    <details className="group relative">
      <summary className="flex min-h-[44px] cursor-pointer list-none items-center gap-2 rounded-pill border border-line-strong bg-paper px-4 text-sm font-semibold text-ink-soft hover:bg-sand [&::-webkit-details-marker]:hidden">
        <span className="text-ink-muted">Area:</span> <span className="max-w-[14rem] truncate text-ink">{current}</span>
        <span aria-hidden className="text-ink-faint transition-transform group-open:rotate-180">{"▾"}</span>
      </summary>
      <div className="absolute left-0 z-30 mt-2 w-[min(22rem,calc(100vw-2.5rem))] rounded-xl border border-line bg-paper p-3 shadow-lift">
        <label className="block">
          <span className="sr-only">Search areas</span>
          <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search areas" className="h-11 w-full rounded-lg border border-line-strong bg-cream px-3 text-sm text-ink" />
        </label>
        <ul className="mt-2 max-h-72 overflow-y-auto">
          <li><Link href={go({ mode: "all" })} className={row}>All of Shetland</Link></li>
          {hasMyAreas && <li><Link href={go({ mode: "my" })} className={row + " font-bold"}>My areas</Link></li>}
          <li><Link href={go({ mode: "wide" })} className={row}>Shetland-wide notices only</Link></li>
          {shown.map((o) => <li key={o.id}><Link href={go({ mode: "ids", ids: [o.id] })} className={row}>{o.name}</Link></li>)}
          {shown.length === 0 && <li className="px-3 py-3 text-sm text-ink-muted">No area matches that search.</li>}
        </ul>
      </div>
    </details>
  );
}

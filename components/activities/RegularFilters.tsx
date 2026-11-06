import Link from "next/link";
import { ACTIVITY_CATEGORIES, DAY_SHORT, WEEK_ORDER, WHEN_OPTIONS, regularHref, type RegularFilters as F } from "@/lib/activities";
import { REGULAR } from "./tokens";

const chip = (on: boolean) => "shrink-0 rounded-pill px-3.5 py-1.5 text-sm font-semibold transition " + (on ? "text-paper shadow-soft" : "border border-line-strong text-ink-soft hover:bg-sand");
const scroller = "-mx-5 flex gap-2 overflow-x-auto px-5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden";

/** All filters are plain links (shareable URLs, no client state): when, day of week, category, area and drop-in. */
export function RegularFilters({ f, areas }: { f: F; areas: readonly { key: string; label: string }[] }) {
  const toggleDay = (d: number) => (f.days.includes(d) ? f.days.filter((x) => x !== d) : [...f.days, d]);
  return (
    <div className="space-y-2.5">
      <div className={scroller} role="group" aria-label="When">
        {WHEN_OPTIONS.map((o) => (
          <Link key={o.value} href={regularHref({ ...f, when: o.value })} className={chip(f.when === o.value)} style={f.when === o.value ? { background: REGULAR } : undefined} aria-current={f.when === o.value ? "true" : undefined}>{o.label}</Link>
        ))}
        <span className="mx-1 hidden h-6 w-px shrink-0 self-center bg-line-strong sm:block" />
        <Link href={regularHref({ ...f, dropIn: !f.dropIn })} className={chip(!!f.dropIn)} style={f.dropIn ? { background: REGULAR } : undefined} aria-pressed={!!f.dropIn}>Drop-in only</Link>
      </div>
      <div className={scroller} role="group" aria-label="Day of the week">
        {WEEK_ORDER.map((d) => (
          <Link key={d} href={regularHref({ ...f, days: toggleDay(d) })} className={chip(f.days.includes(d))} style={f.days.includes(d) ? { background: REGULAR } : undefined} aria-pressed={f.days.includes(d)}>{DAY_SHORT[d]}</Link>
        ))}
      </div>
      <div className={scroller} role="group" aria-label="Category">
        <Link href={regularHref({ ...f, category: undefined })} className={chip(!f.category)} style={!f.category ? { background: REGULAR } : undefined}>All kinds</Link>
        {ACTIVITY_CATEGORIES.map((c) => (
          <Link key={c.value} href={regularHref({ ...f, category: c.value })} className={chip(f.category === c.value)} style={f.category === c.value ? { background: REGULAR } : undefined}>{c.label}</Link>
        ))}
      </div>
      <div className={scroller} role="group" aria-label="Area">
        <Link href={regularHref({ ...f, locality: undefined })} className={chip(!f.locality)} style={!f.locality ? { background: REGULAR } : undefined}>Anywhere</Link>
        {areas.map((a) => (
          <Link key={a.key} href={regularHref({ ...f, locality: a.label })} className={chip(f.locality === a.label)} style={f.locality === a.label ? { background: REGULAR } : undefined}>{a.label}</Link>
        ))}
      </div>
    </div>
  );
}

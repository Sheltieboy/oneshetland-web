import Link from "next/link";
import { CATEGORY_LABEL } from "@/lib/local-data";
import { catColorFor } from "@/lib/business-page/tokens";
import { clampDescription, safeWebsite, type ShowcaseMember } from "@/lib/launch50-core";

/**
 * One Launch 50 member. Every member gets this exact card: same size, same fields, no tier, no badge, no position cue.
 */
export function ShowcaseCard({ m }: { m: ShowcaseMember }) {
  const color = catColorFor(m.category);
  const site = safeWebsite(m.website);
  const desc = clampDescription(m.description, 220);
  const label = m.category ? CATEGORY_LABEL[m.category] ?? null : null;
  return (
    <li className="flex flex-col overflow-hidden rounded-2xl border border-line bg-paper shadow-soft" data-launch50-card>
      <div className="relative h-36 w-full" style={{ background: color }}>
        {m.cover_url && <img src={m.cover_url} alt={`${m.name} cover photo`} loading="lazy" className="h-full w-full object-cover" />}
      </div>
      <div className="flex flex-1 flex-col p-5">
        <div className="relative z-10 -mt-12 mb-3 h-14 w-14 shrink-0 overflow-hidden rounded-xl border-2 border-paper bg-paper shadow-soft">
          {m.logo_url
            ? <img src={m.logo_url} alt={`${m.name} logo`} loading="lazy" className="h-full w-full object-cover" />
            : <div aria-hidden className="grid h-full w-full place-items-center font-display text-xl font-bold text-paper" style={{ background: color }}>{m.name.slice(0, 1)}</div>}
        </div>
        <h3 className="font-display text-xl font-bold text-ink">{m.name}</h3>
        {label && <p className="mt-0.5 text-sm font-semibold" style={{ color }}>{label}</p>}
        {desc && <p className="mt-3 text-sm leading-relaxed text-ink-soft">{desc}</p>}
        {m.address && <p className="mt-3 text-sm text-ink-muted">{m.address}</p>}
        <div className="mt-auto flex flex-wrap items-center gap-x-5 gap-y-2 pt-5">
          <Link href={`/directory/${m.slug || m.id}`} className="rounded-pill bg-navy px-4 py-2 text-sm font-bold text-paper focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2" style={{ ["--tw-ring-color" as string]: color }}>
            View listing
          </Link>
          {site && (
            <a href={site.href} target="_blank" rel="noopener noreferrer" className="text-sm font-semibold text-ink-soft underline underline-offset-4 hover:text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2">
              Website: {site.label}
            </a>
          )}
        </div>
      </div>
    </li>
  );
}

export function ShowcaseGrid({ members }: { members: ShowcaseMember[] }) {
  if (members.length === 0) {
    return <p className="mt-8 rounded-2xl border border-dashed border-line-strong bg-sand/40 px-6 py-10 text-center text-ink-soft">The first Launch 50 members will appear here.</p>;
  }
  return <ul className="mt-8 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">{members.map((m) => <ShowcaseCard key={m.id} m={m} />)}</ul>;
}

import Link from "next/link";
import { CATEGORY_LABEL } from "@/lib/local-data";
import { catColorFor } from "@/lib/business-page/tokens";
import { clampDescription, safeWebsite, type ShowcaseMember } from "@/lib/launch50-core";

/**
 * One Launch 50 business, shown as a proper showcase card. Every business gets this exact card: same size, same fields, same recognition,
 * no tier, no badge that differs, no position cue. Everything comes from the business's own listing; a missing banner or logo gets a tasteful
 * fallback drawn from its category colour.
 */
export function ShowcaseCard({ m }: { m: ShowcaseMember }) {
  const color = catColorFor(m.category);
  const site = safeWebsite(m.website);
  const desc = clampDescription(m.description, 260);
  const label = m.category ? CATEGORY_LABEL[m.category] ?? null : null;
  const where = (m.address ?? "").replace(/\s+/g, " ").trim();
  return (
    <li className="group flex flex-col overflow-hidden rounded-3xl border border-line bg-paper shadow-soft transition hover:shadow-lift" data-launch50-card>
      {/* Banner */}
      <div className="relative h-48 w-full overflow-hidden sm:h-56" style={{ background: `linear-gradient(135deg, ${color} 0%, ${color}e6 45%, ${color}b3 100%)` }}>
        {m.cover_url
          ? <img src={m.cover_url} alt={`${m.name} banner`} loading="lazy" className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.02]" />
          : (
            <>
              <svg aria-hidden="true" viewBox="0 0 400 240" preserveAspectRatio="xMidYMid slice" className="absolute inset-0 h-full w-full opacity-25">
                <circle cx="330" cy="40" r="120" fill="#fff" /><circle cx="60" cy="230" r="150" fill="#fff" opacity="0.5" />
              </svg>
              <span aria-hidden="true" className="absolute inset-0 grid place-items-center font-display text-8xl font-bold text-white/30">{m.name.slice(0, 1)}</span>
            </>
          )}
        <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/35 to-transparent" />
        <span className="absolute left-4 top-4 rounded-pill bg-paper/95 px-3 py-1 text-xs font-bold uppercase tracking-wide text-navy shadow-soft">Launch 50</span>
      </div>

      <div className="flex flex-1 flex-col px-6 pb-6 sm:px-7 sm:pb-7">
        {/* Logo overlaps the banner */}
        <div className="relative z-10 -mt-10 mb-4 h-20 w-20 shrink-0 overflow-hidden rounded-2xl border-4 border-paper bg-paper shadow-soft">
          {m.logo_url
            ? <img src={m.logo_url} alt={`${m.name} logo`} loading="lazy" className="h-full w-full object-cover" />
            : <div aria-hidden className="grid h-full w-full place-items-center font-display text-3xl font-bold text-paper" style={{ background: color }}>{m.name.slice(0, 1)}</div>}
        </div>
        <h3 className="font-display text-2xl font-bold leading-tight text-ink">{m.name}</h3>
        {label && <p className="mt-1 text-sm font-bold uppercase tracking-wide" style={{ color }}>{label}</p>}
        {desc && <p className="mt-4 text-base leading-relaxed text-ink-soft">{desc}</p>}
        {where && (
          <p className="mt-4 flex items-start gap-2 text-sm text-ink-muted">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mt-0.5 shrink-0" aria-hidden="true"><path d="M12 21s7-5.2 7-11a7 7 0 1 0-14 0c0 5.8 7 11 7 11z" /><circle cx="12" cy="10" r="2.5" /></svg>
            <span>{where}</span>
          </p>
        )}
        <div className="mt-auto flex flex-col gap-3 pt-6 sm:flex-row sm:items-center">
          <Link href={`/directory/${m.slug || m.id}`} className="inline-flex min-h-[44px] items-center justify-center rounded-pill bg-navy px-6 py-2.5 text-sm font-bold text-paper transition hover:brightness-110 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2">
            View business
          </Link>
          {site && (
            <a href={site.href} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-[44px] items-center justify-center text-sm font-semibold text-ink-soft underline underline-offset-4 hover:text-ink focus:outline-none focus-visible:ring-2">
              {site.label}
            </a>
          )}
        </div>
        <p className="mt-5 border-t border-line pt-4 text-xs text-ink-muted">Part of OneShetland Launch 50</p>
      </div>
    </li>
  );
}

export function ShowcaseGrid({ members }: { members: ShowcaseMember[] }) {
  if (members.length === 0) {
    return <p className="mt-8 rounded-2xl border border-dashed border-line-strong bg-sand/40 px-6 py-10 text-center text-ink-soft">The first Launch 50 members will appear here.</p>;
  }
  return <ul className="mt-10 grid grid-cols-1 gap-8 md:grid-cols-2">{members.map((m) => <ShowcaseCard key={m.id} m={m} />)}</ul>;
}

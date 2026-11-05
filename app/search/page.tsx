import type { Metadata } from "next";
import Link from "next/link";
import { cleanQuery, groupHits, hrefFor, subtitleFor, KIND_LABEL, RESULTS_LIMIT } from "@/lib/search";
import { searchSite } from "@/lib/search-server";
import { SiteSearch } from "@/components/search/SiteSearch";
import { TrackSearch } from "@/components/analytics/TrackSearch";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Search", robots: { index: false, follow: true } };

const BROWSE = [
  { href: "/directory", label: "Directory" }, { href: "/whats-on", label: "What's On" }, { href: "/jobs", label: "Jobs" },
  { href: "/boats", label: "Boats" }, { href: "/spik", label: "Spik" }, { href: "/notices", label: "Notices" },
];

/** Full results for the site search: every source in one bounded query, grouped, with close matches when nothing matches exactly. */
export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const raw = (await searchParams).q ?? "";
  const q = cleanQuery(raw);
  const out = q ? await searchSite(q, RESULTS_LIMIT) : null;
  const hits = out && out.ok ? out.hits : [];
  const exact = hits.filter((h) => !h.close);
  const close = hits.filter((h) => h.close);

  return (
    <div className="mx-auto max-w-3xl px-5 py-8 sm:py-12">
      <h1 className="font-display text-3xl font-semibold text-navy sm:text-4xl">Search OneShetland</h1>
      <div className="mt-5"><SiteSearch initial={q} placeholder="Search businesses, events, jobs, boats, Spik…" /></div>
      {q && out && out.ok && <TrackSearch section="site" query={q} resultsCount={exact.length} />}

      {!q && (
        <div className="mt-8">
          <p className="text-ink-soft">{raw.trim() ? "Type at least two letters to search." : "Find a business, event, job, boat or Spik word."}</p>
          <BrowseLinks />
        </div>
      )}

      {q && out && !out.ok && (
        <div role="status" className="mt-8 rounded-card border border-line bg-sand p-5">
          <p className="font-semibold text-ink">Search is taking longer than usual.</p>
          <p className="mt-1 text-sm text-ink-soft">We couldn&apos;t get results for &ldquo;{q}&rdquo; just now. Please try again in a moment, or browse a section.</p>
          <BrowseLinks />
        </div>
      )}

      {q && out && out.ok && (
        <div className="mt-8" aria-live="polite">
          {exact.length > 0 && <Groups hits={exact} />}
          {exact.length === 0 && close.length > 0 && (
            <>
              <p className="mb-4 text-ink-soft">No exact match for &ldquo;{q}&rdquo;. Did you mean one of these?</p>
              <Groups hits={close} />
            </>
          )}
          {exact.length > 0 && close.length > 0 && (
            <div className="mt-8"><h2 className="text-sm font-semibold uppercase tracking-wide text-ink-soft">Close matches</h2><Groups hits={close} compact /></div>
          )}
          {hits.length === 0 && (
            <div className="rounded-card border border-line bg-paper p-5">
              <p className="font-semibold text-ink">Nothing found for &ldquo;{q}&rdquo;.</p>
              <ul className="mt-2 list-disc pl-5 text-sm text-ink-soft">
                <li>Check the spelling, or try fewer letters.</li>
                <li>Search a place or business name rather than a full phrase.</li>
                <li>Not listed yet? <Link href="/directory/new" className="font-semibold text-navy underline underline-offset-2">Add a business</Link>.</li>
              </ul>
              <BrowseLinks />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Groups({ hits, compact = false }: { hits: Parameters<typeof groupHits>[0]; compact?: boolean }) {
  return (
    <div className={compact ? "mt-3 space-y-5" : "space-y-8"}>
      {groupHits(hits).map((g) => (
        <section key={g.kind} aria-label={g.heading}>
          {!compact && <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-soft">{g.heading}</h2>}
          <ul className="mt-2 divide-y divide-line overflow-hidden rounded-card border border-line bg-paper">
            {g.hits.map((h) => (
              <li key={`${h.kind}:${h.ref}`}>
                <Link href={hrefFor(h.kind, h.ref)} className="flex min-h-[56px] items-center gap-3 px-4 py-3 transition-colors hover:bg-sand focus-visible:bg-sand">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold text-ink">{h.title}</span>
                    <span className="block truncate text-sm text-ink-soft">{subtitleFor(h)}</span>
                  </span>
                  <span className="shrink-0 rounded-pill border border-line-strong px-2 py-0.5 text-[0.7rem] font-semibold uppercase tracking-wide text-ink-soft">{KIND_LABEL[h.kind]}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

function BrowseLinks() {
  return (
    <p className="mt-4 flex flex-wrap gap-2">
      {BROWSE.map((b) => <Link key={b.href} href={b.href} className="rounded-pill border border-line-strong px-3 py-1.5 text-sm font-semibold text-ink hover:bg-sand">{b.label}</Link>)}
    </p>
  );
}

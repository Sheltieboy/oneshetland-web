import Image from "next/image";
import Link from "next/link";
import {
  getActiveJobs, getOpenShifts, SHIFT_CATEGORY_LABELS,
} from "@/lib/jobs-data";
import { JobCard, ShiftCard, EmptyState, JOBS, SHIFTS } from "@/components/jobs/JobsUI";
import {
  parseFilters, applyFilters, sortJobs, buildFacets, filterCount, toQuery, without, clearAll, resultsLabel, hasAnyRefinement,
  EMPLOYMENT_OPTIONS, WORKPLACE_OPTIONS, SALARY_BANDS, type JobFilters,
} from "@/lib/job-filters";
import { JobFiltersPanel } from "@/components/jobs/JobFiltersPanel";
import { TrackSearch } from "@/components/analytics/TrackSearch";
import { getAccount } from "@/lib/auth";
import { getMyPostingCounts } from "@/lib/jobs-data.server";

export const dynamic = "force-dynamic";
export const metadata = { title: "Work" };

const isShiftsTab = (t?: string) => t === "shifts";

export default async function WorkHubPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const str = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
  const tab = str(sp.tab);
  const filters = parseFilters(sp);                       // jobs: everything lives in the URL
  const q = isShiftsTab(tab) ? str(sp.q) : (filters.q || undefined);
  const category = isShiftsTab(tab) ? str(sp.category) : (filters.category ?? undefined);
  const isShifts = tab === "shifts";
  const accent = isShifts ? SHIFTS : JOBS;

  const account = await getAccount();

  const [allJobs, shifts, posted] = await Promise.all([
    isShifts ? Promise.resolve([]) : getActiveJobs(),
    isShifts ? getOpenShifts(category) : Promise.resolve([]),
    // This page is the one the main nav's "Work" leads to, and it is entirely
    // worker-facing: browse and apply. Everything for the person who POSTED the
    // work lives at /work, which is only reachable through Account. Somebody who
    // had bought a boost came here looking for their shift and found nothing,
    // because there was nothing here to find.
    //
    // So: a shortcut, shown only to people who have actually posted something.
    // A worker never sees it, and the page stays what it is.
    account ? getMyPostingCounts(account.id) : Promise.resolve({ shifts: 0, jobs: 0 }),
  ]);

  // Options come from the live jobs; the matching jobs from the URL state. No empty option is ever offered.
  const facets = buildFacets(allJobs);
  const jobs = sortJobs(applyFilters(allJobs, filters), filters.sort);

  const mine = isShifts ? posted.shifts : posted.jobs;
  const manageHref = isShifts ? "/shifts/manage" : "/jobs/manage";

  const visibleShifts = q
    ? shifts.filter((s) => `${s.title} ${s.category} ${s.location_text}`.toLowerCase().includes(q.toLowerCase()))
    : shifts;

  const chipHref = (cat?: string) => {
    if (!isShifts) return `/jobs${toQuery({ ...filters, category: (cat ?? null) as JobFilters["category"] }) ? `?${toQuery({ ...filters, category: (cat ?? null) as JobFilters["category"] })}` : ""}`;
    const p = new URLSearchParams();
    p.set("tab", "shifts");
    if (cat) p.set("category", cat);
    if (q) p.set("q", q);
    return `/jobs?${p.toString()}`;
  };
  const hrefFor = (f: JobFilters) => { const qs = toQuery(f); return qs ? `/jobs?${qs}` : "/jobs"; };

  // Category stays immediately visible; only categories live jobs have (the chosen one always stays).
  const cats = isShifts
    ? Object.entries(SHIFT_CATEGORY_LABELS).map(([key, label]) => ({ key, label }))
    : [...new Set([...facets.categories, ...(filters.category ? [filters.category] : [])])].map((c) => ({ key: c as string, label: c as string }));

  // Active-filter chips: each removable on its own.
  const optLabel = (kind: "employment" | "workplace" | "salary", key: string) =>
    ((kind === "employment" ? EMPLOYMENT_OPTIONS : kind === "workplace" ? WORKPLACE_OPTIONS : SALARY_BANDS) as readonly { key: string; label: string }[]).find((o) => o.key === key)?.label ?? key;
  const active: { label: string; href: string }[] = isShifts ? [] : [
    ...(filters.q ? [{ label: `“${filters.q}”`, href: hrefFor(without(filters, "q")) }] : []),
    ...(filters.category ? [{ label: filters.category as string, href: hrefFor(without(filters, "category")) }] : []),   // the category chip row can scroll the chosen one out of view on a phone
    ...filters.locations.map((v) => ({ label: v, href: hrefFor(without(filters, "locations", v)) })),
    ...filters.employment.map((v) => ({ label: optLabel("employment", v), href: hrefFor(without(filters, "employment", v)) })),
    ...filters.workplace.map((v) => ({ label: optLabel("workplace", v), href: hrefFor(without(filters, "workplace", v)) })),
    ...filters.salary.map((v) => ({ label: optLabel("salary", v), href: hrefFor(without(filters, "salary", v)) })),
    ...filters.employers.map((v) => ({ label: v, href: hrefFor(without(filters, "employers", v)) })),
  ];
  const refined = !isShifts && hasAnyRefinement(filters);

  return (
    <>
      {q && (
        <TrackSearch
          section="jobs"
          query={q}
          resultsCount={isShifts ? visibleShifts.length : jobs.length}
        />
      )}
      <section className="relative isolate overflow-hidden" style={{ background: accent }}>
        <Image src="/heroes/jobs.webp" alt="" fill priority className="object-cover opacity-20" />
        <div className="absolute inset-0" style={{ background: `linear-gradient(160deg,${accent}e6 30%,${accent}b0)` }} />
        <div className="relative mx-auto max-w-6xl px-5 py-10 sm:py-12">
          <p className="text-xs font-bold uppercase tracking-widest text-white/75">OneShetland · Work</p>
          <h1 className="mt-1 font-display text-4xl font-bold text-white sm:text-5xl">Find work in Shetland</h1>
          <p className="mt-2 max-w-xl text-base text-white/85 sm:text-lg">
            {isShifts
              ? "Casual, same-day and short-notice shifts across the isles."
              : "Permanent, part-time and seasonal roles from Shetland employers."}
          </p>
          <div className="mt-5 inline-flex gap-1 rounded-pill bg-white/15 p-1 backdrop-blur-sm">
            <Link href="/jobs" className={"rounded-pill px-5 py-2 text-sm font-bold transition " + (!isShifts ? "bg-white" : "text-white/80 hover:text-white")} style={!isShifts ? { color: JOBS } : undefined}>
              Jobs
            </Link>
            <Link href="/jobs?tab=shifts" className={"rounded-pill px-5 py-2 text-sm font-bold transition " + (isShifts ? "bg-white" : "text-white/80 hover:text-white")} style={isShifts ? { color: SHIFTS } : undefined}>
              Shifts
            </Link>
          </div>
        </div>
      </section>

      <div className="sticky top-16 z-30 border-b border-line bg-cream/90 backdrop-blur-md">
        <div className="mx-auto max-w-6xl px-5 py-3">
          <form action="/jobs" method="get" className="mb-3 flex gap-2">
            {isShifts && <input type="hidden" name="tab" value="shifts" />}
            {!isShifts && filters.category && <input type="hidden" name="category" value={filters.category} />}
            {!isShifts && filters.locations.map((v) => <input key={`l${v}`} type="hidden" name="loc" value={v} />)}
            {!isShifts && filters.employment.map((v) => <input key={`e${v}`} type="hidden" name="emp" value={v} />)}
            {!isShifts && filters.workplace.map((v) => <input key={`w${v}`} type="hidden" name="work" value={v} />)}
            {!isShifts && filters.salary.map((v) => <input key={`s${v}`} type="hidden" name="sal" value={v} />)}
            {!isShifts && filters.employers.map((v) => <input key={`m${v}`} type="hidden" name="employer" value={v} />)}
            {!isShifts && filters.sort !== "newest" && <input type="hidden" name="sort" value={filters.sort} />}
            <input
              name="q"
              defaultValue={q ?? ""}
              placeholder={isShifts ? "Search shifts — title, place…" : "Search jobs — title, employer, keyword…"}
              className="w-full rounded-pill border border-line bg-paper px-5 py-2.5 text-ink shadow-soft outline-none placeholder:text-ink-faint"
            />
            <button type="submit" className="rounded-pill px-5 py-2.5 font-semibold text-paper" style={{ background: accent }}>
              Search
            </button>
          </form>
          <div className="flex items-center gap-2">
          {cats.length > 0 && <div className="flex min-w-0 flex-1 gap-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <Link href={chipHref()} className={"shrink-0 rounded-pill px-4 py-2 text-sm font-semibold transition " + (!category ? "text-paper shadow-soft" : "border border-line-strong text-ink-soft hover:bg-sand")} style={!category ? { background: accent } : undefined}>
              All
            </Link>
            {cats.map((c) => (
              <Link key={c.key} href={chipHref(c.key)} className={"shrink-0 rounded-pill px-4 py-2 text-sm font-semibold transition " + (category === c.key ? "text-paper shadow-soft" : "border border-line-strong text-ink-soft hover:bg-sand")} style={category === c.key ? { background: accent } : undefined}>
                {c.label}
              </Link>
            ))}
          </div>}
          {!isShifts && <JobFiltersPanel facets={facets} filters={filters} accent={accent} clearHref={hrefFor(clearAll(filters))} />}
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-6xl px-5 py-10 sm:py-12">
        {!isShifts && (
          <div className="mb-5 flex flex-wrap items-center gap-x-3 gap-y-2" data-testid="results-bar">
            <p className="font-display text-lg font-bold text-ink" data-testid="results-count" aria-live="polite">{resultsLabel(jobs.length)}</p>
            {active.map((a) => (
              <Link key={a.label + a.href} href={a.href} className="inline-flex items-center gap-1 rounded-pill border border-line-strong bg-paper px-3 py-1 text-xs font-semibold text-ink-soft hover:bg-sand" aria-label={`Remove filter ${a.label}`} data-testid="active-filter">
                {a.label} <span aria-hidden>×</span>
              </Link>
            ))}
            {(filterCount(filters) > 0 || filters.q || filters.category) && (
              <Link href={hrefFor(clearAll(filters))} className="text-xs font-semibold text-ink-soft underline" data-testid="clear-all">Clear all</Link>
            )}
            <span className="ml-auto inline-flex items-center gap-1 text-xs text-ink-muted" data-testid="sort">
              Sort:
              <Link href={hrefFor({ ...filters, sort: "newest" })} className={"rounded-pill px-2.5 py-1 font-semibold " + (filters.sort === "newest" ? "bg-sand text-ink" : "hover:bg-sand")}>Newest</Link>
              <Link href={hrefFor({ ...filters, sort: "closing" })} className={"rounded-pill px-2.5 py-1 font-semibold " + (filters.sort === "closing" ? "bg-sand text-ink" : "hover:bg-sand")}>Closing soon</Link>
            </span>
          </div>
        )}

        {mine > 0 && (
          <Link
            href={manageHref}
            className="mb-6 flex items-center justify-between gap-4 rounded-card border px-5 py-4 shadow-soft transition hover:-translate-y-0.5 hover:shadow-lift"
            style={{ borderColor: `${accent}55`, background: `${accent}0d` }}
          >
            <div className="min-w-0">
              <p className="font-display text-lg font-bold text-ink">
                {isShifts ? "My posted shifts" : "My posted jobs"}
              </p>
              <p className="mt-0.5 text-sm text-ink-soft">
                {mine} posted · applicants, check-in{isShifts ? " and boosting" : ""}
              </p>
            </div>
            <span className="shrink-0 rounded-pill px-4 py-2 text-sm font-bold text-paper" style={{ background: accent }}>
              Manage →
            </span>
          </Link>
        )}

        {isShifts ? (
          visibleShifts.length === 0 ? (
            <EmptyState icon="⚡" title="No shifts right now" body="Nothing matches just now — check back soon, new shifts are posted throughout the day." cta={{ label: "Post a shift", href: "/shifts/new", color: SHIFTS }} />
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {visibleShifts.map((s) => <ShiftCard key={s.id} shift={s} />)}
            </div>
          )
        ) : jobs.length === 0 ? (
          refined ? (
            <div className="rounded-card border border-line bg-paper px-6 py-12 text-center shadow-soft" data-testid="zero-results">
              <p className="font-display text-2xl font-bold text-ink">No jobs match those filters.</p>
              <p className="mx-auto mt-2 max-w-md text-ink-soft">Try removing a filter or searching for something broader.</p>
              <div className="mt-5 flex flex-wrap justify-center gap-3">
                <Link href={hrefFor(clearAll(filters))} className="rounded-pill px-5 py-2.5 font-semibold text-paper" style={{ background: accent }}>Clear filters</Link>
                <Link href="/jobs" className="rounded-pill border border-line-strong px-5 py-2.5 font-semibold text-ink hover:bg-sand">View all jobs</Link>
              </div>
            </div>
          ) : (
            <EmptyState icon="💼" title="No jobs right now" body="New roles are posted regularly — check back soon." cta={{ label: "Post a job", href: "/jobs/new", color: JOBS }} />
          )
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {jobs.map((j) => <JobCard key={j.id} job={j} />)}
          </div>
        )}

        <div className="mt-12 rounded-card border px-6 py-8 text-center" style={{ borderColor: `${accent}40`, background: `${accent}0d` }}>
          <p className="font-display text-2xl font-bold text-ink">{isShifts ? "Need cover at short notice?" : "Hiring in Shetland?"}</p>
          <p className="mx-auto mt-2 max-w-lg text-ink-soft">
            {isShifts
              ? "Post a shift and reach available local workers in minutes."
              : "Post a role for free and manage applicants through a simple pipeline."}
          </p>
          <div className="mt-5 flex flex-wrap justify-center gap-3">
            <Link href={isShifts ? "/shifts/new" : "/jobs/new"} className="inline-block rounded-pill px-6 py-3 font-semibold text-paper shadow-soft transition hover:brightness-95" style={{ background: accent }}>
              {isShifts ? "Post a shift →" : "Post a job →"}
            </Link>
            {mine > 0 && (
              <Link href={manageHref} className="inline-block rounded-pill border border-line-strong bg-paper px-6 py-3 font-semibold text-ink transition hover:bg-sand">
                {isShifts ? "Manage my shifts" : "Manage my jobs"}
              </Link>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

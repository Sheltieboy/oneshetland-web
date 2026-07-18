import Image from "next/image";
import Link from "next/link";
import { searchVessels, fetchHeroPhotos, computeFleetStats, BOATS } from "@/lib/boats-data";
import { BoatsSortableList } from "@/components/boats/BoatsSortableList";
import { BoatsSavedRecent } from "@/components/boats/BoatsSavedRecent";
import { BoatBuildMap } from "@/components/boats/BoatBuildMap";
import { TrackSearch } from "@/components/analytics/TrackSearch";
import { BoatsSearchBar } from "@/components/boats/BoatsSearchBar";

export const dynamic = "force-dynamic";
export const metadata = { title: "Da Boats", description: "The Shetland fishing fleet, past and present — names, numbers, builders and the folk who knew them." };

const DECADES = ["1900s", "1910s", "1920s", "1930s", "1940s", "1950s", "1960s", "1970s", "1980s", "1990s", "2000s", "2010s", "2020s"];

export default async function BoatsPage({ searchParams }: { searchParams: Promise<{ q?: string; decade?: string; photos?: string; builder?: string }> }) {
  const { q, decade, photos, builder } = await searchParams;
  const all = await searchVessels(q ?? "", 600);

  // Client-equivalent filtering (kept server-side from the fetched set)
  let rows = all;
  if (decade) { const d = parseInt(decade); rows = rows.filter((r) => r.built_year != null && Math.floor(r.built_year / 10) * 10 === d); }
  if (photos === "1") rows = rows.filter((r) => (r.media_asset_count ?? 0) > 0);
  if (builder) rows = rows.filter((r) => (r.builder ?? "").toLowerCase().includes(builder.toLowerCase()));

  const stats = computeFleetStats(all);
  const display = rows.slice(0, 120);
  const heroes = await fetchHeroPhotos(display.map((r) => r.id));
  const browsing = !q && !decade && !photos && !builder;

  const chip = (label: string, href: string, on: boolean) => (
    <Link key={label} href={href} className={"shrink-0 rounded-pill px-3.5 py-1.5 text-sm font-semibold transition " + (on ? "text-white shadow-soft" : "border border-line-strong text-ink-soft hover:bg-sand")} style={on ? { background: BOATS } : undefined}>{label}</Link>
  );
  const decadeHref = (d?: string) => { const p = new URLSearchParams(); if (q) p.set("q", q); if (photos) p.set("photos", photos); if (d) p.set("decade", d); const s = p.toString(); return s ? `/boats?${s}` : "/boats"; };
  const photosHref = () => { const p = new URLSearchParams(); if (q) p.set("q", q); if (decade) p.set("decade", decade); if (photos !== "1") p.set("photos", "1"); const s = p.toString(); return s ? `/boats?${s}` : "/boats"; };

  return (
    <>
      {q && <TrackSearch section="boats" query={q} resultsCount={rows.length} />}
      {/* Hero */}
      <section className="relative isolate overflow-hidden text-paper" style={{ background: BOATS }}>
        <Image src="/heroes/da-boats.jpg" alt="" fill priority className="object-cover opacity-30" />
        <div className="absolute inset-0" style={{ background: `linear-gradient(to top, ${BOATS}f2, ${BOATS}99 55%, ${BOATS}40)` }} />
        <div className="relative mx-auto max-w-6xl px-5 py-12 sm:py-16">
          <p className="text-xs font-bold uppercase tracking-widest text-paper/80">OneShetland</p>
          <h1 className="mt-2 font-display text-5xl font-bold sm:text-6xl">Da Boats</h1>
          <p className="mt-3 max-w-xl text-lg text-paper/90">The Shetland fishing fleet, past and present — names, numbers, builders and the folk who knew them.</p>
          <p className="mt-4 inline-block rounded-pill bg-white/15 px-3 py-1 text-sm font-semibold">{stats.total.toLocaleString()} vessels recorded</p>
        </div>
      </section>

      {/* Sticky search + filters */}
      <div className="sticky top-16 z-30 border-b border-line bg-cream/90 backdrop-blur-md">
        <div className="mx-auto max-w-6xl px-5 py-3">
          <BoatsSearchBar q={q ?? ""} decade={decade} photos={photos} builder={builder} accent={BOATS} />
          <div className="-mx-5 flex gap-2 overflow-x-auto px-5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {chip("All", decadeHref(), !decade)}
            {DECADES.map((d) => chip(d, decadeHref(d.slice(0, 4)), decade === d.slice(0, 4)))}
            <span className="w-px shrink-0 bg-line" />
            {chip("With photos", photosHref(), photos === "1")}
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-6xl px-5 py-10 sm:py-12">
        {/* Saved + recently-viewed (client island, browse view only) */}
        {browsing && <BoatsSavedRecent />}

        {/* Fleet stats — only on the clean browse view */}
        {browsing && (
          <section className="mb-10 grid gap-4 lg:grid-cols-3">
            <div className="rounded-card border border-line bg-paper p-5 shadow-soft">
              <p className="font-display font-bold text-ink">The fleet at a glance</p>
              <div className="mt-3 grid grid-cols-2 gap-3 text-center">
                <Stat n={stats.total} label="vessels" />
                <Stat n={stats.withPhotos} label="with photos" />
                <Stat n={stats.builderCount} label="builders" />
                <Stat label="years" text={stats.yearMin && stats.yearMax ? `${stats.yearMin}–${stats.yearMax}` : "—"} />
              </div>
            </div>
            <div className="rounded-card border border-line bg-paper p-5 shadow-soft">
              <p className="mb-3 font-display font-bold text-ink">By decade</p>
              <div className="space-y-1.5">
                {stats.decades.slice(-8).map((d) => {
                  const max = Math.max(...stats.decades.map((x) => x.count), 1);
                  return (
                    <Link key={d.label} href={decadeHref(d.label.slice(0, 4))} className="flex items-center gap-2 text-sm hover:opacity-80">
                      <span className="w-12 shrink-0 text-ink-muted">{d.label}</span>
                      <span className="h-3 rounded-pill" style={{ width: `${Math.max(6, (d.count / max) * 100)}%`, background: BOATS }} />
                      <span className="text-xs font-semibold text-ink-faint">{d.count}</span>
                    </Link>
                  );
                })}
              </div>
            </div>
            <div className="rounded-card border border-line bg-paper p-5 shadow-soft">
              <p className="mb-3 font-display font-bold text-ink">Top builders</p>
              <div className="space-y-1">
                {stats.topBuilders.slice(0, 8).map((b) => (
                  <Link key={b.name} href={`/boats?builder=${encodeURIComponent(b.name)}`} className="flex items-center justify-between text-sm hover:opacity-80">
                    <span className="truncate text-ink-soft">{b.name}</span>
                    <span className="ml-2 shrink-0 font-semibold text-ink-faint">{b.count}</span>
                  </Link>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* Hull split + where she was built — browse view only */}
        {browsing && (stats.hulls.length > 0 || stats.buildPlaces.length > 0) && (
          <section className="mb-10 grid gap-4 lg:grid-cols-3">
            {stats.hulls.length > 0 && (
              <div className="rounded-card border border-line bg-paper p-5 shadow-soft">
                <p className="mb-3 font-display font-bold text-ink">By hull material</p>
                <div className="space-y-1.5">
                  {stats.hulls.map((h) => {
                    const max = Math.max(...stats.hulls.map((x) => x.count), 1);
                    return (
                      <div key={h.label} className="flex items-center gap-2 text-sm">
                        <span className="w-20 shrink-0 text-ink-muted">{h.label}</span>
                        <span className="h-3 rounded-pill" style={{ width: `${Math.max(6, (h.count / max) * 100)}%`, background: BOATS }} />
                        <span className="text-xs font-semibold text-ink-faint">{h.count}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
            {stats.buildPlaces.length > 0 && (
              <div className="rounded-card border border-line bg-paper p-5 shadow-soft lg:col-span-2">
                <p className="font-display font-bold text-ink">Where she was built</p>
                <p className="mb-3 text-xs text-ink-muted">{stats.placedBoats} boats traced to {stats.buildPlaces.length} yards.</p>
                <BoatBuildMap places={stats.buildPlaces} />
              </div>
            )}
          </section>
        )}

        {/* Active filter */}
        {!browsing && (
          <div className="mb-6 flex items-center gap-3">
            <p className="text-ink-soft">{rows.length} {rows.length === 1 ? "vessel" : "vessels"}{q ? ` for “${q}”` : ""}{decade ? ` · ${decade}s` : ""}{builder ? ` · ${builder}` : ""}{photos === "1" ? " · with photos" : ""}</p>
            <Link href="/boats" className="rounded-pill border border-line-strong px-3 py-1 text-sm font-semibold text-ink-soft hover:bg-sand">Clear</Link>
          </div>
        )}

        {display.length === 0 ? (
          <div className="rounded-card border border-dashed border-line bg-paper/60 px-6 py-12 text-center">
            <p className="font-display text-lg font-bold text-ink">No vessels found</p>
            <p className="mt-1 text-sm text-ink-muted">Try a different name, number or decade.</p>
          </div>
        ) : (
          <BoatsSortableList rows={display} heroes={heroes} />
        )}
      </div>
    </>
  );
}

function Stat({ n, label, text }: { n?: number; label: string; text?: string }) {
  return (
    <div>
      <p className="font-display text-2xl font-bold text-ink">{text ?? (n ?? 0).toLocaleString()}</p>
      <p className="text-xs text-ink-muted">{label}</p>
    </div>
  );
}

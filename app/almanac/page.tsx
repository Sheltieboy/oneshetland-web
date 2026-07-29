import Link from "next/link";
import { fetchLiveArticles, PILLARS, pillarMeta, articleDate, type Pillar } from "@/lib/almanac-data";
import { SafeImage } from "@/components/ui/SafeImage";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "The Shetland Almanac",
  description: "Stories, stats and curiosities from across Shetland — the dialect, the events, the fleet, the cruise season and island life, drawn from OneShetland's own data.",
};

const ACCENT = "#2a8b5c";

export default async function AlmanacPage({ searchParams }: { searchParams: Promise<{ pillar?: string }> }) {
  const { pillar } = await searchParams;
  const active = PILLARS.find((p) => p.key === pillar)?.key as Pillar | undefined;
  const articles = await fetchLiveArticles({ pillar: active, limit: 60 });
  const [lead, ...rest] = articles;

  return (
    <main className="mx-auto max-w-5xl px-5 pb-20 pt-8">
      <header className="text-center">
        <p className="text-xs font-bold uppercase tracking-widest" style={{ color: ACCENT }}>OneShetland</p>
        <h1 className="mt-2 font-display text-4xl font-bold text-navy sm:text-5xl">The Shetland Almanac</h1>
        <p className="mx-auto mt-3 max-w-xl text-lg text-ink-soft">
          Stories, stats and curiosities from across the isles — the dialect, the events, the fleet and island life.
        </p>
      </header>

      <div className="mt-7 flex flex-wrap justify-center gap-2">
        <Link href="/almanac" className={"rounded-pill px-4 py-2 text-sm font-semibold transition " + (!active ? "text-white" : "border border-line-strong text-ink-soft hover:bg-sand")} style={!active ? { background: ACCENT } : undefined}>All</Link>
        {PILLARS.filter((p) => p.key !== "jobs").map((p) => (
          <Link key={p.key} href={`/almanac?pillar=${p.key}`} className={"rounded-pill px-4 py-2 text-sm font-semibold transition " + (active === p.key ? "text-white" : "border border-line-strong text-ink-soft hover:bg-sand")} style={active === p.key ? { background: p.color } : undefined}>{p.label}</Link>
        ))}
      </div>

      {articles.length === 0 ? (
        <p className="mt-16 rounded-card border border-line bg-paper px-4 py-16 text-center text-ink-muted">
          The first pieces are on their way — check back shortly.
        </p>
      ) : (
        <>
          {lead && (
            <Link href={`/almanac/${lead.slug}`} className="group mt-10 block overflow-hidden rounded-card border border-line bg-paper shadow-soft transition hover:shadow-lift sm:flex">
              <div className="relative h-56 shrink-0 sm:h-auto sm:w-2/5" style={{ background: pillarMeta(lead.pillar).color + "1a" }}>
                {lead.hero_url && <SafeImage src={lead.hero_url} alt="" className="h-full w-full object-cover" />}
              </div>
              <div className="flex flex-col justify-center p-6 sm:w-3/5">
                <span className="w-fit rounded-pill px-2.5 py-1 text-xs font-bold text-white" style={{ background: pillarMeta(lead.pillar).color }}>{pillarMeta(lead.pillar).label}</span>
                <h2 className="mt-3 font-display text-2xl font-bold text-navy group-hover:underline">{lead.title}</h2>
                {lead.excerpt && <p className="mt-2 text-ink-soft">{lead.excerpt}</p>}
                <span className="mt-3 text-sm text-ink-muted">{articleDate(lead.publish_at)}</span>
              </div>
            </Link>
          )}

          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {rest.map((a) => (
              <Link key={a.id} href={`/almanac/${a.slug}`} className="group flex flex-col overflow-hidden rounded-card border border-line bg-paper shadow-soft transition hover:-translate-y-0.5 hover:shadow-lift">
                <div className="relative h-40" style={{ background: pillarMeta(a.pillar).color + "1a" }}>
                  {a.hero_url && <SafeImage src={a.hero_url} alt="" className="h-full w-full object-cover" />}
                </div>
                <div className="flex flex-1 flex-col p-4">
                  <span className="w-fit rounded-pill px-2 py-0.5 text-[11px] font-bold text-white" style={{ background: pillarMeta(a.pillar).color }}>{pillarMeta(a.pillar).label}</span>
                  <h3 className="mt-2 font-display font-bold text-navy group-hover:underline">{a.title}</h3>
                  {a.excerpt && <p className="mt-1 line-clamp-2 text-sm text-ink-muted">{a.excerpt}</p>}
                  <span className="mt-auto pt-3 text-xs text-ink-muted">{articleDate(a.publish_at)}</span>
                </div>
              </Link>
            ))}
          </div>
        </>
      )}
    </main>
  );
}

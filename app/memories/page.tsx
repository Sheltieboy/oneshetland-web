import Image from "next/image";
import Link from "next/link";
import { getMemoryPins, searchMemories, MEMORIES, ERA_SUGGESTIONS } from "@/lib/memories-data";
import { MemoryMap } from "@/components/memories/MemoryMap";
import { MemoryCard } from "@/components/memories/MemoriesUI";

export const dynamic = "force-dynamic";
export const metadata = { title: "Aald Stories", description: "A living map of the islands — pin a place, tell its story, leave a photo or a voice note." };

export default async function MemoriesPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q } = await searchParams;
  const [pins, feed] = await Promise.all([getMemoryPins(500), q ? searchMemories(q) : getMemoryPins(24)]);
  const eras = [...new Set(pins.map((p) => p.era).filter(Boolean))].slice(0, 10) as string[];

  return (
    <>
      {/* Hero */}
      <section className="relative isolate overflow-hidden text-paper" style={{ background: MEMORIES }}>
        <Image src="/heroes/memories.jpg" alt="" fill priority className="object-cover opacity-30" />
        <div className="absolute inset-0" style={{ background: `linear-gradient(to top, ${MEMORIES}f2, ${MEMORIES}99 55%, ${MEMORIES}40)` }} />
        <div className="relative mx-auto max-w-6xl px-5 py-12 sm:py-16">
          <p className="text-xs font-bold uppercase tracking-widest text-paper/80">OneShetland</p>
          <h1 className="mt-2 font-display text-5xl font-bold sm:text-6xl">Aald Stories</h1>
          <p className="mt-3 max-w-xl text-lg text-paper/90">A living map of the islands — pin a place, tell its story, leave a photo or a voice note.</p>
          <Link href="/memories/new" className="mt-5 inline-block rounded-pill bg-white px-6 py-3 font-semibold shadow-soft transition hover:brightness-95" style={{ color: MEMORIES }}>+ Add a story</Link>
        </div>
      </section>

      <div className="mx-auto max-w-6xl px-5 py-10 sm:py-12 space-y-10">
        {/* Map */}
        <section>
          <h2 className="mb-3 font-display text-2xl font-bold text-ink">The map</h2>
          <MemoryMap mode="browse" pins={pins.map((p) => ({ id: p.id, lat: p.lat, lng: p.lng, title: p.title, hero_url: p.hero_url, hero_kind: p.hero_kind }))} height={460} />
          <p className="mt-2 text-sm text-ink-muted">{pins.length} stories pinned across Shetland. Tap a marker to read it.</p>
        </section>

        {/* Search + feed */}
        <section>
          <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
            <h2 className="font-display text-2xl font-bold text-ink">{q ? `Results for “${q}”` : "Latest from the islands"}</h2>
            <form action="/memories" method="get" className="flex gap-2">
              <input name="q" defaultValue={q ?? ""} placeholder="Search auld stories — names, places, eras…" className="rounded-pill border border-line bg-paper px-4 py-2 text-sm text-ink shadow-soft outline-none placeholder:text-ink-faint" />
              <button type="submit" className="rounded-pill px-4 py-2 text-sm font-semibold text-white" style={{ background: MEMORIES }}>Search</button>
            </form>
          </div>

          {!q && eras.length > 0 && (
            <div className="mb-5 flex flex-wrap gap-2">
              {eras.map((e) => (
                <Link key={e} href={`/memories?q=${encodeURIComponent(e)}`} className="rounded-pill border border-line-strong px-3 py-1 text-sm font-semibold text-ink-soft hover:bg-sand">{e}</Link>
              ))}
            </div>
          )}

          {feed.length === 0 ? (
            <div className="rounded-card border border-dashed border-line bg-paper/60 px-6 py-12 text-center">
              <p className="font-display text-lg font-bold text-ink">No stories yet</p>
              <p className="mt-1 text-sm text-ink-muted">Be the first to pin a story to the map.</p>
              <Link href="/memories/new" className="mt-4 inline-block rounded-pill px-5 py-2.5 text-sm font-semibold text-white" style={{ background: MEMORIES }}>Add a story</Link>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {feed.map((m) => <MemoryCard key={m.id} m={m} />)}
            </div>
          )}
        </section>
      </div>
    </>
  );
}

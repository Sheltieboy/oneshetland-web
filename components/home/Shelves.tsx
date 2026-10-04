import Link from "next/link";
import { SafeImage } from "@/components/ui/SafeImage";
import type { HomeSpik } from "@/lib/home-data";
import type { GamePrompt } from "@/lib/home-extras";
import type { HomeShelves } from "@/lib/home-shelves";

/**
 * The remaining homepage shelves. Each self-hides when it has nothing real to show.
 *
 *   IslandCards — Da Boats photo · Aald Memory · Spik wird · today's game (shown inside "Island life & community")
 *   HiringShelf — the one jobs module: open vacancies with employer logos
 *
 * (The Featured, Offers and Eat/drink/shop shelves that lived here were replaced by the curated modules in
 * HomeSections.tsx: one business shelf, and commerce only when something genuine exists.)
 */

const BOATS = "#1e3a8a";
const MEMORIES = "#9f1239";
const WORK = "#2a8b5c";

const TSHADOW = "[text-shadow:_0_1px_8px_rgb(0_0_0_/_50%)]";

function ShelfHeader({ eyebrow, title, href, cta, accent }: { eyebrow: string; title: string; href: string; cta: string; accent: string }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        <p className="eyebrow" style={{ color: accent }}>{eyebrow}</p>
        <h2 className="mt-1 font-display text-2xl font-bold text-ink sm:text-3xl">{title}</h2>
      </div>
      <Link href={href} className="rounded-pill border border-line px-4 py-1.5 text-sm font-bold text-ink-soft transition hover:bg-sand">
        {cta} →
      </Link>
    </div>
  );
}

function BizInitial({ name, className = "" }: { name: string; className?: string }) {
  return <span className={`grid h-full w-full place-items-center font-display text-lg font-bold text-ink-soft ${className}`}>{name.slice(0, 1)}</span>;
}

/* ── Island life — Da Boats · Aald Memories · Spik ────────────────────────── */

export function IslandCards({ shelves, spik, game }: { shelves: HomeShelves; spik: HomeSpik; game?: GamePrompt }) {
  const { boat, story } = shelves;
  const count = [boat, story, spik, game].filter(Boolean).length;
  if (count === 0) return null;
  return (
    <>
      <div className={"grid grid-cols-1 gap-4 sm:grid-cols-2 " + (count >= 4 ? "lg:grid-cols-4" : "lg:grid-cols-3")}>
        {boat && (
          <Link href={`/boats/${boat.vessel_id}`} className="group relative flex min-h-[170px] sm:min-h-[240px] overflow-hidden rounded-2xl border border-line shadow-soft transition hover:shadow-lift">
            <SafeImage src={boat.image_url} className="absolute inset-0 h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]" fallback={<span className="absolute inset-0" style={{ background: BOATS }} />} />
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
            <span className="absolute left-4 top-4 rounded-pill px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-white" style={{ background: BOATS }}>Da Boats</span>
            <div className="relative mt-auto p-5 text-paper">
              <p className={`font-display text-2xl font-bold ${TSHADOW}`}>{boat.name}</p>
              {boat.built_year && <p className={`text-sm text-white/85 ${TSHADOW}`}>built {boat.built_year}</p>}
            </div>
          </Link>
        )}
        {story && (
          <Link href="/memories" className="group relative flex min-h-[170px] sm:min-h-[240px] overflow-hidden rounded-2xl border border-line shadow-soft transition hover:shadow-lift">
            <SafeImage src={story.hero_url} className="absolute inset-0 h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]" fallback={<span className="absolute inset-0" style={{ background: MEMORIES }} />} />
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
            <span className="absolute left-4 top-4 rounded-pill px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-white" style={{ background: MEMORIES }}>Aald Memories</span>
            <div className="relative mt-auto p-5 text-paper">
              <p className={`line-clamp-2 font-display text-2xl font-bold ${TSHADOW}`}>{story.title || "A story fae da isles"}</p>
              <p className={`text-sm text-white/85 ${TSHADOW}`}>{[story.place_name, story.era].filter(Boolean).join(" · ")}</p>
            </div>
          </Link>
        )}
        {spik && (
          <Link href="/spik" className="group flex min-h-[170px] sm:min-h-[240px] flex-col justify-between rounded-2xl p-5 text-white shadow-soft transition hover:shadow-lift" style={{ background: "#0e9ab8" }}>
            <span className="self-start rounded-pill bg-white/20 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide">Spik · Wird o&apos; da day</span>
            <div>
              <p className="font-display text-4xl font-bold leading-none">{spik.word}</p>
              <p className="mt-2 line-clamp-2 text-white/90">{spik.meaning}</p>
              {spik.example && <p className="mt-2 line-clamp-2 border-l-2 border-white/40 pl-2 text-sm italic text-white/80">&ldquo;{spik.example}&rdquo;</p>}
            </div>
            <span className="text-sm font-bold">Explore the dialect →</span>
          </Link>
        )}
        {game && (
          <Link href={game.href} className="group flex min-h-[170px] sm:min-h-[240px] flex-col justify-between rounded-2xl p-5 text-white shadow-soft transition hover:shadow-lift" style={{ background: WORK }}>
            <span className="self-start rounded-pill bg-white/20 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide">Today&apos;s game</span>
            <div>
              <p className="font-display text-3xl font-bold leading-tight">{game.title}</p>
              <p className="mt-2 text-white/90">{game.sub}</p>
            </div>
            <span className="text-sm font-bold">Play →</span>
          </Link>
        )}
      </div>
    </>
  );
}

/* ── Hiring now
 ──────────────────────────────────────────────────────────── */

export function HiringShelf({ shelves }: { shelves: HomeShelves }) {
  if (shelves.hiring.length === 0) return null;
  return (
    <section className="mx-auto max-w-6xl px-5 pt-12">
      <ShelfHeader eyebrow="Jobs" title="Work in Shetland" href="/jobs" cta="All jobs" accent={WORK} />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {shelves.hiring.map((j) => (
          <Link key={j.id} href={`/jobs/${j.id}`} className="group rounded-2xl border border-line bg-white p-4 shadow-soft transition hover:shadow-lift">
            <div className="flex items-center gap-3">
              <span className="h-11 w-11 shrink-0 overflow-hidden rounded-xl border border-line bg-cream">
                {j.logo_url ? (
                  <SafeImage src={j.logo_url} className="h-full w-full object-contain p-1" fallback={<BizInitial name={j.employer || j.title} />} />
                ) : (
                  <BizInitial name={j.employer || j.title} />
                )}
              </span>
              {j.contract_type && (
                <span className="ml-auto rounded-pill px-2 py-0.5 text-[10px] font-bold uppercase text-white" style={{ background: WORK }}>
                  {j.contract_type.replace(/-/g, " ")}
                </span>
              )}
            </div>
            <p className="mt-3 line-clamp-2 font-semibold leading-snug text-ink">{j.title}</p>
            <p className="mt-1 line-clamp-1 text-sm text-ink-muted">{[j.employer, j.where].filter(Boolean).join(" · ")}</p>
            {j.pay_text && <p className="mt-1 text-sm font-bold" style={{ color: WORK }}>{j.pay_text}</p>}
          </Link>
        ))}
      </div>
    </section>
  );
}

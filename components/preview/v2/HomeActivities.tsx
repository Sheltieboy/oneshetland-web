import Link from "next/link";
import { SafeImage } from "@/components/ui/SafeImage";
import { HERO } from "@/components/activities/tokens";
import type { HomeActivityCard } from "@/lib/home-activities";

const FOCUS = "outline-none focus-visible:ring-4 focus-visible:ring-amber-400 focus-visible:ring-offset-2";
type Kind = "hero" | "medium" | "small" | "tile" | "rail" | "feature";

/** A quiet glyph per kind of activity, drawn large behind the text when there is no photograph. Decorative only. */
const GLYPH: Record<string, string> = { fitness: "🧘", kids_family: "🧒", social: "☕", arts_crafts: "🎨", sport: "⚽", wellbeing: "🌿", music: "🎵", learning: "📚", faith: "🕊️", other: "✨" };

/**
 * One homepage Regular Activities card, in the same shape language as the Events cards: image-led, rounded, bottom-weighted text on a dark
 * gradient. With no photograph the card is a rich category-coloured panel (never an empty image space and never an unrelated picture).
 * A photograph that fails to load disappears and leaves that same panel.
 */
function ActivityTile({ c, kind }: { c: HomeActivityCard; kind: Kind }) {
  const [c1, c2] = HERO[c.category] ?? HERO.other;
  const size: Record<Kind, string> = {
    hero: "min-h-[340px] shadow-lift lg:col-span-7 lg:row-span-2 lg:min-h-[560px]",
    medium: "hidden min-h-[170px] shadow-soft lg:col-span-5 lg:flex",
    small: "min-h-[180px] shadow-soft hover:-translate-y-0.5 hover:shadow-lift",
    tile: "min-h-[220px] shadow-soft hover:-translate-y-0.5 hover:shadow-lift lg:min-h-[240px]",
    rail: "min-h-[210px] shadow-soft",
    feature: "w-full min-h-[280px] shadow-soft hover:-translate-y-0.5 hover:shadow-lift sm:min-h-[320px]",
  };
  const big = kind === "hero" || kind === "feature";
  const src = kind === "hero" ? c.photo : c.thumb ?? c.photo;
  return (
    <Link href={c.href} className={`group relative isolate flex overflow-hidden rounded-3xl transition ${FOCUS} ${size[kind]}`}>
      <div aria-hidden className="absolute inset-0 -z-10" style={{ background: `linear-gradient(150deg, ${c1}, ${c2})` }}>
        <span className={"absolute select-none opacity-25 " + (big ? "-right-2 -top-3 text-[9rem] sm:text-[11rem]" : "-right-1 -top-2 text-[6rem]")} style={{ lineHeight: 1 }}>{GLYPH[c.category] ?? GLYPH.other}</span>
      </div>
      {src && (
        <div aria-hidden className="absolute inset-0 -z-10 overflow-hidden">
          <SafeImage src={src} className="absolute inset-0 h-full w-full object-cover transition duration-700 group-hover:scale-[1.04]" />
        </div>
      )}
      <div aria-hidden className={"absolute inset-0 -z-10 " + (kind === "medium" ? "bg-gradient-to-r from-black/80 via-black/40 to-transparent" : big ? "bg-gradient-to-t from-black/85 via-black/30 to-black/10" : "bg-gradient-to-t from-black/85 via-black/35 to-black/5")} />
      <div className={"mt-auto w-full min-w-0 text-white " + (big ? "p-6 sm:p-9" : "p-4 sm:p-5")}>
        <span className={"inline-flex items-center rounded-pill bg-white/95 font-black uppercase tracking-wide text-teal-800 " + (big ? "px-3.5 py-1.5 text-xs" : "px-2.5 py-1 text-[10px]")}>{c.categoryLabel}</span>
        <h3 className={"mt-2 font-display font-bold leading-[1.05] [text-shadow:_0_2px_18px_rgb(0_0_0_/_55%)] " + (kind === "hero" ? "max-w-2xl text-4xl sm:text-6xl" : kind === "feature" ? "text-3xl sm:text-4xl" : kind === "medium" ? "line-clamp-2 max-w-xs text-2xl" : "line-clamp-2 text-xl")}>{c.title}</h3>
        <p className={"mt-1 truncate font-semibold text-white/90 " + (big ? "text-base sm:text-lg" : "text-sm")}>{c.organiser}</p>
        {c.days && <p className={"mt-1 text-white/85 " + (big ? "text-sm sm:text-base" : "line-clamp-1 text-xs sm:text-sm")}>{c.days}</p>}
        <p className={"mt-1 font-bold text-amber-200 " + (big ? "text-sm sm:text-base" : "text-xs sm:text-sm")}>{c.next}{c.place ? <span className="font-medium text-white/80"> · {c.place}</span> : null}</p>
      </div>
    </Link>
  );
}

const COLS: Record<number, string> = { 1: "lg:grid-cols-1", 2: "lg:grid-cols-2", 3: "lg:grid-cols-3" };

/** The Regular Activities mosaic. Four or more activities use the Events mosaic's arrangement; one to three use a simple row of large cards so there are no gaps. */
export function ActivitiesMosaic({ cards }: { cards: HomeActivityCard[] }) {
  if (cards.length === 0) return null;
  if (cards.length < 4) {
    return (
      <ul aria-label="Regular activities" className={`grid grid-cols-1 gap-4 sm:grid-cols-2 ${COLS[cards.length] ?? "lg:grid-cols-3"}`}>
        {cards.map((c) => <li key={c.id} className="flex"><ActivityTile c={c} kind="feature" /></li>)}
      </ul>
    );
  }
  const [c0, c1, c2, c3, ...tiles] = cards;
  return (
    <>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12 lg:grid-rows-[repeat(2,minmax(0,1fr))]">
        <ActivityTile c={c0} kind="hero" />
        <div className="lg:hidden">
          <ul aria-label="More regular activities" className="-mx-5 flex snap-x snap-mandatory scroll-px-5 gap-3 overflow-x-auto px-5 pb-3 pt-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {cards.slice(1).map((c) => <li key={c.id} className="flex w-[72vw] max-w-[300px] shrink-0 snap-start flex-col"><ActivityTile c={c} kind="rail" /></li>)}
          </ul>
        </div>
        <ActivityTile c={c1} kind="medium" />
        <div className="hidden gap-4 lg:col-span-5 lg:grid lg:grid-cols-2">
          <ActivityTile c={c2} kind="small" />
          <ActivityTile c={c3} kind="small" />
        </div>
      </div>
      {tiles.length > 0 && (
        <div className={`mt-4 hidden gap-4 lg:grid ${COLS[tiles.length] ?? "lg:grid-cols-3"}`}>
          {tiles.map((c) => <ActivityTile key={c.id} c={c} kind="tile" />)}
        </div>
      )}
    </>
  );
}

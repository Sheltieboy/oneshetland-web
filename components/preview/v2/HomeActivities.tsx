import Link from "next/link";
import { SafeImage } from "@/components/ui/SafeImage";
import { HERO } from "@/components/activities/tokens";
import type { HomeActivityCard } from "@/lib/home-activities";

const FOCUS = "outline-none focus-visible:ring-4 focus-visible:ring-amber-400 focus-visible:ring-offset-2";
const TEAL = "#0f766e";
const NAVY = "#032f4c";
type Kind = "hero" | "wide" | "tall" | "medium" | "small" | "tile" | "rail";

/**
 * One homepage Regular Activities tile. It deliberately shares the Events tiles' shape language: same corner radius, shadows, hover lift, dark
 * bottom-weighted overlay, white category pill, Fraunces title and text scale. With the activity's own photograph the tile is image-led. Without
 * one it is a restrained OneShetland panel (the brand ring mark over a deep navy, tinted by the kind of activity): no emoji, no stock picture,
 * no invented imagery. A photograph that fails to load disappears and leaves that same panel.
 */
function ActivityTile({ c, kind }: { c: HomeActivityCard; kind: Kind }) {
  const [tint] = HERO[c.category] ?? HERO.other;
  const size: Record<Kind, string> = {
    hero: "min-h-[340px] shadow-lift lg:col-span-7 lg:row-span-2 lg:min-h-[560px]",
    wide: "min-h-[340px] shadow-lift lg:col-span-12 lg:min-h-[440px]",
    tall: "hidden min-h-[340px] shadow-lift lg:col-span-5 lg:flex lg:min-h-[460px]",
    medium: "hidden min-h-[170px] shadow-soft lg:col-span-5 lg:flex",
    small: "min-h-[180px] shadow-soft hover:-translate-y-0.5 hover:shadow-lift",
    tile: "min-h-[220px] shadow-soft hover:-translate-y-0.5 hover:shadow-lift lg:min-h-[240px]",
    rail: "min-h-[200px] shadow-soft",
  };
  const big = kind === "hero" || kind === "wide" || kind === "tall";
  const src = big ? c.photo : c.thumb ?? c.photo;
  const grad = kind === "medium" ? "bg-gradient-to-r from-black/80 via-black/40 to-transparent" : big ? "bg-gradient-to-t from-black/85 via-black/30 to-black/10" : "bg-gradient-to-t from-black/85 via-black/35 to-black/5";
  return (
    <Link href={c.href} className={`group relative isolate flex overflow-hidden rounded-3xl transition ${FOCUS} ${size[kind]}`}>
      <div aria-hidden className="absolute inset-0 -z-10 overflow-hidden" style={{ background: `linear-gradient(155deg, ${tint} 0%, ${NAVY} 78%)` }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/brand/mark-white.png" alt="" loading="lazy" decoding="async" className={"absolute max-w-none select-none opacity-[.13] " + (big ? "-right-24 -top-24 h-[26rem] w-[26rem] sm:-right-28 sm:-top-28 sm:h-[34rem] sm:w-[34rem]" : "-right-14 -top-14 h-64 w-64")} />
      </div>
      {src && (
        <div aria-hidden className="absolute inset-0 -z-10 overflow-hidden">
          <SafeImage src={src} className="absolute inset-0 h-full w-full object-cover transition duration-700 group-hover:scale-[1.04]" />
        </div>
      )}
      <div aria-hidden className={`absolute inset-0 -z-10 ${grad}`} />
      {big ? (
        <div className="mt-auto w-full p-6 text-white sm:p-9">
          <span className="inline-flex items-center rounded-pill bg-white px-3.5 py-1.5 text-xs font-black uppercase tracking-wide" style={{ color: TEAL }}>{c.categoryLabel}</span>
          <h3 className={"mt-4 max-w-2xl font-display font-bold leading-[1.02] [text-shadow:_0_2px_18px_rgb(0_0_0_/_55%)] " + (kind === "tall" ? "text-3xl sm:text-4xl" : "text-4xl sm:text-6xl")}>{c.title}</h3>
          {c.organiser && <p className="mt-3 text-base font-semibold text-white/95 sm:text-lg">{c.organiser}</p>}
          {c.days && <p className="mt-1 text-sm text-white/85 sm:text-base">{c.days}</p>}
          <p className="mt-2 text-sm font-bold text-amber-200 sm:text-base">{c.next}{c.place ? <span className="font-medium text-white/85"> · {c.place}</span> : null}</p>
        </div>
      ) : (
        <div className="mt-auto w-full min-w-0 p-4 text-white sm:p-5">
          <span className="text-xs font-black uppercase tracking-wider text-amber-300">{c.categoryLabel}</span>
          <p className={"mt-1 line-clamp-2 font-display font-bold leading-tight [text-shadow:_0_1px_10px_rgb(0_0_0_/_55%)] " + (kind === "medium" ? "max-w-xs text-2xl" : kind === "tile" ? "text-xl" : "text-lg")}>{c.title}</p>
          {c.organiser && <p className="mt-1 truncate text-sm text-white/90">{c.organiser}</p>}
          {(kind === "medium" || kind === "tile") && c.days && <p className="truncate text-sm text-white/80">{c.days}</p>}
          <p className="mt-0.5 truncate text-sm font-semibold text-amber-200">{c.next}{(kind === "medium" || kind === "tile") && c.place ? <span className="font-normal text-white/80"> · {c.place}</span> : null}</p>
        </div>
      )}
    </Link>
  );
}

const TILE_COLS: Record<number, string> = { 1: "lg:grid-cols-1", 2: "lg:grid-cols-2", 3: "lg:grid-cols-3" };

/**
 * The Regular Activities mosaic: the Events mosaic's composition at every size. 1: one wide feature. 2: a large tile beside a tall one. 3: a large
 * tile beside two stacked. 4: the Events arrangement (large, medium, two small). 5 to 7: that, plus a row of tiles. On phones: the large tile, then
 * one swipeable rail of the rest. Never repeats an activity to fill space.
 */
export function ActivitiesMosaic({ cards }: { cards: HomeActivityCard[] }) {
  const n = cards.length;
  if (n === 0) return null;
  const [c0, c1, c2, c3, ...tiles] = cards;
  const rows = n >= 3 ? "lg:grid-rows-[repeat(2,minmax(0,1fr))]" : "";
  return (
    <>
      <div className={`grid grid-cols-1 gap-4 lg:grid-cols-12 ${rows}`}>
        <ActivityTile c={c0} kind={n === 1 ? "wide" : "hero"} />
        {n > 1 && (
          <div className="lg:hidden">
            <ul aria-label="More regular activities" className="-mx-5 flex snap-x snap-mandatory scroll-px-5 gap-3 overflow-x-auto px-5 pb-3 pt-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {cards.slice(1).map((c) => <li key={c.id} className="flex w-[72vw] max-w-[300px] shrink-0 snap-start flex-col"><ActivityTile c={c} kind="rail" /></li>)}
            </ul>
          </div>
        )}
        {n === 2 && <ActivityTile c={c1} kind="tall" />}
        {n === 3 && (<><ActivityTile c={c1} kind="medium" /><ActivityTile c={c2} kind="medium" /></>)}
        {n >= 4 && (
          <>
            <ActivityTile c={c1} kind="medium" />
            <div className="hidden gap-4 lg:col-span-5 lg:grid lg:grid-cols-2">
              <ActivityTile c={c2} kind="small" />
              <ActivityTile c={c3} kind="small" />
            </div>
          </>
        )}
      </div>
      {tiles.length > 0 && (
        <div className={`mt-4 hidden gap-4 lg:grid ${TILE_COLS[tiles.length] ?? "lg:grid-cols-3"}`}>
          {tiles.map((c) => <ActivityTile key={c.id} c={c} kind="tile" />)}
        </div>
      )}
    </>
  );
}

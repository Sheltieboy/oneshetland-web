import Link from "next/link";
import { KIND_META, publishedLabel, type NewItem, type NewPlan } from "@/lib/home-new-this-week";
import { Reveal } from "@/components/home/Reveal";

/**
 * New in Shetland this week. Its own grammar, so it never reads as a second copy of What's happening:
 *   • What's happening is cinematic: dark photographs with the title on the image and a date badge.
 *   • This is paper: a photograph on top, the words below on a light card, a category colour tag on the photo, a colour foot bar, and the
 *     real publication day ("Published today", "Listed Sat") in that category's colour.
 * One featured card and up to three supporting cards (the third from large screens only, so phones stay short). Freshness, expiry,
 * paid-shelf exclusion and the quiet-week behaviour come from lib/home-new-this-week.ts; nothing here reads subscription tier.
 */
const FOCUS = "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-navy";

function Card({ item, now, size }: { item: NewItem; now: number; size: "feature" | "tile" | "wide" | "solo" }) {
  const m = KIND_META[item.kind];
  const horizontal = size === "wide" || size === "solo";
  const photo = size === "feature" ? "aspect-[2/1] sm:aspect-[16/9] lg:aspect-auto lg:min-h-[250px] lg:flex-1" : size === "tile" ? "aspect-[16/10]" : "aspect-[16/9] sm:aspect-auto sm:w-[46%] sm:shrink-0";
  const title = size === "feature" || size === "solo" ? "text-[1.45rem] leading-[1.08] sm:text-3xl" : size === "wide" ? "text-2xl leading-tight" : "text-[1.02rem] leading-snug sm:text-lg";
  return (
    <Link href={item.href} className={`group flex h-full overflow-hidden rounded-3xl bg-paper shadow-soft ring-1 ring-black/5 transition duration-300 hover:-translate-y-0.5 hover:shadow-lift active:translate-y-0 active:scale-[.99] ${horizontal ? "flex-col sm:flex-row" : "flex-col"} ${FOCUS}`}>
      <span className={`relative block overflow-hidden ${photo}`} style={{ background: `linear-gradient(150deg, ${m.color}, #1f2937)` }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {item.image && <img src={item.image} alt="" loading="lazy" decoding="async" className="absolute inset-0 h-full w-full object-cover transition duration-700 ease-out group-hover:scale-[1.04]" />}
        <span className="absolute left-3 top-3 rounded-pill px-2.5 py-1 text-[11px] font-black uppercase tracking-wide text-white shadow-soft" style={{ background: m.color }}>{m.label}</span>
      </span>
      <span className="flex min-w-0 flex-1 flex-col justify-center p-3.5 sm:p-5">
        <span className="text-[11px] font-black uppercase tracking-wider" style={{ color: m.ink }}>{m.verb} {publishedLabel(item.publishedAt!, now)}</span>
        <span className={`mt-1 line-clamp-3 font-display font-bold text-ink ${title}`}>{item.title}</span>
        <span className="mt-1 line-clamp-1 text-[13px] text-ink-soft sm:text-sm">{item.meta}</span>
      </span>
    </Link>
  );
}

export function NewThisWeek({ plan, now }: { plan: NewPlan; now: number }) {
  if (!plan) return null;
  const { featured, supporting } = plan;
  const n = supporting.length;
  const [s1, s2, s3] = supporting;
  const featSpan = n === 0 ? "col-span-2 lg:col-span-12" : n === 1 ? "col-span-2 lg:col-span-7" : "col-span-2 lg:col-span-6 lg:row-span-2";
  return (
    <section aria-labelledby="new-h" className="relative bg-[#f3ece0]">
      <div className="mx-auto max-w-6xl px-5 pb-6 pt-9 sm:pb-12 sm:pt-16">
        <Reveal className="mb-5 sm:mb-8">
          <p className="eyebrow" style={{ color: "#0e9ab8" }}>Fresh this week</p>
          <h2 id="new-h" className="mt-1.5 font-display text-3xl font-bold leading-[1.05] text-ink sm:text-5xl">New in Shetland this week</h2>
        </Reveal>
        <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-12">
          <Reveal className={featSpan}><Card item={featured} now={now} size={n === 0 ? "solo" : "feature"} /></Reveal>
          {s1 && <Reveal delay={90} className={n === 1 ? "col-span-2 lg:col-span-5" : "lg:col-span-3"}><Card item={s1} now={now} size="tile" /></Reveal>}
          {s2 && <Reveal delay={170} className="lg:col-span-3"><Card item={s2} now={now} size="tile" /></Reveal>}
          {s3 && <Reveal delay={250} className="col-span-2 hidden lg:col-span-6 lg:block"><Card item={s3} now={now} size="wide" /></Reveal>}
        </div>
        {n < 2 && <p className="mt-4 text-sm text-ink-soft">A quieter week. New events, jobs, businesses and offers appear here as soon as they are published.</p>}
      </div>
      {/* Settle into the cream page instead of cutting to it. */}
      <div aria-hidden className="pointer-events-none h-8 bg-gradient-to-b from-[#f3ece0] to-[#fbf8f2] sm:h-12" />
    </section>
  );
}

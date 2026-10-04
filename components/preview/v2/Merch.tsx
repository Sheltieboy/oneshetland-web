"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { PILLARS, cropStyle, density, type Merch, type Pillar } from "@/lib/preview-v2";

/**
 * The commerce building blocks shared by the Home V2 and Local V2 previews.
 *
 *   MerchCard      one item, shaped for its pillar (product · offer ticket · service slot · experience)
 *   PillarSection  one pillar at ANY inventory level: none → proposition panel, 1–3 → featured, 4–12 → rail,
 *                  20+ → rail with categories and a see-all. The page never has to be restructured as it fills up.
 *   Rail           horizontal discovery strip
 *
 * Test / acceptance items (tag) are always marked: a hazard-stripe ribbon and a dashed amber outline.
 */

export function CropImg({ src, crop, className = "", alt = "", fallback }: { src: string; crop?: Merch["crop"]; className?: string; alt?: string; fallback?: string }) {
  return (
    <div className={`overflow-hidden ${/\babsolute\b/.test(className) ? "" : "relative"} ${className}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt={alt} loading="lazy" onError={(e) => { if (fallback && !e.currentTarget.src.endsWith(fallback)) e.currentTarget.src = fallback; }} className="absolute inset-0 h-full w-full object-cover transition duration-700 group-hover:scale-[1.04]" style={cropStyle(crop)} />
    </div>
  );
}

export function TestRibbon({ tag }: { tag: NonNullable<Merch["tag"]> }) {
  return (
    <span
      className="absolute left-0 top-3 z-10 flex items-center gap-1.5 rounded-r-md px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-black shadow"
      style={{ background: "repeating-linear-gradient(135deg,#facc15 0 8px,#fde68a 8px 16px)" }}
    >
      {tag} · QA only
    </span>
  );
}

const qaRing = (m: Merch) => (m.tag ? "outline outline-2 outline-dashed outline-amber-400 outline-offset-2" : "");

/* ── One item ─────────────────────────────────────────────────────────────── */

export function MerchCard({ m, fill = false, dark = false }: { m: Merch; fill?: boolean; dark?: boolean }) {
  const p = PILLARS[m.pillar];
  const w = (rail: string) => (fill ? "w-full" : `${rail} shrink-0 snap-start`);

  if (m.pillar === "shop") {
    return (
      <Link href={m.href} className={`group relative block ${w("w-44 sm:w-52")} rounded-2xl ${qaRing(m)}`}>
        <div className="relative aspect-[4/5] overflow-hidden rounded-2xl bg-sand shadow-soft">
          {m.image ? <CropImg src={m.image} crop={m.crop} className="absolute inset-0" /> : <Placeholder color={p.color} label={m.title} />}
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/45 to-transparent" />
          {m.tag && <TestRibbon tag={m.tag} />}
          {m.price && <span className="absolute bottom-3 left-3 rounded-pill bg-white px-3 py-1 text-sm font-black text-ink shadow">{m.price}</span>}
        </div>
        <p className={"mt-2.5 line-clamp-2 font-display text-[1.05rem] font-bold leading-snug " + (dark ? "text-white" : "text-ink")}>{m.title}</p>
        <p className={"mt-0.5 line-clamp-1 text-xs font-medium " + (dark ? "text-white/70" : "text-ink-muted")}>{m.business}</p>
      </Link>
    );
  }

  if (m.pillar === "offers") {
    return (
      <Link
        href={m.href}
        className={`group relative flex ${w("w-64")} flex-col justify-between overflow-hidden rounded-2xl p-5 text-white shadow-soft transition hover:-translate-y-0.5 hover:shadow-lift ${qaRing(m)}`}
        style={{ background: `linear-gradient(145deg, ${p.color}, ${p.deep})`, minHeight: 190 }}
      >
        {/* ticket notches */}
        <span className="absolute -left-2.5 top-1/2 h-5 w-5 -translate-y-1/2 rounded-full bg-[var(--ticket-bg,#fbf8f2)]" />
        <span className="absolute -right-2.5 top-1/2 h-5 w-5 -translate-y-1/2 rounded-full bg-[var(--ticket-bg,#fbf8f2)]" />
        {m.tag && <TestRibbon tag={m.tag} />}
        <span className="font-display text-4xl font-black leading-none tracking-tight [text-shadow:_0_2px_12px_rgb(0_0_0_/_25%)]">{m.badge ?? "Offer"}</span>
        <span>
          <span className="block line-clamp-2 text-base font-semibold leading-snug">{m.title}</span>
          <span className="mt-1 block text-xs font-medium text-white/80">{m.business}{m.meta ? ` · ${m.meta}` : ""}</span>
        </span>
      </Link>
    );
  }

  if (m.pillar === "book") {
    const mins = m.meta?.match(/\d+/)?.[0];
    return (
      <Link href={m.href} className={`group relative flex ${w("w-60")} flex-col overflow-hidden rounded-2xl border border-line bg-white shadow-soft transition hover:-translate-y-0.5 hover:shadow-lift ${qaRing(m)}`}>
        <div className="relative flex items-end justify-between px-4 pb-3 pt-9 text-white" style={{ background: `linear-gradient(135deg, ${p.color}, ${p.deep})` }}>
          {m.tag && <TestRibbon tag={m.tag} />}
          <span className="font-display text-5xl font-black leading-none">{mins ?? "·"}<span className="ml-1 text-base font-bold opacity-80">min</span></span>
          {m.badge && <span className="rounded-pill bg-white/20 px-2.5 py-1 text-[11px] font-bold backdrop-blur-sm">{m.badge}</span>}
        </div>
        <div className="flex flex-1 flex-col p-4">
          <p className="line-clamp-2 font-display text-lg font-bold leading-snug text-ink">{m.title}</p>
          <p className="mt-0.5 line-clamp-1 text-xs font-medium text-ink-muted">{m.business}</p>
          <div className="mt-auto flex items-center justify-between pt-3">
            <span className="text-sm font-black text-ink">{m.price}</span>
            <span className="rounded-pill px-3.5 py-1.5 text-xs font-bold text-white" style={{ background: p.color }}>Book</span>
          </div>
        </div>
      </Link>
    );
  }

  // experiences
  return (
    <Link href={m.href} className={`group relative block ${w("w-72 sm:w-80")} overflow-hidden rounded-2xl shadow-soft ${qaRing(m)}`}>
      <div className="relative aspect-[16/11]">
        {m.image ? <CropImg src={m.image} crop={m.crop} className="absolute inset-0" /> : <Placeholder color={p.color} label={m.title} />}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
        {m.tag && <TestRibbon tag={m.tag} />}
        {m.price && <span className="absolute right-3 top-3 rounded-pill bg-white px-3 py-1 text-sm font-black text-ink shadow">{m.price}</span>}
        <div className="absolute inset-x-0 bottom-0 p-4 text-white">
          <p className="line-clamp-2 font-display text-xl font-bold leading-tight [text-shadow:_0_1px_8px_rgb(0_0_0_/_55%)]">{m.title}</p>
          <p className="mt-1 line-clamp-1 text-xs font-medium text-white/85">{m.business}{m.meta ? ` · ${m.meta}` : ""}</p>
        </div>
      </div>
    </Link>
  );
}

function Placeholder({ color, label }: { color: string; label: string }) {
  return (
    <span className="absolute inset-0 grid place-items-center p-4 text-center font-display text-lg font-bold text-white" style={{ background: `linear-gradient(135deg, ${color}, #1e1b4b)` }}>
      {label}
    </span>
  );
}

/* ── Rail ─────────────────────────────────────────────────────────────────── */

export function Rail({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`-mx-5 flex snap-x gap-3.5 overflow-x-auto px-5 pb-3 [scrollbar-width:none] sm:gap-4 [&::-webkit-scrollbar]:hidden ${className}`}>{children}</div>;
}

/* ── A pillar at any inventory level ──────────────────────────────────────── */

export function PillarEmpty({ pillar, dark = false }: { pillar: Pillar; dark?: boolean }) {
  const p = PILLARS[pillar];
  return (
    <div className="group relative isolate overflow-hidden rounded-3xl">
      <CropImg src={p.image} crop={p.crop} className="absolute inset-0 -z-10" />
      <div className="absolute inset-0 -z-10" style={{ background: `linear-gradient(100deg, ${p.deep}f2 25%, ${p.deep}b3 60%, ${p.color}59)` }} />
      <div className="px-6 py-9 text-white sm:px-10 sm:py-12">
        <span className="inline-block rounded-pill bg-white/15 px-3 py-1 text-[11px] font-bold uppercase tracking-widest backdrop-blur-sm">Opening soon</span>
        <h3 className="mt-3 max-w-xl font-display text-3xl font-bold leading-tight sm:text-4xl">{p.emptyTitle}</h3>
        <p className="mt-2 max-w-lg text-base text-white/85 sm:text-lg">{p.emptyBody}</p>
        <Link href={p.cta.href} className={"mt-5 inline-block rounded-pill px-5 py-2.5 text-sm font-bold shadow-soft transition hover:brightness-95 " + (dark ? "bg-white text-ink" : "bg-white text-ink")}>
          {p.cta.label} →
        </Link>
      </div>
    </div>
  );
}

/** Feature tile used when a pillar has 1–3 items: the first is big, the rest sit beside it. */
function FeatureTile({ m }: { m: Merch }) {
  const p = PILLARS[m.pillar];
  return (
    <Link href={m.href} className={`group relative flex min-h-[270px] flex-1 overflow-hidden rounded-3xl shadow-soft transition hover:shadow-lift lg:min-h-[380px] ${qaRing(m)}`} style={{ background: `linear-gradient(135deg, ${p.color}, ${p.deep})` }}>
      {m.image && <CropImg src={m.image} crop={m.crop} className="absolute inset-0" />}
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/25 to-black/5" />
      {m.tag && <TestRibbon tag={m.tag} />}
      {!m.image && (m.pillar === "book" ? m.meta : m.badge) && <span className="absolute right-6 top-5 font-display text-6xl font-black text-white/95 sm:text-7xl">{m.pillar === "book" ? m.meta : m.badge}</span>}
      <div className="relative mt-auto w-full p-6 text-white sm:p-8">
        <span className="rounded-pill bg-white/20 px-3 py-1 text-[11px] font-bold uppercase tracking-widest backdrop-blur-sm">{p.label}</span>
        <p className="mt-3 max-w-md font-display text-3xl font-bold leading-tight [text-shadow:_0_2px_14px_rgb(0_0_0_/_50%)] sm:text-4xl">{m.title}</p>
        <p className="mt-1.5 text-sm font-medium text-white/85">{m.business}{m.meta ? ` · ${m.meta}` : ""}</p>
        {m.price && <span className="mt-3 inline-block rounded-pill bg-white px-4 py-1.5 text-sm font-black text-ink">{m.price}</span>}
      </div>
    </Link>
  );
}

export function PillarSection({ pillar, items, id, tone = "light" }: { pillar: Pillar; items: Merch[]; id?: string; tone?: "light" | "dark" }) {
  const p = PILLARS[pillar];
  const d = density(items.length);
  const dark = tone === "dark";
  return (
    <section id={id} className="scroll-mt-24">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="eyebrow" style={{ color: dark ? "#fff" : p.color, opacity: dark ? 0.8 : 1 }}>{p.short}</p>
          <h2 className={`mt-1 font-display text-3xl font-bold sm:text-4xl ${dark ? "text-white" : "text-ink"}`}>{pillar === "shop" ? "Shop from Shetland" : pillar === "offers" ? "Offers" : pillar === "book" ? "Book local" : "Experiences & passes"}</h2>
        </div>
        {d !== "none" && (
          <Link href={p.seeAll} className={"rounded-pill border px-4 py-1.5 text-sm font-bold transition " + (dark ? "border-white/40 text-white hover:bg-white/10" : "border-line-strong text-ink-soft hover:bg-sand")}>
            {d === "many" ? `See all ${items.length}` : "See all"} →
          </Link>
        )}
      </div>

      {d === "none" && <PillarEmpty pillar={pillar} dark={dark} />}

      {d === "few" && (
        <div className={"grid grid-cols-1 gap-4 " + (items.length > 1 ? "lg:grid-cols-3" : "")}>
          <div className={"flex " + (items.length > 1 ? "lg:col-span-2" : "")}><FeatureTile m={items[0]} /></div>
          {items.length > 1 && (
            <>
              {/* phone and tablet: a swipe rail under the feature (keeps the section to one screen) */}
              <Rail className="lg:hidden">{items.slice(1).map((m) => <MerchCard key={m.id} m={m} dark={dark} />)}</Rail>
              <div className="hidden grid-cols-1 gap-4 lg:grid">
                {items.slice(1).map((m) => <MerchCard key={m.id} m={m} fill />)}
              </div>
            </>
          )}
        </div>
      )}

      {(d === "rail" || d === "many") && (
        <>
          {d === "many" && (
            <div className="mb-4 flex flex-wrap gap-2">
              <span className="rounded-pill px-3.5 py-1.5 text-xs font-bold text-white" style={{ background: p.color }}>All {items.length}</span>
              {p.cats.map((c) => (
                <span key={c} className={"rounded-pill border px-3.5 py-1.5 text-xs font-semibold " + (dark ? "border-white/30 text-white/90" : "border-line-strong text-ink-soft")}>{c}</span>
              ))}
            </div>
          )}
          <Rail>
            {items.slice(0, 12).map((m) => <MerchCard key={m.id} m={m} dark={dark} />)}
            {d === "many" && (
              <Link href={p.seeAll} className="flex w-44 shrink-0 snap-start flex-col items-center justify-center rounded-2xl border-2 border-dashed p-5 text-center text-sm font-bold sm:w-52" style={{ borderColor: dark ? "#ffffff66" : p.color + "88", color: dark ? "#fff" : p.color }}>
                See all {items.length}
                <span className="mt-1 text-2xl">→</span>
              </Link>
            )}
          </Rail>
        </>
      )}
    </section>
  );
}

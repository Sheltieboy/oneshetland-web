import Link from "next/link";
import type { ReactNode } from "react";
import { SHETLAND_AREAS, CATEGORY_LABEL } from "@/lib/local-data";
import type { CuratedBusiness } from "@/lib/curated-businesses";
import { PILLARS, PILLAR_ORDER, density, type Merch, type Pillar } from "@/lib/preview-v2";
import { CropImg, MerchCard, PillarSection, Rail } from "@/components/preview/v2/Merch";
import { Band, Heading } from "@/components/preview/v2/HomeV2";

/**
 * Local V2 — Shetland's local economy. Six permanent pillars (Shop · Offers · Book · Experiences · Businesses ·
 * Rewards) that stay part of the page at every inventory level: low stock changes the treatment (a proposition panel,
 * a feature, a rail, a merchandised rail with categories), never whether the proposition exists.
 */

const LOCAL = "#7c3aed";

/* ── Hero ─────────────────────────────────────────────────────────────────── */

export function LocalHero({ areaKey, base }: { areaKey?: string; base: string }) {
  const areaLabel = SHETLAND_AREAS.find((a) => a.key === areaKey)?.label;
  const chip = (on: boolean) => "shrink-0 rounded-full px-4 py-2 text-sm font-semibold backdrop-blur-sm transition " + (on ? "bg-white text-violet-800 shadow" : "bg-white/15 text-white hover:bg-white/25");
  return (
    <section className="relative isolate overflow-hidden text-white">
      <CropImg src="/preview-v2/local-street.jpg" crop={{ cx: 0.5, cy: 0.45, z: 1.05 }} className="absolute inset-0 -z-10" />
      <div className="absolute inset-0 -z-10" style={{ background: "linear-gradient(115deg, rgba(46,16,101,.93) 8%, rgba(76,29,149,.78) 45%, rgba(124,58,237,.35))" }} />
      <div className="mx-auto max-w-6xl px-5 pb-10 pt-12 sm:pb-16 sm:pt-20">
        <p className="eyebrow text-violet-200">OneShetland · Local</p>
        <h1 className="mt-3 max-w-3xl font-display text-[2.7rem] font-bold leading-[0.98] [text-shadow:_0_2px_22px_rgb(0_0_0_/_35%)] sm:text-6xl lg:text-7xl">
          {areaLabel ? <>Local in<br />{areaLabel}.</> : <>Shop local.<br />Save local.<br /><span className="text-amber-200">Book local.</span></>}
        </h1>
        <p className="mt-4 max-w-xl text-base leading-relaxed text-white/90 sm:text-xl">
          Shetland&apos;s local economy — discover, shop, save, book and experience the islands&apos; own businesses.
        </p>
        <form action="/directory" method="get" role="search" className="mt-6 flex max-w-lg overflow-hidden rounded-pill bg-white shadow-lift">
          <label htmlFor="local-search" className="sr-only">Search local businesses</label>
          <input id="local-search" name="q" type="search" placeholder="Search shops, cafés, services…" className="min-w-0 flex-1 bg-transparent px-5 py-3 text-sm text-ink placeholder:text-ink-faint focus:outline-none" />
          <button type="submit" className="px-5 text-sm font-bold text-violet-800 hover:bg-violet-50">Search</button>
        </form>
        <div className="-mx-5 mt-5 flex gap-2 overflow-x-auto px-5 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <Link href={base} className={chip(!areaKey)}>All Shetland</Link>
          {SHETLAND_AREAS.map((a) => <Link key={a.key} href={`${base}&area=${encodeURIComponent(a.key)}`} className={chip(areaKey === a.key)}>{a.label}</Link>)}
        </div>
      </div>
    </section>
  );
}

/* ── Six pillars ──────────────────────────────────────────────────────────── */

type Tile = { key: string; label: string; line: string; chip: string; href: string; image?: string; crop?: Merch["crop"]; from: string; to: string; span: string; rewards?: boolean };

export function SixPillars({ commerce, businessCount }: { commerce: Record<Pillar, Merch[]>; businessCount: number }) {
  const state = (p: Pillar) => {
    const n = commerce[p].length;
    return n === 0 ? "Opening soon" : `${n} ${n === 1 ? "item" : "items"}`;
  };
  const tiles: Tile[] = [
    { key: "shop", label: "Shop", line: PILLARS.shop.short, chip: state("shop"), href: "#shop", image: PILLARS.shop.image, crop: { cx: 0.35, cy: 0.45, z: 1.15 }, from: "#7c3aed", to: "#3b0764", span: "col-span-2 row-span-2 lg:col-span-2 lg:row-span-2" },
    { key: "offers", label: "Offers", line: PILLARS.offers.short, chip: state("offers"), href: "#offers", image: PILLARS.offers.image, crop: PILLARS.offers.crop, from: "#d97706", to: "#78350f", span: "" },
    { key: "book", label: "Book", line: PILLARS.book.short, chip: state("book"), href: "#book", image: PILLARS.book.image, crop: { cx: 0.5, cy: 0.4, z: 1.1 }, from: "#059669", to: "#064e3b", span: "" },
    { key: "exp", label: "Experiences", line: PILLARS.experiences.short, chip: state("experiences"), href: "#experiences", image: "/preview-v2/jarlshof.jpg", crop: { cx: 0.5, cy: 0.5, z: 1 }, from: "#0e7490", to: "#164e63", span: "col-span-2 lg:col-span-2" },
    { key: "biz", label: "Businesses", line: "Everyone trading across the isles", chip: businessCount ? `${businessCount}+ listed` : "Browse", href: "#businesses", image: "/preview-v2/local-street.jpg", crop: { cx: 0.85, cy: 0.5, z: 1.4 }, from: "#4f46e5", to: "#1e1b4b", span: "col-span-1 lg:col-span-2" },
    { key: "rewards", label: "Rewards", line: "Stamps, points and your Wallet", chip: "Collect as you shop", href: "#rewards", from: "#a855f7", to: "#4c1d95", span: "col-span-1 lg:col-span-2", rewards: true },
  ];
  return (
    <section className="mx-auto max-w-6xl px-5 py-10 sm:py-14">
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:auto-rows-[190px] lg:grid-cols-4">
        {tiles.map((t) => (
          <Link key={t.key} href={t.href} className={`group relative isolate flex min-h-[170px] flex-col justify-end overflow-hidden rounded-3xl text-white shadow-lift ${t.span}`} style={{ background: `linear-gradient(150deg, ${t.from}, ${t.to})` }}>
            {t.image && <CropImg src={t.image} crop={t.crop} className="absolute inset-0 -z-10" />}
            {t.rewards && <RewardsArt />}
            <div className="absolute inset-0 -z-10" style={{ background: `linear-gradient(to top, ${t.to}f2 6%, ${t.to}8c 42%, ${t.from}1f)` }} />
            <div className="p-4 sm:p-5">
              <span className={"block font-display font-bold leading-none " + (t.key === "shop" ? "text-5xl sm:text-6xl" : "text-3xl sm:text-4xl")}>{t.label}</span>
              <span className="mt-1.5 block max-w-xs text-xs font-medium leading-snug text-white/85 sm:text-sm">{t.line}</span>
              <span className="mt-3 inline-block rounded-pill bg-white/20 px-3 py-1 text-[11px] font-bold backdrop-blur-sm">{t.chip} →</span>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}

/** A loyalty card drawn in CSS: stamps filling in. Decorative. */
function RewardsArt() {
  return (
    <div aria-hidden className="absolute right-3 top-3 -z-10 w-[62%] max-w-[210px] rotate-6 rounded-2xl bg-white/95 p-3 shadow-lift">
      <div className="flex items-center justify-between text-[9px] font-black uppercase tracking-wider text-violet-900"><span>Sample Café</span><span>5 / 8</span></div>
      <div className="mt-2 grid grid-cols-4 gap-1.5">
        {Array.from({ length: 8 }, (_, i) => (
          <span key={i} className={"grid aspect-square place-items-center rounded-full text-[10px] font-black " + (i < 5 ? "bg-violet-600 text-white" : "border-2 border-dashed border-violet-300 text-violet-300")}>{i < 5 ? "★" : ""}</span>
        ))}
      </div>
    </div>
  );
}

/* ── What's good locally ──────────────────────────────────────────────────── */

export function GoodLocally({ businesses, commerce }: { businesses: CuratedBusiness[]; commerce: Record<Pillar, Merch[]> }) {
  const byCat = (c: string) => businesses.find((b) => b.category === c);
  const cafe = byCat("food_drink") ?? businesses[0];
  const shop = byCat("retail");
  const service = byCat("services");
  const picks = [commerce.offers[0], commerce.shop[0], commerce.experiences[0], commerce.book[0]].filter(Boolean) as Merch[];
  if (!cafe && picks.length === 0) return null;
  const cat = (b: CuratedBusiness) => CATEGORY_LABEL[b.category ?? ""] ?? "Business";
  const Biz = ({ b, c, rail = false }: { b: CuratedBusiness; c: string; rail?: boolean }) => (
    <Link href={`/directory/${b.slug || b.id}`} className={"group flex min-h-[170px] flex-col justify-between rounded-3xl p-4 text-white shadow-soft transition hover:-translate-y-0.5 hover:shadow-lift " + (rail ? "w-44 shrink-0 snap-start" : "")} style={{ background: `linear-gradient(150deg, ${c}, ${c}aa 70%, #1e1b4b)` }}>
      <span className="grid h-14 w-14 place-items-center overflow-hidden rounded-2xl bg-white shadow">
        {b.logo_url
          // eslint-disable-next-line @next/next/no-img-element
          ? <img src={b.logo_url} alt="" className="h-full w-full object-contain p-1.5" />
          : <span className="font-display text-2xl font-bold text-ink-soft">{b.name.slice(0, 1)}</span>}
      </span>
      <span><span className="block text-[10px] font-bold uppercase tracking-widest text-white/75">{cat(b)}</span><span className="mt-0.5 block line-clamp-2 font-display text-xl font-bold leading-tight">{b.name}</span></span>
    </Link>
  );
  return (
    <Band bg="#f3ece0">
      <Heading eyebrow="What's good locally" title="Handpicked from across the isles" color={LOCAL} />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        {cafe && (
          <Link href={`/directory/${cafe.slug || cafe.id}`} className="group relative isolate flex min-h-[380px] overflow-hidden rounded-3xl shadow-lift lg:col-span-5 lg:min-h-[480px]">
            <CropImg src={cafe.cover_url || "/preview-v2/local-street.jpg"} crop={{ cx: 0.5, cy: 0.4, z: 1.2 }} fallback="/preview-v2/local-street.jpg" className="absolute inset-0 -z-10" />
            <div className="absolute inset-0 -z-10 bg-gradient-to-t from-[#7c2d12]/95 via-[#7c2d12]/45 to-transparent" />
            <div className="mt-auto p-6 text-white sm:p-8">
              <span className="rounded-pill bg-white/20 px-3 py-1 text-[11px] font-bold uppercase tracking-widest backdrop-blur-sm">{cat(cafe)}</span>
              <h3 className="mt-3 font-display text-4xl font-bold leading-[1.02] sm:text-5xl">{cafe.name}</h3>
              {cafe.description && <p className="mt-2 line-clamp-2 max-w-md text-base text-white/90">{cafe.description}</p>}
              <span className="mt-4 inline-block rounded-pill bg-white px-5 py-2 text-sm font-bold text-ink">Visit →</span>
            </div>
          </Link>
        )}
        {/* phone: one swipe rail of the mix; desktop: a mosaic */}
        <Rail className="lg:hidden">
          {picks.slice(0, 3).map((m) => <MerchCard key={m.id} m={m} />)}
          {shop && <Biz b={shop} c="#7c3aed" rail />}
          {service && <Biz b={service} c="#0e7490" rail />}
        </Rail>
        <div className="hidden grid-cols-2 gap-4 lg:col-span-7 lg:grid">
          {picks[0] && <div className="flex"><MerchCard m={picks[0]} fill /></div>}
          {shop && <Biz b={shop} c="#7c3aed" />}
          {picks[1] && <div className="flex"><MerchCard m={picks[1]} fill /></div>}
          {service && <Biz b={service} c="#0e7490" />}
          {picks[2] && <div className="col-span-2"><MerchCard m={picks[2]} fill /></div>}
        </div>
      </div>
    </Band>
  );
}

/* ── Each pillar, banded for rhythm ───────────────────────────────────────── */

const BAND: Record<Pillar, { bg: string; tone: "light" | "dark" }> = {
  shop: { bg: "#fbf8f2", tone: "light" },
  offers: { bg: "#fff3e0", tone: "light" },
  book: { bg: "#e8f7ef", tone: "light" },
  experiences: { bg: "#0b3a46", tone: "dark" },
};

export function PillarBand({ pillar, items }: { pillar: Pillar; items: Merch[] }) {
  const b = BAND[pillar];
  return (
    <section style={{ background: b.bg, ["--ticket-bg" as string]: b.bg }}>
      <div className="mx-auto max-w-6xl px-5 py-12 sm:py-16">
        <PillarSection pillar={pillar} items={items} id={pillar} tone={b.tone} />
      </div>
    </section>
  );
}

/* ── Rewards ──────────────────────────────────────────────────────────────── */

export function RewardsPanel() {
  const steps = [
    ["1", "Shop locally", "Spend with Shetland businesses — in person or online."],
    ["2", "Collect stamps", "Every visit fills your card at each participating shop."],
    ["3", "Earn points", "Points build up across the isles, not just in one shop."],
    ["4", "Spend with Wallet", "Pay from your Wallet and see your savings add up."],
  ];
  return (
    <section id="rewards" className="relative isolate overflow-hidden text-white" style={{ background: "linear-gradient(135deg,#4c1d95,#6d28d9 55%,#4338ca)" }}>
      <div aria-hidden className="absolute -right-24 -top-24 -z-10 h-80 w-80 rounded-full bg-fuchsia-400/20 blur-3xl" />
      <div className="mx-auto grid max-w-6xl items-center gap-10 px-5 py-12 sm:py-16 lg:grid-cols-2">
        <div>
          <p className="eyebrow text-violet-200">Local rewards</p>
          <h2 className="mt-1.5 font-display text-4xl font-bold leading-[1.02] sm:text-5xl">One card for every shop in Shetland.</h2>
          <ol className="mt-6 grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2 lg:grid-cols-1">
            {steps.map(([n, t, d]) => (
              <li key={n} className="flex gap-4">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-white/15 font-display text-lg font-bold">{n}</span>
                <span><span className="block font-bold">{t}</span><span className="block text-sm text-white/80">{d}</span></span>
              </li>
            ))}
          </ol>
          <Link href="/loyalty" className="mt-7 inline-block rounded-pill bg-white px-6 py-3 text-sm font-bold text-violet-900 shadow-lift">Explore Local rewards →</Link>
        </div>
        {/* the card, drawn in CSS */}
        <div className="relative mx-auto w-full max-w-xs sm:max-w-md" aria-hidden>
          <div className="rotate-[-4deg] rounded-3xl bg-white p-4 text-violet-950 shadow-lift sm:p-6">
            <div className="flex items-center justify-between"><span className="font-display text-xl font-bold">Sample Café</span><span className="rounded-pill bg-violet-100 px-3 py-1 text-xs font-black text-violet-800">5 of 8</span></div>
            <div className="mt-5 grid grid-cols-4 gap-3">
              {Array.from({ length: 8 }, (_, i) => (
                <span key={i} className={"grid aspect-square place-items-center rounded-full text-lg font-black " + (i < 5 ? "bg-violet-600 text-white" : "border-2 border-dashed border-violet-300 text-violet-300")}>{i < 5 ? "★" : i + 1}</span>
              ))}
            </div>
            <p className="mt-5 text-sm font-semibold text-violet-800">3 more stamps for a free coffee</p>
          </div>
          <div className="absolute -bottom-5 -right-2 rotate-3 rounded-2xl bg-amber-300 px-5 py-3 text-amber-950 shadow-lift">
            <span className="block text-[10px] font-black uppercase tracking-widest">Wallet</span>
            <span className="block font-display text-2xl font-black">£12.50</span>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ── Businesses (curated) ─────────────────────────────────────────────────── */

const CAT_COLOR: Record<string, string> = { food_drink: "#c2410c", retail: "#7c3aed", services: "#0e7490", accommodation: "#15803d" };

export function BusinessesCurated({ businesses }: { businesses: CuratedBusiness[] }) {
  if (businesses.length === 0) return null;
  return (
    <Band bg="#f3ece0" id="businesses">
      <Heading eyebrow="Businesses" title="Open for business" color={LOCAL} cta={{ label: "Browse the Directory", href: "/directory" }} />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4">
        {businesses.slice(0, 8).map((b) => {
          const c = CAT_COLOR[b.category ?? ""] ?? "#4f46e5";
          return (
            <Link key={b.id} href={`/directory/${b.slug || b.id}`} className="group flex min-h-[150px] flex-col justify-between rounded-3xl p-4 text-white shadow-soft transition hover:-translate-y-0.5 hover:shadow-lift" style={{ background: `linear-gradient(150deg, ${c}, ${c}b0 65%, #1e1b4b)` }}>
              <span className="grid h-12 w-12 place-items-center overflow-hidden rounded-xl bg-white shadow">
                {b.logo_url
                  // eslint-disable-next-line @next/next/no-img-element
                  ? <img src={b.logo_url} alt="" className="h-full w-full object-contain p-1" />
                  : <span className="font-display text-xl font-bold text-ink-soft">{b.name.slice(0, 1)}</span>}
              </span>
              <span><span className="block text-[10px] font-bold uppercase tracking-widest text-white/75">{CATEGORY_LABEL[b.category ?? ""] ?? "Business"}</span><span className="mt-0.5 block line-clamp-2 font-display text-lg font-bold leading-tight">{b.name}</span></span>
            </Link>
          );
        })}
      </div>
    </Band>
  );
}

/* ── For businesses ───────────────────────────────────────────────────────── */

export function ForBusinesses({ children }: { children?: ReactNode }) {
  return (
    <section className="relative isolate overflow-hidden text-white" style={{ background: "linear-gradient(135deg,#032f4c,#0a4a70 60%,#12667a)" }}>
      <div className="mx-auto grid max-w-6xl items-center gap-8 px-5 py-12 sm:py-16 lg:grid-cols-2">
        <div>
          <p className="eyebrow text-teal-200">For businesses</p>
          <h2 className="mt-1.5 font-display text-4xl font-bold leading-[1.02] sm:text-5xl">Run a business in Shetland?<br /><span className="text-amber-200">Put it on the island&apos;s map.</span></h2>
          <p className="mt-4 max-w-lg text-lg text-white/85">List it free. Sell products, post offers, take bookings and sell passes — to everyone on the islands, in one place.</p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link href="/directory/new" className="rounded-pill bg-white px-6 py-3 text-sm font-bold text-navy shadow-lift">Add your business free →</Link>
            <Link href="/business" className="rounded-pill border border-white/40 px-6 py-3 text-sm font-bold text-white hover:bg-white/10">See what&apos;s included</Link>
          </div>
          {children}
        </div>
        <div className="relative mx-auto hidden w-full max-w-sm sm:block">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/business/local-phone.png" alt="" className="mx-auto w-full max-w-[280px] rotate-3 rounded-[2rem] shadow-lift" />
        </div>
      </div>
    </section>
  );
}

export { PILLAR_ORDER, density };

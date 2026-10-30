import Link from "next/link";
import type { ReactNode } from "react";
import { type HomeEvent, type HomeNotice, type HomeCampaign } from "@/lib/home-data";
import type { ShelfBoat, ShelfStory, ShelfSpik } from "@/lib/home-shelves";
import type { CuratedBusiness } from "@/lib/curated-businesses";
import type { CruiseHomeCard } from "@/lib/cruise-data";
import type { GamePrompt } from "@/lib/home-extras";
import { homeMosaicPlan, HOME_FALLBACK_IMAGE, type HomeCard } from "@/lib/event-display";
import { HomeCardImage } from "@/components/preview/v2/HomeCardImage";
import { SECTIONS } from "@/lib/sections";
import { CATEGORY_LABEL } from "@/lib/local-data";
import { PILLARS, PILLAR_ORDER, density, type Merch, type Pillar } from "@/lib/preview-v2";
import { CropImg, MerchCard, Rail } from "@/components/preview/v2/Merch";

/**
 * Home V2 sections. Home is the living front page of Shetland: editorial, useful now, and increasingly curated as
 * OneShetland fills up. Each section is a different SHAPE on purpose — a lead and its supporting items, a feature
 * and a mosaic, a band — so the page has rhythm instead of a stack of identical cards.
 */

const EVENTS = "#d4921a";

export function Band({ children, bg, className = "", id }: { children: ReactNode; bg?: string; className?: string; id?: string }) {
  return (
    <section id={id} className={className} style={bg ? { background: bg } : undefined}>
      <div className="mx-auto max-w-6xl px-5 py-12 sm:py-16">{children}</div>
    </section>
  );
}

export function Heading({ eyebrow, title, color, light = false, cta }: { eyebrow: string; title: string; color: string; light?: boolean; cta?: { label: string; href: string } }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3 sm:mb-8">
      <div>
        <p className="eyebrow" style={{ color: light ? "rgba(255,255,255,.75)" : color }}>{eyebrow}</p>
        <h2 className={`mt-1.5 font-display text-3xl font-bold leading-[1.05] sm:text-5xl ${light ? "text-white" : "text-ink"}`}>{title}</h2>
      </div>
      {cta && (
        <Link href={cta.href} className={"rounded-pill border px-4 py-2 text-sm font-bold transition " + (light ? "border-white/40 text-white hover:bg-white/10" : "border-line-strong text-ink-soft hover:bg-sand")}>
          {cta.label} →
        </Link>
      )}
    </div>
  );
}

/* ── Hero context: weather and friends as supporting pills ─────────────────── */

export function LivePills({ items }: { items: { key: string; label: string; href?: string }[] }) {
  if (items.length === 0) return null;
  return (
    <div className="mt-5 flex flex-wrap gap-2">
      {items.map((i) => {
        const cls = "inline-flex items-center gap-2 rounded-pill border border-white/25 bg-white/10 px-3.5 py-1.5 text-[13px] font-medium text-white backdrop-blur-md";
        return i.href ? <Link key={i.key} href={i.href} className={cls + " hover:bg-white/20"}>{i.label}</Link> : <span key={i.key} className={cls}>{i.label}</span>;
      })}
    </div>
  );
}

/* ── Right now in Shetland ─────────────────────────────────────────────────── */

const FOCUS = "outline-none focus-visible:ring-4 focus-visible:ring-amber-400 focus-visible:ring-offset-2";
type Kind = "hero" | "medium" | "small" | "tile" | "rail";

/**
 * One homepage event card. EVERY card is image-backed: the event's own cover when it has one, otherwise the OneShetland fallback
 * image (the same one the homepage has always used for an event without a cover). Position-based styling (hero / medium / small /
 * tile / rail) changes size and type scale, never whether a picture is used. The coloured numeral card only appears as a last
 * resort, if even the fallback image fails to load (see HomeCardImage).
 */
function EventCard({ c, kind }: { c: HomeCard; kind: Kind }) {
  const base = `group relative isolate flex overflow-hidden rounded-3xl transition ${FOCUS} `;
  const size: Record<Kind, string> = {
    hero: "min-h-[340px] shadow-lift lg:col-span-7 lg:row-span-2 lg:min-h-[560px]",
    medium: "hidden min-h-[170px] shadow-soft lg:col-span-5 lg:flex",
    small: "min-h-[180px] shadow-soft hover:-translate-y-0.5 hover:shadow-lift",
    tile: "min-h-[220px] shadow-soft hover:-translate-y-0.5 hover:shadow-lift lg:min-h-[240px]",
    rail: "min-h-[200px] shadow-soft",
  };
  const grad = kind === "medium" ? "bg-gradient-to-r from-black/80 via-black/40 to-transparent" : kind === "hero" ? "bg-gradient-to-t from-black/85 via-black/30 to-black/10" : "bg-gradient-to-t from-black/85 via-black/35 to-black/5";
  const backdrop = (
    <div className="absolute inset-0 -z-10 p-5 text-white sm:p-7" style={{ background: `linear-gradient(150deg, ${EVENTS}, #92400e)` }}>
      <span className={"font-display font-black leading-none " + (kind === "hero" ? "text-8xl" : kind === "medium" ? "text-5xl" : "text-6xl")}>
        {c.day}<span className={"ml-2 font-bold uppercase opacity-80 " + (kind === "hero" ? "text-3xl" : "text-xl")}>{c.month}</span>
      </span>
    </div>
  );
  return (
    <Link href={`/whats-on/${c.id}`} className={base + size[kind]}>
      <HomeCardImage src={c.image} fallbackSrc={HOME_FALLBACK_IMAGE} overlay={grad} backdrop={backdrop} />
      {kind === "hero" ? (
        <div className="mt-auto w-full p-6 text-white sm:p-9">
          <span className="inline-flex items-center gap-2 rounded-pill bg-white px-3.5 py-1.5 text-xs font-black uppercase tracking-wide" style={{ color: EVENTS }}>
            <span className="h-2 w-2 animate-pulse rounded-full" style={{ background: EVENTS }} /> {c.badge}
          </span>
          <h3 className="mt-4 max-w-2xl font-display text-4xl font-bold leading-[1.02] [text-shadow:_0_2px_18px_rgb(0_0_0_/_55%)] sm:text-6xl">{c.title}</h3>
          <p className="mt-3 text-base font-medium text-white/90 sm:text-lg">{c.line}{c.price ? ` · ${c.price}` : ""}</p>
        </div>
      ) : (
        <div className="mt-auto w-full min-w-0 p-4 text-white sm:p-5">
          <span className="text-xs font-black uppercase tracking-wider text-amber-300">{c.badge}</span>
          <p className={"mt-1 line-clamp-2 font-display font-bold leading-tight [text-shadow:_0_1px_10px_rgb(0_0_0_/_55%)] " + (kind === "medium" ? "max-w-xs text-2xl" : kind === "tile" ? "text-xl" : "text-lg")}>{c.title}</p>
          <p className="mt-1 truncate text-sm text-white/85">{c.line}</p>
        </div>
      )}
    </Link>
  );
}

const TILE_COLS: Record<number, string> = { 1: "lg:grid-cols-1", 2: "lg:grid-cols-2", 3: "lg:grid-cols-3" };

export function RightNow({ events, cruise, showCruise, lead }: { events: HomeEvent[]; cruise: CruiseHomeCard | null; showCruise: boolean; lead?: Merch }) {
  const cards = homeMosaicPlan(events, new Date());
  const [c0, c1, c2, c3, ...tiles] = cards;
  if (!c0 && !showCruise) return null;
  return (
    <Band>
      <Heading eyebrow="Right now in Shetland" title="What's happening" color={EVENTS} cta={{ label: "Full calendar", href: "/whats-on" }} />
      {/* Desktop: a large hero beside a medium card and two small ones, then a row of three. Phones: the hero, then everything
          else in one swipeable rail (native scroll-snap), so seven events never become seven full-height cards. */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12 lg:grid-rows-[repeat(2,minmax(0,1fr))]">
        {c0 && <EventCard c={c0} kind="hero" />}

        {cards.length > 1 && (
          <div className="lg:hidden">
            <ul aria-label="More events" className="-mx-5 flex snap-x snap-mandatory scroll-px-5 gap-3 overflow-x-auto px-5 pb-3 pt-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {cards.slice(1).map((c) => (
                <li key={c.id} className="flex w-[72vw] max-w-[300px] shrink-0 snap-start flex-col">
                  <EventCard c={c} kind="rail" />
                </li>
              ))}
            </ul>
          </div>
        )}

        {c1 && <EventCard c={c1} kind="medium" />}

        {(c2 || c3) && (
          <div className="hidden gap-4 lg:col-span-5 lg:grid lg:grid-cols-2">
            {c2 && <EventCard c={c2} kind="small" />}
            {c3 ? <EventCard c={c3} kind="small" /> : !showCruise && lead ? <MerchCard m={lead} fill /> : null}
          </div>
        )}
      </div>

      {tiles.length > 0 && (
        <div className={`mt-4 hidden gap-4 lg:grid ${TILE_COLS[tiles.length] ?? "lg:grid-cols-3"}`}>
          {tiles.map((c) => <EventCard key={c.id} c={c} kind="tile" />)}
        </div>
      )}

      {showCruise && cruise && (
        <Link href={`/cruise/${cruise.date}`} className={"group relative isolate mt-4 flex min-h-[120px] flex-col justify-between overflow-hidden rounded-3xl p-5 text-white shadow-soft transition hover:-translate-y-0.5 hover:shadow-lift sm:flex-row sm:items-end " + FOCUS} style={{ background: "linear-gradient(150deg,#0a4a70,#032f4c)" }}>
          {cruise.visits[0]?.image && <CropImg src={cruise.visits[0].image} className="absolute inset-0 -z-10 opacity-45" />}
          <span className="text-[11px] font-black uppercase tracking-widest text-sky-200">{cruise.isToday ? "In port today" : "Next cruise call"}</span>
          <span className="sm:text-right">
            <span className="block font-display text-4xl font-black leading-none">{cruise.ships_count}<span className="ml-1.5 text-base font-bold opacity-80">{cruise.ships_count === 1 ? "ship" : "ships"}</span></span>
            <span className="mt-1 block text-xs font-medium text-sky-100">{cruise.total_est_pax ? `~${cruise.total_est_pax.toLocaleString()} visitors ashore` : "Visitors ashore"}</span>
          </span>
        </Link>
      )}
    </Band>
  );
}

/* ── Discover something local ──────────────────────────────────────────────── */

const CAT_COLOR: Record<string, string> = { food_drink: "#c2410c", retail: "#7c3aed", services: "#0e7490", accommodation: "#15803d" };

function Logo({ b, size = "h-16 w-16" }: { b: CuratedBusiness; size?: string }) {
  return (
    <span className={`grid shrink-0 place-items-center overflow-hidden rounded-2xl bg-white shadow ${size}`}>
      {b.logo_url
        // eslint-disable-next-line @next/next/no-img-element
        ? <img src={b.logo_url} alt="" className="h-full w-full object-contain p-1.5" />
        : <span className="font-display text-2xl font-bold text-ink-soft">{b.name.slice(0, 1)}</span>}
    </span>
  );
}

export function DiscoverLocal({ businesses }: { businesses: CuratedBusiness[] }) {
  if (businesses.length === 0) return null;
  const lead = businesses.find((b) => b.cover_url || b.logo_url) ?? businesses[0];
  const rest = businesses.filter((b) => b.id !== lead.id).slice(0, 5);
  const href = (b: CuratedBusiness) => `/directory/${b.slug || b.id}`;
  return (
    <Band bg="#f3ece0">
      <Heading eyebrow="Discover something local" title="Who's open for business" color="#7c3aed" cta={{ label: "Explore all businesses", href: "/directory" }} />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        <Link href={href(lead)} className="group relative isolate flex min-h-[300px] overflow-hidden rounded-3xl shadow-lift lg:col-span-5 lg:min-h-[460px]">
          {lead.cover_url
            ? <CropImg src={lead.cover_url} className="absolute inset-0 -z-10" />
            : <CropImg src="/preview-v2/local-street.jpg" crop={{ cx: 0.55, cy: 0.35, z: 1.25 }} className="absolute inset-0 -z-10" />}
          <div className="absolute inset-0 -z-10" style={{ background: `linear-gradient(to top, ${CAT_COLOR[lead.category ?? ""] ?? "#4f46e5"}f5 0%, ${CAT_COLOR[lead.category ?? ""] ?? "#4f46e5"}c0 38%, ${CAT_COLOR[lead.category ?? ""] ?? "#4f46e5"}00 78%)` }} />
          <div className="mt-auto w-full p-6 text-white sm:p-8">
            <Logo b={lead} size="h-20 w-20" />
            <span className="mt-4 inline-block rounded-pill bg-white/20 px-3 py-1 text-[11px] font-bold uppercase tracking-widest backdrop-blur-sm">{CATEGORY_LABEL[lead.category ?? ""] ?? "Business"}</span>
            <h3 className="mt-2 font-display text-4xl font-bold leading-[1.02] [text-shadow:_0_2px_14px_rgb(0_0_0_/_40%)]">{lead.name}</h3>
            {lead.description && <p className="mt-2 line-clamp-2 max-w-md text-base text-white/90">{lead.description}</p>}
            <span className="mt-4 inline-block rounded-pill bg-white px-5 py-2 text-sm font-bold text-ink">Visit →</span>
          </div>
        </Link>

        <div className="grid grid-cols-2 gap-4 lg:col-span-7 lg:grid-cols-3 lg:grid-rows-2">
          {rest.map((b, i) => {
            const c = CAT_COLOR[b.category ?? ""] ?? "#4f46e5";
            return (
              <Link key={b.id} href={href(b)} className={"group relative isolate flex min-h-[135px] flex-col justify-between overflow-hidden rounded-3xl p-4 text-white shadow-soft transition hover:-translate-y-0.5 hover:shadow-lift sm:min-h-[170px] " + (i === 0 ? "lg:col-span-2" : "")} style={{ background: `linear-gradient(150deg, ${c}, ${c}bb 70%, #1e1b4b)` }}>
                <Logo b={b} size="h-14 w-14" />
                <span>
                  <span className="block text-[10px] font-bold uppercase tracking-widest text-white/75">{CATEGORY_LABEL[b.category ?? ""] ?? "Business"}</span>
                  <span className="mt-0.5 block line-clamp-2 font-display text-xl font-bold leading-tight">{b.name}</span>
                </span>
              </Link>
            );
          })}
        </div>
      </div>
    </Band>
  );
}

/* ── Shop · Offers · Book · Experiences — the permanent gateway ────────────── */

const NOUN: Record<Pillar, [string, string]> = { shop: ["product", "products"], offers: ["offer", "offers"], book: ["service", "services"], experiences: ["experience", "experiences"] };

export function CommerceGateway({ commerce }: { commerce: Record<Pillar, Merch[]> }) {
  const total = PILLAR_ORDER.reduce((n, p) => n + commerce[p].length, 0);
  // A mixed rail of the best of each pillar: first of each, then second of each …
  const mixed: Merch[] = [];
  for (let i = 0; mixed.length < 12 && i < 6; i++) for (const p of PILLAR_ORDER) if (commerce[p][i] && mixed.length < 12) mixed.push(commerce[p][i]);
  return (
    <section className="relative isolate overflow-hidden text-white" style={{ background: "linear-gradient(160deg,#2e1065 0%,#312e81 45%,#032f4c 100%)" }}>
      <div aria-hidden className="absolute inset-0 -z-10 opacity-[0.07]" style={{ backgroundImage: "radial-gradient(circle at 20% 20%, #fff 0, transparent 40%), radial-gradient(circle at 85% 80%, #12b3d6 0, transparent 45%)" }} />
      <div className="mx-auto max-w-6xl px-5 py-12 sm:py-16" style={{ ["--ticket-bg" as string]: "#2f2a85" }}>
        <Heading eyebrow="Shop local" title="Shop · Offers · Book · Experiences" color="#fff" light cta={{ label: "Explore Local", href: "/local" }} />
        <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          {PILLAR_ORDER.map((p) => {
            const pl = PILLARS[p];
            const n = commerce[p].length;
            const d = density(n);
            return (
              <Link key={p} href={pl.seeAll} className="group relative isolate flex aspect-[4/5] flex-col justify-end overflow-hidden rounded-3xl shadow-lift sm:aspect-[3/4]">
                <CropImg src={pl.image} crop={pl.crop} className="absolute inset-0 -z-10" />
                <div className="absolute inset-0 -z-10" style={{ background: `linear-gradient(to top, ${pl.deep}f5 8%, ${pl.deep}99 45%, ${pl.color}30)` }} />
                <div className="p-4 sm:p-5">
                  <span className="font-display text-3xl font-bold leading-none sm:text-4xl">{pl.label}</span>
                  <span className="mt-1.5 block text-xs font-medium leading-snug text-white/85 sm:text-sm">{pl.short}</span>
                  <span className="mt-3 inline-flex items-center gap-1.5 rounded-pill bg-white/20 px-3 py-1 text-[11px] font-bold backdrop-blur-sm">
                    {d === "none" ? "Opening soon" : `${n} ${NOUN[p][n === 1 ? 0 : 1]}`}
                    <span aria-hidden>→</span>
                  </span>
                </div>
              </Link>
            );
          })}
        </div>

        <div className="mt-8">
          {total > 0 ? (
            <>
              <p className="mb-3 text-sm font-bold uppercase tracking-widest text-white/70">Fresh from local businesses</p>
              <Rail>{mixed.map((m) => <MerchCard key={m.id} m={m} dark />)}</Rail>
            </>
          ) : (
            <div className="rounded-3xl border border-white/20 bg-white/10 p-6 backdrop-blur-sm sm:p-8">
              <p className="font-display text-2xl font-bold sm:text-3xl">The first Shetland businesses are setting up shop here.</p>
              <p className="mt-2 max-w-2xl text-white/80">Products from makers, offers from cafés and shops, appointments to book and days out to buy — all in one place, all local.</p>
              <Link href="/business" className="mt-5 inline-block rounded-pill bg-white px-5 py-2.5 text-sm font-bold text-ink">Be one of the first →</Link>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

/* ── Island life — a mosaic ────────────────────────────────────────────────── */

export function IslandMosaic({ boat, story, spik, game }: { boat: ShelfBoat; story: ShelfStory; spik: ShelfSpik; game: GamePrompt }) {
  const tile = "group relative isolate overflow-hidden rounded-3xl shadow-lift";
  return (
    <section className="text-white" style={{ background: "#032f4c" }}>
      <div className="mx-auto max-w-6xl px-5 py-12 sm:py-16">
        <Heading eyebrow="Island life" title="Fae da isles" color="#fff" light cta={{ label: "Da Boats · Spik · Memories", href: "/boats" }} />
        <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4 lg:grid-rows-[repeat(2,minmax(0,230px))_auto]">
          <Link href={boat ? `/boats/${boat.vessel_id}` : "/boats"} className={`${tile} col-span-2 min-h-[210px] lg:row-span-2 lg:min-h-0`}>
            <CropImg src={boat?.image_url ?? "/preview-v2/boats.jpg"} fallback="/preview-v2/boats.jpg" className="absolute inset-0 -z-10" />
            <div className="absolute inset-0 -z-10 bg-gradient-to-t from-black/80 via-black/15 to-transparent" />
            <span className="absolute left-4 top-4 rounded-pill bg-[#1e3a8a] px-3 py-1 text-[11px] font-bold uppercase tracking-widest">Da Boats</span>
            <div className="absolute inset-x-0 bottom-0 p-5">
              <p className="font-display text-3xl font-bold sm:text-4xl">{boat?.name ?? "The fleet"}</p>
              <p className="text-sm text-white/80">{boat?.built_year ? `Built ${boat.built_year} · ` : ""}the fishing fleet, past and present</p>
            </div>
          </Link>
          <Link href="/memories" className={`${tile} col-span-1 min-h-[170px] lg:row-span-2 lg:min-h-0`}>
            <CropImg src={story?.hero_url ?? "/preview-v2/memory.jpg"} fallback="/preview-v2/memory.jpg" className="absolute inset-0 -z-10 grayscale-[0.2]" />
            <div className="absolute inset-0 -z-10 bg-gradient-to-t from-[#9f1239]/90 via-black/20 to-transparent" />
            <span className="absolute left-3 top-3 rounded-pill bg-[#9f1239] px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest">Aald Memories</span>
            <p className="absolute inset-x-0 bottom-0 p-4 font-display text-xl font-bold leading-tight">{story?.title || "A story fae da isles"}</p>
          </Link>
          <Link href="/spik" className={`${tile} col-span-1 flex min-h-[150px] flex-col justify-between p-4`} style={{ background: "linear-gradient(150deg,#12b3d6,#0e7490)" }}>
            <span className="self-start rounded-pill bg-white/20 px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest">Wird o&apos; da day</span>
            <span>
              <span className="block font-display text-4xl font-black leading-none">{spik?.word ?? "peerie"}</span>
              <span className="mt-1.5 block line-clamp-3 text-xs text-white/90">{spik?.meaning ?? "small, little"}</span>
            </span>
          </Link>
          <Link href={game.href} className={`${tile} col-span-1 flex min-h-[150px] flex-col justify-between p-4`} style={{ background: "linear-gradient(150deg,#10b981,#047857)" }}>
            <span className="self-start rounded-pill bg-white/20 px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest">Today&apos;s game</span>
            <span>
              <span className="block font-display text-2xl font-black leading-tight">{game.title}</span>
              <span className="mt-1.5 block text-xs text-white/90">{game.sub}</span>
            </span>
          </Link>
          <Link href="/hubs" className={`${tile} col-span-2 flex min-h-[84px] items-center gap-4 p-5 lg:col-span-4`} style={{ background: "linear-gradient(150deg,#6b47bf,#4c1d95)" }}>
            <span className="text-3xl" aria-hidden>🤝</span>
            <span>
              <span className="block font-display text-xl font-bold leading-tight">Hubs</span>
              <span className="block text-xs text-white/85">Clubs, groups and good causes</span>
            </span>
          </Link>
        </div>
      </div>
    </section>
  );
}

/* ── Community ─────────────────────────────────────────────────────────────── */

export function CommunityV2({ notices, campaigns }: { notices: HomeNotice[]; campaigns: HomeCampaign[] }) {
  if (notices.length === 0 && campaigns.length === 0) return null;
  const n = notices[0];
  return (
    <Band>
      <Heading eyebrow="Community" title="From the community" color="#6b47bf" cta={{ label: "Hubs", href: "/hubs" }} />
      <div className={"grid grid-cols-1 gap-4 " + (notices.length + campaigns.length > 1 ? "md:grid-cols-2" : "")}>
        {n && (
          <Link href={n.href} className="group relative flex flex-col justify-center overflow-hidden rounded-3xl p-6 shadow-soft transition hover:shadow-lift sm:p-9" style={{ background: "linear-gradient(135deg,#ede9fe,#ddd6fe)" }}>
            <span className="text-[11px] font-black uppercase tracking-widest text-violet-700">{n.publisher}</span>
            <p className="mt-2 max-w-2xl font-display text-2xl font-bold leading-tight text-violet-950 sm:text-4xl">{n.title}</p>
            <p className="mt-3 line-clamp-3 max-w-2xl text-base text-violet-900/80">{n.body}</p>
          </Link>
        )}
        {campaigns.slice(0, 2).map((c) => {
          const pct = Math.min(100, Math.round((c.raised_pence / Math.max(1, c.goal_pence)) * 100));
          return (
            <Link key={c.id} href={`/hubs/campaign/${c.id}`} className="group rounded-3xl border border-line bg-white p-6 shadow-soft transition hover:shadow-lift">
              <span className="text-[11px] font-black uppercase tracking-widest text-emerald-700">Fundraiser · {c.hub}</span>
              <p className="mt-2 font-display text-2xl font-bold leading-tight text-ink">{c.title}</p>
              <span className="mt-4 block h-2 overflow-hidden rounded-full bg-sand"><span className="block h-full rounded-full bg-emerald-500" style={{ width: `${pct}%` }} /></span>
              <span className="mt-1.5 block text-xs font-bold text-ink-muted">{pct}% raised</span>
            </Link>
          );
        })}
      </div>
    </Band>
  );
}

/* ── Explore ───────────────────────────────────────────────────────────────── */

export function ExploreV2() {
  return (
    <section style={{ background: "#f3ece0" }}>
      <div className="mx-auto max-w-6xl px-5 py-10 sm:py-12">
        <h2 className="font-display text-xl font-bold text-ink">Explore OneShetland</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          {SECTIONS.map((s) => (
            <Link key={s.key} href={s.href} title={s.blurb} className="inline-flex items-center gap-2 rounded-pill bg-white px-4 py-2 text-sm font-semibold text-ink shadow-soft transition hover:-translate-y-0.5">
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: s.color }} />{s.label}
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}


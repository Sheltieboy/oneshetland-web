import Image from "next/image";
import Link from "next/link";
import { getHomeData } from "@/lib/home-data";
import { getHeroImage } from "@/lib/hero-context";
import { getHomePersonal, getTodaysGame, formatPence } from "@/lib/home-extras";
import { getTodaySnapshot } from "@/lib/shetland-today";
import { ShetlandTodayCard } from "@/components/home/ShetlandTodayCard";
import { UrgentAlertBanner } from "@/components/home/UrgentAlertBanner";
import { ForYou } from "@/components/home/ForYou";
import { PlanDayTile } from "@/components/home/PlanDayTile";
import { getAccount, accountName } from "@/lib/auth";
import { getForYou } from "@/lib/for-you.server";
import { getHomeShelves } from "@/lib/home-shelves";
import { getAudience } from "@/lib/audience.server";
import { AudienceChip } from "@/components/home/AudienceChip";
import { HiringShelf } from "@/components/home/Shelves";
import { HeroActions, WhatsHappening, FindLocal, LocalCommerce, IslandAndCommunity, ExploreMore } from "@/components/home/HomeSections";
import { getEventsInMonth } from "@/lib/events-data";
import { getCruiseHomeCard } from "@/lib/cruise-data";
import { buildHeroSignals } from "@/lib/home-signals";
import { getCuratedBusinesses } from "@/lib/curated-businesses";
import { cruiseWorthShowing, todayStrip } from "@/lib/home-curation";

// Live community content — always fetch fresh for now.
export const dynamic = "force-dynamic";

export default async function Home() {
  const now = new Date();
  const [data, heroImage, personal, today, account, monthEvents, shelves, cruiseCard, businesses] = await Promise.all([
    getHomeData(),
    getHeroImage(),
    getHomePersonal(),
    // Lerwick snapshot rendered on the server; the card's "Near me" toggle
    // re-fetches client-side via /api/shetland-today. Never throws.
    getTodaySnapshot().catch(() => null),
    getAccount(),
    getEventsInMonth(now.getFullYear(), now.getMonth()).catch(() => []),
    getHomeShelves(),
    // Only used for the hero's "ships in today" signal. Never let it break the
    // page — a missing cruise card just means one fewer pill.
    getCruiseHomeCard().catch(() => null),
    getCuratedBusinesses({ limit: 8 }),
  ]);
  const audience = await getAudience();
  const visiting = audience === "visiting";
  const game = getTodaysGame();

  // The hero pills — live signals, not section shortcuts. Pure over data we've
  // already loaded, so it adds no database work.
  const heroSignals = buildHeroSignals({ now, monthEvents, jobs: data.jobs, cruise: cruiseCard });

  // Personalised "For you" strip — signed-in users only. Never throws.
  const forYou = account ? await getForYou(account.id).catch(() => []) : [];

  const strip = todayStrip(today);

  return (
    <>
      {/* A. Urgent alert — renders only when a real one exists, so there is no empty space. */}
      <UrgentAlertBanner alerts={data.alerts} />

      {/* B. Hero — what OneShetland is, and two ways in. On a phone this whole block is the first screen. */}
      <section className="relative isolate overflow-hidden bg-navy text-paper">
        <Image src={heroImage} alt="" fill priority unoptimized className="object-cover object-center" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/25 to-black/5" />
        <div className="absolute inset-0 bg-gradient-to-r from-black/45 via-black/10 to-transparent" />
        <div className="relative mx-auto grid max-w-6xl items-center gap-6 px-5 py-8 sm:py-12 md:grid-cols-[1fr_minmax(300px,360px)] md:gap-10 lg:gap-12 lg:py-16">
          <div>
            <h1 className="font-display text-[2.25rem] font-bold leading-[1.05] text-paper [text-shadow:_0_2px_12px_rgb(0_0_0_/_55%)] sm:text-5xl lg:text-6xl">
              Shop Shetland. Discover Shetland.
              <br />
              OneShetland.
            </h1>
            <p className="mt-4 max-w-xl text-base leading-relaxed text-paper [text-shadow:_0_1px_6px_rgb(0_0_0_/_60%)] sm:text-lg">
              What&apos;s on, local businesses, jobs and island life — one warm home for Shetland.
            </p>

            <HeroActions />

            {/* On a phone the weather panel would fill the screen; one useful line instead. */}
            {strip && <p className="mt-4 text-sm font-medium text-paper/90 [text-shadow:_0_1px_6px_rgb(0_0_0_/_60%)] md:hidden">{strip}</p>}

            <div className="mt-4 flex flex-wrap items-center gap-2.5">
              {heroSignals.map((s) => (
                <Link key={s.key} href={s.href} className="rounded-pill border border-paper/30 bg-paper/10 px-4 py-2 text-sm font-medium text-paper backdrop-blur-sm transition hover:bg-paper/20">
                  {s.label}
                </Link>
              ))}
              {personal.signedIn && (
                <Link href="/account/wallet" className="inline-flex items-center gap-1.5 rounded-pill border border-paper/40 bg-paper/20 px-4 py-2 text-sm font-bold text-paper backdrop-blur-sm transition hover:bg-paper/30">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                    <path d="M3 7a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v1h1a1 1 0 0 1 1 1v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7zm15 5a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3z" />
                  </svg>
                  Wallet · {formatPence(personal.walletPence)}
                </Link>
              )}
            </div>

            {/* The living-here / visiting switch, small and in the hero: its effect (Plan a day first) shows at once. */}
            <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1">
              <AudienceChip audience={audience} compact />
              {visiting && <Link href="/visiting" className="text-xs font-semibold text-paper underline">Planning a trip? →</Link>}
            </div>
          </div>

          {/* Right (tablet and up) — the full Shetland Today panel. */}
          <div className="hidden md:block"><ShetlandTodayCard initial={today} glass /></div>
        </div>
      </section>

      {/* F. Visitor module — for somebody visiting, "what shall we do today" is the reason they opened the page. */}
      {visiting && (
        <section className="mx-auto max-w-6xl px-5 pt-10">
          <PlanDayTile wide />
        </section>
      )}

      {/* For you — personal, signed-in only, and only when there is something to say. */}
      {account && forYou.length > 0 && <ForYou name={accountName(account).split(" ")[0]} items={forYou} />}

      {/* C. What's happening — events, once; ship content only while a ship is actually about. */}
      <WhatsHappening events={data.events} showCruise={cruiseWorthShowing(cruiseCard)} />

      {/* D. Find local — a short shelf of genuine businesses. */}
      <FindLocal businesses={businesses} />

      {/* E. Jobs — one module, open vacancies only. */}
      <HiringShelf shelves={shelves} />

      {/* G. Local commerce — appears only when genuine offers or products exist. */}
      <LocalCommerce offers={data.offers} products={shelves.freshProducts} />

      {/* For residents the day-out planner is a quiet offer, not the page's question. */}
      {!visiting && (
        <section className="mx-auto max-w-6xl px-5 pt-10">
          <Link href="/visiting/plan" className="flex items-center justify-between gap-3 rounded-2xl border border-line bg-white px-5 py-4 shadow-soft transition hover:bg-sand">
            <span>
              <span className="block font-display text-lg font-bold text-ink">Showing somebody round?</span>
              <span className="block text-sm text-ink-muted">Plan a day out — travel times and a map.</span>
            </span>
            <span className="shrink-0 text-sm font-bold text-navy">Plan a day →</span>
          </Link>
        </section>
      )}

      {/* H. Island life & community — culture, today's game, fundraisers and notices in one module. */}
      <IslandAndCommunity shelves={shelves} game={game} notices={data.notices} campaigns={data.campaigns} />

      {/* I. Everything else, compactly. */}
      <ExploreMore />
    </>
  );
}

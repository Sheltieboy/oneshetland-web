import Image from "next/image";
import Link from "next/link";
import { getHomeData, getHomeContent } from "@/lib/home-data";
import { getHeroImage } from "@/lib/hero-context";
import { getHomePersonal, getTodaysGame, formatPence } from "@/lib/home-extras";
import { getTodaySnapshot } from "@/lib/shetland-today";
import { HomeBento } from "@/components/home/HomeBento";
import { SectionGrid } from "@/components/home/SectionGrid";
import { ShetlandTodayCard } from "@/components/home/ShetlandTodayCard";
import { UrgentAlertBanner } from "@/components/home/UrgentAlertBanner";
import { ForYou } from "@/components/home/ForYou";
import { PlanDayTile } from "@/components/home/PlanDayTile";
import { getAccount, accountName } from "@/lib/auth";
import { getForYou } from "@/lib/for-you.server";
import { getHomeShelves } from "@/lib/home-shelves";
import { getAudience } from "@/lib/audience.server";
import { AudienceChip } from "@/components/home/AudienceChip";
import { FeaturedShelf, OffersShelf, ShopRails, IslandLifeBand, HiringShelf } from "@/components/home/Shelves";
import { getEventsInMonth } from "@/lib/events-data";
import { GAMES, fetchLeaderboardWithTrend, type GameId } from "@/lib/games-data";
import { getCruiseHomeCard } from "@/lib/cruise-data";
import { buildHeroSignals } from "@/lib/home-signals";

// Live community content — always fetch fresh for now.
export const dynamic = "force-dynamic";

export default async function Home() {
  const now = new Date();
  const [data, heroImage, personal, today, homeContent, account, monthEvents, shelves, cruiseCard] = await Promise.all([
    getHomeData(),
    getHeroImage(),
    getHomePersonal(),
    // Lerwick snapshot rendered on the server; the card's "Near me" toggle
    // re-fetches client-side via /api/shetland-today. Never throws.
    getTodaySnapshot().catch(() => null),
    getHomeContent(),
    getAccount(),
    getEventsInMonth(now.getFullYear(), now.getMonth()).catch(() => []),
    getHomeShelves(),
    // Only used for the hero's "ships in today" signal. Never let it break the
    // page — a missing cruise card just means one fewer pill.
    getCruiseHomeCard().catch(() => null),
  ]);
  const audience = await getAudience();
  const visiting = audience === "visiting";
  const game = getTodaysGame();

  // The hero pills — live signals, not section shortcuts. Pure over data we've
  // already loaded, so it adds no database work.
  const heroSignals = buildHeroSignals({ now, monthEvents, jobs: data.jobs, cruise: cruiseCard });

  // Top-5 leaderboard for whichever game is featured on the tile today.
  const featuredGameId = (Object.values(GAMES).find((g) => g.href === game.href)?.id) as GameId | undefined;
  const gameLeaders = featuredGameId
    ? await fetchLeaderboardWithTrend(featuredGameId, 5).catch(() => [])
    : [];

  // Personalised "For you" strip — signed-in users only. Never throws.
  const forYou = account ? await getForYou(account.id).catch(() => []) : [];

  return (
    <>
      {/* ── Urgent / partner alerts ──────────────────────────────────────── */}
      <UrgentAlertBanner alerts={data.alerts} />

      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <section className="relative isolate overflow-hidden bg-navy text-paper">
        <Image
          src={heroImage}
          alt=""
          fill
          priority
          unoptimized
          className="object-cover object-center"
        />
        {/* Neutral legibility scrim — darker toward the lower-left where the
            text sits, fading to clear so the photo shows through. */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/25 to-black/5" />
        <div className="absolute inset-0 bg-gradient-to-r from-black/45 via-black/10 to-transparent" />
        <div className="relative mx-auto grid max-w-6xl items-center gap-9 px-5 py-14 sm:py-16 md:grid-cols-[1fr_minmax(300px,360px)] md:gap-10 lg:gap-12 lg:py-20">
          {/* Left — wordmark message + chips */}
          <div>
            <h1 className="font-display text-[2.5rem] font-bold leading-[1.03] text-paper [text-shadow:_0_2px_12px_rgb(0_0_0_/_55%)] sm:text-5xl lg:text-6xl">
              Everything Shetland,
              <br />
              in one place.
            </h1>
            <p className="mt-5 max-w-xl text-lg leading-relaxed text-paper [text-shadow:_0_1px_6px_rgb(0_0_0_/_60%)]">
              What&apos;s on, local businesses, the fishing fleet, the dialect,
              community hubs, jobs and more — one warm home for the islands.
            </p>

            {/* Live signals + wallet (signed-in). These are deliberately NOT
                section shortcuts — the nav above already has those. Each pill
                only shows when it has something to say. See lib/home-signals.ts */}
            <div className="mt-7 flex flex-wrap items-center gap-2.5">
              {heroSignals.map((s) => (
                <Link
                  key={s.key}
                  href={s.href}
                  className="rounded-pill border border-paper/30 bg-paper/10 px-4 py-2 text-sm font-medium text-paper backdrop-blur-sm transition hover:bg-paper/20"
                >
                  {s.label}
                </Link>
              ))}
              {personal.signedIn && (
                <Link
                  href="/account/wallet"
                  className="inline-flex items-center gap-1.5 rounded-pill border border-paper/40 bg-paper/20 px-4 py-2 text-sm font-bold text-paper backdrop-blur-sm transition hover:bg-paper/30"
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                    <path d="M3 7a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v1h1a1 1 0 0 1 1 1v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7zm15 5a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3z" />
                  </svg>
                  Wallet · {formatPence(personal.walletPence)}
                </Link>
              )}
            </div>
          </div>

          {/* Right — frosted Shetland Today panel (weather · daylight · tides) */}
          <ShetlandTodayCard initial={today} glass />
        </div>
      </section>

      {/* ── Plan a day out — full width, for somebody who's VISITING ──────
             Top of the page, above "For you", because for a visitor "what
             shall we do today" IS the reason they opened it. For somebody who
             lives here it stays a tile in the mosaic, where it reads as one
             option among many rather than the question of the day. */}
      {visiting && (
        <section className="mx-auto max-w-6xl px-5 pt-12">
          <PlanDayTile wide />
        </section>
      )}

      {/* ── For you — personalised, signed-in only ───────────────────────── */}
      {account && forYou.length > 0 && (
        <ForYou name={accountName(account).split(" ")[0]} items={forYou} />
      )}

      {/* ── Who the page is ordered for. Sits above the shelves it affects,
             so the effect of tapping it is visible immediately. ──────────── */}
      <div className="mx-auto flex max-w-6xl items-center gap-3 px-5 pt-10">
        <AudienceChip audience={audience} />
        {visiting && (
          <Link href="/visiting" className="text-xs font-semibold text-sky-700 underline">
            Planning a trip? →
          </Link>
        )}
      </div>

      {/* ── Featured this week — the premium shelf (paid, with fresh-content
             fallback until businesses subscribe) ──────────────────────────── */}
      <FeaturedShelf shelves={shelves} />

      {/* ── Bento — the live homepage mosaic ─────────────────────────────── */}
      <HomeBento data={data} game={game} content={homeContent} monthEvents={monthEvents} gameLeaders={gameLeaders} visiting={visiting} />

      {/* ── The middle of the page is ordered for who's reading it.
             A visitor came for what's on, the shops and the island itself.
             Local offers and hiring are the two things they can't act on, so
             those move down — hiring all the way below the browse grid, since
             a job in Lerwick is no use to somebody here until Friday.
             Nothing is removed either way; the ORDER is the only difference.
             See lib/audience.ts. ────────────────────────────────────────── */}
      {visiting ? (
        <>
          <ShopRails shelves={shelves} />
          <IslandLifeBand shelves={shelves} spik={shelves.spik} />
          <OffersShelf offers={data.offers} />
        </>
      ) : (
        <>
          <OffersShelf offers={data.offers} />
          <ShopRails shelves={shelves} />
          <IslandLifeBand shelves={shelves} spik={shelves.spik} />
          <HiringShelf shelves={shelves} />
        </>
      )}

      {/* ── Browse-everything grid ───────────────────────────────────────── */}
      {/* Every homepage section sets its own TOP padding only (pt-12), so the
          rhythm stays even and an empty section collapses without a double
          gap. Only this last one adds bottom padding, before the footer. */}
      <SectionGrid />

      {/* Visitors get hiring last — present, but after everything they came for. */}
      {visiting && <HiringShelf shelves={shelves} />}
    </>
  );
}

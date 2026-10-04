import Image from "next/image";
import { getHomeData } from "@/lib/home-data";
import { getHeroImage } from "@/lib/hero-context";
import { getTodaysGame } from "@/lib/home-extras";
import { getTodaySnapshot, describeWeather } from "@/lib/shetland-today";
import { getHomeShelves } from "@/lib/home-shelves";
import { getAudience } from "@/lib/audience.server";
import { getCruiseHomeCard } from "@/lib/cruise-data";
import { getCuratedBusinesses } from "@/lib/curated-businesses";
import { getActiveLocalPasses, getBookableServices } from "@/lib/local-data";
import { cruiseWorthShowing } from "@/lib/home-curation";
import { mapLiveCommerce } from "@/lib/preview-v2";
import { UrgentAlertBanner } from "@/components/home/UrgentAlertBanner";
import { AudienceChip } from "@/components/home/AudienceChip";
import { HeroActions } from "@/components/home/HomeSections";
import { PlanDayTile } from "@/components/home/PlanDayTile";
import { buildWork } from "@/lib/preview-work";
import { loadLiveShifts, mapLiveJobs } from "@/lib/preview-work-live";
import { HomeWork } from "@/components/preview/v2/WorkV2";
import { ForYou } from "@/components/home/ForYou";
import { getAccount, accountName } from "@/lib/auth";
import { getForYou } from "@/lib/for-you.server";
import { LivePills, RightNow, DiscoverLocal, CommerceGateway, IslandMosaic, CommunityV2, ExploreV2 } from "@/components/preview/v2/HomeV2";

// Live community content — always fetch fresh.
export const dynamic = "force-dynamic";

/**
 * Home — the living front page of Shetland (the approved Home V2 design).
 *
 * Everything here is LIVE production data read through the public (anonymous) client, so a test/acceptance fixture can
 * never reach this page: the database withholds it from that role. There is no sample or fallback content: a section
 * with nothing to show collapses, or shows its standing proposition (commerce, Work).
 */
export default async function Home() {
  const now = new Date();
  const [data, heroImage, today, shelves, cruise, businesses, passes, services, audience, account] = await Promise.all([
    getHomeData(),
    getHeroImage(),
    getTodaySnapshot().catch(() => null),
    getHomeShelves(),
    getCruiseHomeCard().catch(() => null),
    getCuratedBusinesses({ limit: 9 }),
    getActiveLocalPasses(24).catch(() => []),
    getBookableServices({}).catch(() => []),
    getAudience(),
    getAccount(),
  ]);
  const work = buildWork("live", undefined, { jobs: mapLiveJobs(shelves.hiring), shifts: await loadLiveShifts() }, now);
  // For you — personal, signed-in only, and only when there is something genuine to say.
  const forYou = account ? await getForYou(account.id).catch(() => []) : [];
  const visiting = audience === "visiting";
  const showCruise = cruiseWorthShowing(cruise, now);
  const commerce = mapLiveCommerce({ products: shelves.freshProducts, offers: data.offers, passes, services });

  const pills: { key: string; label: string; href?: string }[] = [];
  if (today?.tempC != null) pills.push({ key: "w", label: `${today.place} ${Math.round(today.tempC)}° ${describeWeather(today.weatherCode).label}` });
  if (today?.sunset) pills.push({ key: "s", label: `Sunset ${today.sunset}` });
  if (showCruise && cruise) pills.push({ key: "c", label: cruise.isToday ? `${cruise.ships_count} ${cruise.ships_count === 1 ? "ship" : "ships"} in port` : "Ship arriving soon", href: "/cruise" });
  const todaysEvents = data.events.filter((e) => new Date(e.starts_at).toDateString() === now.toDateString()).length;
  if (todaysEvents) pills.push({ key: "e", label: `${todaysEvents} on today`, href: "/whats-on" });

  return (
    <>
      <UrgentAlertBanner alerts={data.alerts} />

      {/* 2 · HERO — the product, understood at once, with real actions on the first phone screen */}
      <section className="relative isolate overflow-hidden bg-navy text-white">
        <Image src={heroImage} alt="" fill priority unoptimized className="object-cover object-center" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#032f4c]/70 via-[#032f4c]/10 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-r from-[#032f4c]/65 via-[#032f4c]/15 to-transparent" />
        <div className="relative mx-auto max-w-6xl px-5 pb-12 pt-10 sm:pb-20 sm:pt-16 lg:pb-24 lg:pt-24">
          <p className="eyebrow text-amber-300">The islands, right now</p>
          <h1 className="mt-3 max-w-3xl font-display text-[2.6rem] font-bold leading-[0.98] [text-shadow:_0_2px_24px_rgb(0_0_0_/_45%)] sm:text-6xl lg:text-7xl">
            Shop Shetland.<br />Discover Shetland.<br /><span className="text-amber-200">OneShetland.</span>
          </h1>
          <p className="mt-4 max-w-xl text-base leading-relaxed text-white/90 sm:text-xl">What&apos;s on, who&apos;s open, what&apos;s hiring — and the best of the isles, in one place.</p>
          <HeroActions />
          <LivePills items={pills} />
          <div className="mt-4"><AudienceChip audience={audience} compact /></div>
        </div>
      </section>

      {visiting && <section className="mx-auto max-w-6xl px-5 pt-10"><PlanDayTile wide /></section>}

      {account && forYou.length > 0 && <ForYou name={accountName(account).split(" ")[0]} items={forYou} />}

      {/* 3 · RIGHT NOW */}
      <RightNow events={data.events} cruise={cruise} showCruise={showCruise} lead={commerce.experiences[0]} />

      {/* 4 · DISCOVER SOMETHING LOCAL */}
      <DiscoverLocal businesses={businesses} />

      {/* 5 · SHOP · OFFERS · BOOK · EXPERIENCES */}
      <CommerceGateway commerce={commerce} />

      {/* 6 · WORK */}
      <HomeWork work={work} now={now} />

      {/* 7 · ISLAND LIFE */}
      <IslandMosaic boat={shelves.boat} story={shelves.story} spik={shelves.spik} game={getTodaysGame()} />

      {/* 8 · COMMUNITY */}
      <CommunityV2 notices={data.notices} campaigns={data.campaigns} />

      {/* 9 · EXPLORE */}
      <ExploreV2 />
    </>
  );
}

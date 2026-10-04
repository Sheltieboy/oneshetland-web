import Image from "next/image";
import type { Metadata } from "next";
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
import { buildCommerce, mapLiveCommerce, parsePreview } from "@/lib/preview-v2";
import { UrgentAlertBanner } from "@/components/home/UrgentAlertBanner";
import { AudienceChip } from "@/components/home/AudienceChip";
import { HeroActions } from "@/components/home/HomeSections";
import { PlanDayTile } from "@/components/home/PlanDayTile";
import { buildWork, parseMix } from "@/lib/preview-work";
import { loadLiveShifts, mapLiveJobs } from "@/lib/preview-work-live";
import { HomeWork } from "@/components/preview/v2/WorkV2";
import { PreviewBar } from "@/components/preview/v2/PreviewBar";
import { LivePills, RightNow, DiscoverLocal, CommerceGateway, IslandMosaic, CommunityV2, ExploreV2 } from "@/components/preview/v2/HomeV2";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Home V2 (design preview)", robots: { index: false, follow: false } };

/**
 * Home V2 — DESIGN PREVIEW. Not linked from anywhere, not indexed, and nothing here replaces `/`.
 * ?state=live|empty|seed|full  ?as=public|admin
 */
export default async function HomeV2({ searchParams }: { searchParams: Promise<{ state?: string; as?: string; work?: string }> }) {
  const sp = await searchParams;
  const { state, viewer } = parsePreview(sp);
  const now = new Date();
  const [data, heroImage, today, shelves, cruise, businesses, passes, services, audience] = await Promise.all([
    getHomeData(),
    getHeroImage(),
    getTodaySnapshot().catch(() => null),
    getHomeShelves(),
    getCruiseHomeCard().catch(() => null),
    getCuratedBusinesses({ limit: 9 }),
    getActiveLocalPasses(24).catch(() => []),
    getBookableServices({}).catch(() => []),
    getAudience(),
  ]);
  const work = buildWork(state, parseMix(sp.work), { jobs: mapLiveJobs(shelves.hiring), shifts: state === "live" ? await loadLiveShifts() : [] }, now);
  const visiting = audience === "visiting";
  const showCruise = cruiseWorthShowing(cruise, now);
  const commerce = buildCommerce(state, viewer, mapLiveCommerce({ products: shelves.freshProducts, offers: data.offers, passes, services }));

  const pills: { key: string; label: string; href?: string }[] = [];
  if (today?.tempC != null) pills.push({ key: "w", label: `${today.place} ${Math.round(today.tempC)}° ${describeWeather(today.weatherCode).label}` });
  if (today?.sunset) pills.push({ key: "s", label: `Sunset ${today.sunset}` });
  if (showCruise && cruise) pills.push({ key: "c", label: cruise.isToday ? `${cruise.ships_count} ${cruise.ships_count === 1 ? "ship" : "ships"} in port` : "Ship arriving soon", href: "/cruise" });
  const todaysEvents = data.events.filter((e) => new Date(e.starts_at).toDateString() === now.toDateString()).length;
  if (todaysEvents) pills.push({ key: "e", label: `${todaysEvents} on today`, href: "/whats-on" });

  return (
    <>
      <PreviewBar route="/preview/home-v2" state={state} viewer={viewer} other={{ label: "Local V2", href: "/preview/local-v2" }} />
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

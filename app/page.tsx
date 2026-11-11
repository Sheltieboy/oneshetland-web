import Image from "next/image";
import { getHomeActivities } from "@/lib/activities-data";
import { homeActivityPlan } from "@/lib/home-activities";
import type { ListingRow, RuleRow } from "@/lib/activities";
import { isOnToday } from "@/lib/event-currency";
import { getHomeData, type HomeData } from "@/lib/home-data";
import { getHeroImage, DEFAULT_HERO_IMAGE } from "@/lib/hero-context";
import { resilient } from "@/lib/home-resilience";
import { getTodaysGame } from "@/lib/home-extras";
import { getTodaySnapshot, describeWeather } from "@/lib/shetland-today";
import { getHomeShelves, type HomeShelves } from "@/lib/home-shelves";
import { getAudience } from "@/lib/audience.server";
import { getCruiseHomeCard } from "@/lib/cruise-data";
import { getBusinessShowcase, type Showcase } from "@/lib/curated-businesses";
import { getActiveLocalPasses, getBookableServices } from "@/lib/local-data";
import { cruiseWorthShowing } from "@/lib/home-curation";
import { mapLiveCommerce } from "@/lib/preview-v2";
import { Suspense } from "react";
import { HomeEssentialAlerts } from "@/components/notices/HomeEssentialAlerts";
import { getHomeNoticeBundle } from "@/lib/home-notices";
import { AudienceChip } from "@/components/home/AudienceChip";
import { HeroActions } from "@/components/home/HomeSections";
import { PlanDayTile } from "@/components/home/PlanDayTile";
import { buildWork } from "@/lib/preview-work";
import { loadLiveShifts, mapLiveJobs } from "@/lib/preview-work-live";
import { JOIN_ADD_HREF, JOIN_CLAIM_HREF } from "@/components/business/JoinBusinessCta";
import { ContributeCard } from "@/components/home/ContributeCard";
import { NewThisWeek } from "@/components/home/NewThisWeek";
import { TomorrowStrip } from "@/components/home/TomorrowStrip";
import { LatestEditorial } from "@/components/home/LatestEditorial";
import { EditionsStrip } from "@/components/home/EditionsStrip";
import { getFeaturedEditions } from "@/lib/editions/promo-featured.server";
import { planNewThisWeek } from "@/lib/home-new-this-week";
import { getHomeNewCandidates } from "@/lib/home-new.server";
import { getHomeAnnouncements } from "@/lib/home-announcements";
import { getTomorrowEvents } from "@/lib/home-tomorrow.server";
import { tomorrowItems, tomorrowWindow } from "@/lib/home-tomorrow";
import { offersContribution } from "@/lib/home-contribute";
import { ADD_EVENT_HREF, ADD_EVENT_LABEL, ADD_EVENT_SHORT_DESC, entryPointsEnabled } from "@/lib/event-entry-points";
import { getMyBusinesses } from "@/lib/jobs-data.server";
import { GetItDoneHome } from "@/components/home/GetItDoneHome";
import { HomeWork } from "@/components/preview/v2/WorkV2";
import { ForYou } from "@/components/home/ForYou";
import { getHomePin } from "@/lib/home-pin";
import { getAccount, accountName } from "@/lib/auth";
import { getForYou } from "@/lib/for-you.server";
import { Heading, LivePills, RightNow, DiscoverLocal, CommerceGateway, IslandMosaic, CommunityV2, ExploreV2 } from "@/components/preview/v2/HomeV2";

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
  // Every non-essential, anonymous loader is bounded (hard deadline), kept briefly, and falls back to "nothing to show" so one slow or failed
  // dependency can no longer stop the whole page. Nothing personal goes through resilient(): account, audience, for-you and a member's
  // area-scoped notices stay live. The signed-in lookups start at once and the notice bundle / for-you follow the account WITHOUT waiting for the
  // other loaders, so the old serial chain (batch, then shifts, then notices, then for-you) is now one parallel batch.
  const R = (ttlMs: number, deadlineMs: number, staleMs: number) => ({ ttlMs, deadlineMs, staleMs });
  const emptyData: HomeData = { events: [], businesses: [], offers: [], notices: [], campaigns: [], jobs: [], shifts: [], alerts: [], spik: null };
  const emptyShelves: HomeShelves = { freshProducts: [], hiring: [], boat: null, story: null, spik: null };
  const accountP = getAccount();
  // Regular activities for the "What's happening" tabs: anonymous, one listing read + one rules read, kept for two minutes. Started first so "New this week"
  // (which needs its genuine upcoming sessions) and "Tomorrow" can follow it without waiting for the other loaders.
  const activityP = resilient<{ rows: ListingRow[]; rules: Record<string, RuleRow[]> }>("home:activities", { ...R(120_000, 5000, 15 * 60_000), fallback: { rows: [], rules: {} }, isEmpty: (v) => v.rows.length === 0 }, () => getHomeActivities(now));
  const [data, heroImage, today, shelves, cruise, businesses, passes, services, audience, account, liveShifts, noticeBundle, forYou, pin, activityData, announcements, newCandidates, tomorrowEvents, myBusinesses, editionsFeatured] = await Promise.all([
    resilient("home:data", { ...R(60_000, 6000, 10 * 60_000), fallback: emptyData }, () => getHomeData({ legacyNotices: false, homepageOnly: true })),
    resilient("home:hero", { ...R(5 * 60_000, 3000, 60 * 60_000), fallback: DEFAULT_HERO_IMAGE }, () => getHeroImage()),
    resilient("home:today", { ...R(5 * 60_000, 4000, 30 * 60_000), fallback: null }, () => getTodaySnapshot().catch(() => null)),
    resilient("home:shelves", { ...R(120_000, 6000, 15 * 60_000), fallback: emptyShelves }, () => getHomeShelves()),
    resilient("home:cruise", { ...R(120_000, 5000, 15 * 60_000), fallback: null }, () => getCruiseHomeCard().catch(() => null)),
    resilient<Showcase>("home:businesses", { ...R(120_000, 5000, 15 * 60_000), fallback: { main: [], recent: [] } }, () => getBusinessShowcase({ surface: "home" })),
    resilient("home:passes", { ...R(120_000, 5000, 15 * 60_000), fallback: [] }, () => getActiveLocalPasses(24).catch(() => [])),
    resilient("home:services", { ...R(120_000, 5000, 15 * 60_000), fallback: [] }, () => getBookableServices({}).catch(() => [])),
    getAudience(),
    accountP,
    resilient("home:shifts", { ...R(60_000, 5000, 10 * 60_000), fallback: [] }, () => loadLiveShifts()),
    accountP.then((a) => getHomeNoticeBundle(!!a)).catch(() => ({ notices: [], scopedToMyAreas: false })),
    accountP.then((a) => (a ? getForYou(a.id).catch(() => []) : [])).catch(() => []),
    // The admin-managed pinned launch card: signed-in members only, one cached read of a one-row table.
    accountP.then((a) => (a ? getHomePin().catch(() => null) : null)).catch(() => null),
    activityP,
    // Latest from OneShetland: live announcements only (published, started, not expired); failure means the section does not appear.
    getHomeAnnouncements(),
    // New in Shetland this week: real publication dates; the pure rules (7 days, no expired content, no shelf duplicates) apply below.
    activityP.then((a) => getHomeNewCandidates(a.rows, now)).catch(() => []),
    getTomorrowEvents(now),
    // Businesses this member owns: only used to send an owner straight to their own offer manager.
    accountP.then((a) => (a ? getMyBusinesses(a.id).catch(() => []) : [])).catch(() => []),
    // Festivals and Editions strip: its own anonymous read (never cached: the database counts each showing); empty when Editions is off, nobody is booked, or the call fails.
    getFeaturedEditions("home"),
  ]);
  const homeActivities = homeActivityPlan(activityData.rows, activityData.rules, now);
  // New in Shetland this week: never a business already on the Discover shelf (no double exposure), never expired or stale content.
  const shelfIds = new Set([...businesses.main, ...businesses.recent].map((b) => b.id));
  const newPlan = planNewThisWeek(newCandidates, now.getTime(), shelfIds);
  const tomorrow = tomorrowItems(tomorrowEvents, activityData.rows.map((r) => ({ id: r.id, slug: r.slug, title: r.title, next_starts_at: r.next_starts_at, venue: r.venue, locality: r.locality })), now);
  const offersCard = offersContribution(myBusinesses);
  const work = buildWork("live", undefined, { jobs: mapLiveJobs(shelves.hiring), shifts: liveShifts }, now);
  // For you — personal, signed-in only, and only when there is something genuine to say.
  const visiting = audience === "visiting";
  const showCruise = cruiseWorthShowing(cruise, now);
  const commerce = mapLiveCommerce({ products: shelves.freshProducts, offers: data.offers, passes, services });

  const pills: { key: string; label: string; href?: string }[] = [];
  if (today?.tempC != null) pills.push({ key: "w", label: `${today.place} ${Math.round(today.tempC)}° ${describeWeather(today.weatherCode).label}` });
  if (today?.sunset) pills.push({ key: "s", label: `Sunset ${today.sunset}` });
  if (showCruise && cruise) pills.push({ key: "c", label: cruise.isToday ? `${cruise.ships_count} ${cruise.ships_count === 1 ? "ship" : "ships"} in port` : "Ship arriving soon", href: "/cruise" });
  const todaysEvents = data.events.filter((e) => isOnToday(e, now)).length;
  if (todaysEvents) pills.push({ key: "e", label: `${todaysEvents} on today`, href: "/whats-on" });

  return (
    <>
      {/* 1 · ESSENTIAL ALERT — the one reserved, urgent position (get_essential_alerts only; collapses completely when there are none).
          Precedence: this slot first; business partner_alerts are demoted to a calm strip inside the community band below. */}
      <Suspense fallback={null}><HomeEssentialAlerts account={accountP} /></Suspense>

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
          <p className="mt-4 max-w-xl text-base leading-relaxed text-white/90 sm:text-xl">What&apos;s on, who&apos;s open, who&apos;s hiring — and everything Shetland, all in one place.</p>
          <HeroActions />
          <LivePills items={pills} />
          <div className="mt-4"><AudienceChip audience={audience} compact /></div>
        </div>
      </section>

      {visiting && <section className="mx-auto max-w-6xl px-5 pt-10"><PlanDayTile wide /></section>}

      {account && (forYou.length > 0 || pin) && <ForYou name={accountName(account).split(" ")[0]} items={forYou} pin={pin} />}

      {/* 3 · NEW IN SHETLAND THIS WEEK — what was newly published (real dates; hides itself in a quiet week) */}
      <NewThisWeek plan={newPlan} now={now.getTime()} />

      {/* 4 · WHAT'S HAPPENING — what is coming up, with tomorrow's preview and the add-an-event invitation (only when the front door is on) */}
      <RightNow
        events={data.events} cruise={cruise} showCruise={showCruise} lead={commerce.experiences[0]} activities={homeActivities}
        header={<Heading eyebrow="Coming up" title="What's happening" color="#d4921a" />}
        footer={<>
          <TomorrowStrip date={tomorrowWindow(now).label} items={tomorrow} />
          {entryPointsEnabled() && (
            <div className="mt-8"><ContributeCard id="c-events" color="#9a6409" icon="calendar" title="Got something happening?" body={ADD_EVENT_SHORT_DESC} note="Our team checks independent events before they appear." actions={[{ label: ADD_EVENT_LABEL, href: ADD_EVENT_HREF, primary: true }]} /></div>
          )}
        </>}
      />

      {/* 4b · FESTIVALS AND EDITIONS — a labelled, promoted strip of at most three; collapses when empty. Separate from every business placement below. */}
      <EditionsStrip items={editionsFeatured} />

      {/* 5 · LATEST FROM ONESHETLAND — admin-managed (Admin → Announcements) */}
      <LatestEditorial items={announcements} />

      {/* 6 · DISCOVER SOMETHING LOCAL — paid placement, rotation and Recently joined are unchanged */}
      <DiscoverLocal businesses={businesses.main} recent={businesses.recent} />
      {/* The one business invitation (it replaces the old "Is your business on OneShetland?" band: same two journeys, same links). */}
      <div className="mx-auto max-w-6xl px-5 pb-2 pt-7"><ContributeCard id="c-business" color="#6d28d9" icon="shop" title="Is your business on OneShetland?" body="Already listed? Claim it and take control of your details. Not listed yet? Add it for free, so folk across Shetland can find you." actions={[{ label: "Claim your business", href: JOIN_CLAIM_HREF }, { label: "Add your business, free", href: JOIN_ADD_HREF, primary: true }]} /></div>

      {/* 5 · SHOP · OFFERS · BOOK · EXPERIENCES */}
      <CommerceGateway commerce={commerce} footer={offersCard && (
        <div className="mx-auto mt-8 max-w-6xl px-5 pb-10"><ContributeCard id="c-offers" color="#b45309" icon="offer" title={offersCard.title} body={offersCard.body} note={offersCard.note} actions={[{ label: offersCard.label, href: offersCard.href, primary: true }]} /></div>
      )} />

      {/* 6 · WORK */}
      <HomeWork work={work} now={now} footer={<div className="mt-8"><ContributeCard id="c-work" color="#1f7a4d" icon="work" title="Looking for someone?" body="Post a job or a shift. It is free to post, and you manage applicants in one place." actions={[{ label: "Post a shift", href: "/shifts/new" }, { label: "Post a job", href: "/jobs/new", primary: true }]} /></div>} />

      {/* 6b · GET IT DONE — static, honest entry for residents and trades */}
      <GetItDoneHome />

      {/* 7 · ISLAND LIFE */}
      <IslandMosaic boat={shelves.boat} story={shelves.story} spik={shelves.spik} game={getTodaysGame()} />

      {/* 8 · COMMUNITY */}
      <CommunityV2 notices={noticeBundle.notices} campaigns={data.campaigns} partnerAlerts={data.alerts} footer={<div className="mt-8"><ContributeCard id="c-notices" color="#6b47bf" icon="notice" title="Something the community should know?" body="Tell your neighbours about something that matters locally." note="Our team reads every notice before it appears." actions={[{ label: "Post a notice", href: "/notices/post", primary: true }]} /></div>} />

      {/* 9 · EXPLORE */}
      <ExploreV2 />
    </>
  );
}

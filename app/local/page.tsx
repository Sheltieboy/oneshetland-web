import { getHomeData } from "@/lib/home-data";
import { getHomeShelves } from "@/lib/home-shelves";
import { getCuratedBusinesses } from "@/lib/curated-businesses";
import { getActiveLocalPasses, getBookableServices, SHETLAND_AREAS } from "@/lib/local-data";
import { mapLiveCommerce } from "@/lib/preview-v2";
import { publicClient } from "@/lib/supabase/public";
import { buildWork } from "@/lib/preview-work";
import { loadLiveShifts, mapLiveJobs } from "@/lib/preview-work-live";
import { LocalWork } from "@/components/preview/v2/WorkV2";
import { getLocalFeed, getNoticeBroadcastState } from "@/lib/local-data";
import { getAccount } from "@/lib/auth";
import { NoticeBroadcast } from "@/components/notices/NoticeBroadcast";
import { LocalHero, SixPillars, GoodLocally, PillarBand, RewardsPanel, BusinessesCurated, ForBusinesses } from "@/components/preview/v2/LocalV2";

export const dynamic = "force-dynamic";
export const metadata = { title: "Local" };

/**
 * Local — Shetland's local economy (the approved Local V2 design): six permanent pillars, Featured locally, the
 * commerce sections, Rewards, Work and a call to businesses. LIVE data only, read through the public (anonymous) client,
 * so a test/acceptance fixture can never reach this page. ?area=<key> narrows Featured locally and Book.
 */
export default async function LocalPage({ searchParams }: { searchParams: Promise<{ area?: string }> }) {
  const sp = await searchParams;
  const areaKey = SHETLAND_AREAS.find((a) => a.key === sp.area)?.key;
  const areaLabel = SHETLAND_AREAS.find((a) => a.key === areaKey)?.label;
  const [data, shelves, businesses, passes, services, count, feed, account] = await Promise.all([
    getHomeData(),
    getHomeShelves(),
    getCuratedBusinesses({ limit: 8, areaLabel }),
    getActiveLocalPasses(24).catch(() => []),
    getBookableServices({ area: areaKey }).catch(() => []),
    publicClient().from("local_businesses").select("id", { count: "exact", head: true }).eq("is_active", true).then((r) => r.count ?? 0, () => 0),
    getLocalFeed(areaKey),
    getAccount(),
  ]);
  const commerce = mapLiveCommerce({ products: shelves.freshProducts, offers: data.offers, passes, services });
  const now = new Date();
  const work = buildWork("live", undefined, { jobs: mapLiveJobs(shelves.hiring), shifts: await loadLiveShifts() }, now);
  // Urgent notices stay visible here, and only a platform admin gets the island-wide broadcast control.
  const urgent = feed.notices.filter((n) => n.severity === "urgent");
  const isAdmin = account?.profile?.role === "admin";
  const broadcastState = isAdmin && urgent.length ? await getNoticeBroadcastState(urgent.map((n) => n.id)) : {};

  return (
    <>
      <LocalHero areaKey={areaKey} base="/local" />
      <SixPillars commerce={commerce} businessCount={Math.floor(count / 50) * 50} />
      {urgent.length > 0 && (
        <section className="mx-auto max-w-6xl px-5 pt-8">
          <div className="space-y-3">
            {urgent.map((n) => (
              <div key={n.id} className="rounded-2xl border border-rose-200 bg-rose-50 p-5">
                <p className="text-[10px] font-black tracking-wide text-rose-600">URGENT{n.hub ? ` · ${n.hub.name}` : ""}</p>
                <p className="mt-1 font-display font-bold leading-snug text-ink">{n.title}</p>
                {n.body && <p className="mt-1.5 line-clamp-3 text-sm text-ink-soft">{n.body}</p>}
                {isAdmin && <NoticeBroadcast noticeId={n.id} title={n.title} broadcastAt={broadcastState[n.id] ?? null} />}
              </div>
            ))}
          </div>
        </section>
      )}
      <GoodLocally businesses={businesses} commerce={commerce} />
      <PillarBand pillar="shop" items={commerce.shop} />
      <PillarBand pillar="offers" items={commerce.offers} />
      <PillarBand pillar="book" items={commerce.book} />
      <PillarBand pillar="experiences" items={commerce.experiences} />
      <RewardsPanel />
      <BusinessesCurated businesses={businesses} />
      <LocalWork work={work} now={now} />
      <ForBusinesses />
    </>
  );
}

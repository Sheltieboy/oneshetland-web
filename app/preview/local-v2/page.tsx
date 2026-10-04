import type { Metadata } from "next";
import { getHomeData } from "@/lib/home-data";
import { getHomeShelves } from "@/lib/home-shelves";
import { getCuratedBusinesses } from "@/lib/curated-businesses";
import { getActiveLocalPasses, getBookableServices, SHETLAND_AREAS } from "@/lib/local-data";
import { buildCommerce, mapLiveCommerce, parsePreview } from "@/lib/preview-v2";
import { publicClient } from "@/lib/supabase/public";
import { buildWork, parseMix } from "@/lib/preview-work";
import { loadLiveShifts, mapLiveJobs } from "@/lib/preview-work-live";
import { LocalWork } from "@/components/preview/v2/WorkV2";
import { PreviewBar } from "@/components/preview/v2/PreviewBar";
import { LocalHero, SixPillars, GoodLocally, PillarBand, RewardsPanel, BusinessesCurated, ForBusinesses } from "@/components/preview/v2/LocalV2";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Local V2 (design preview)", robots: { index: false, follow: false } };

/**
 * Local V2 — DESIGN PREVIEW. Not linked from anywhere, not indexed, and nothing here replaces `/local`.
 * ?state=live|empty|seed|full  ?as=public|admin  ?area=<area key>
 */
export default async function LocalV2({ searchParams }: { searchParams: Promise<{ state?: string; as?: string; area?: string; work?: string }> }) {
  const sp = await searchParams;
  const { state, viewer } = parsePreview(sp);
  const areaKey = SHETLAND_AREAS.find((a) => a.key === sp.area)?.key;
  const areaLabel = SHETLAND_AREAS.find((a) => a.key === areaKey)?.label;
  const [data, shelves, businesses, passes, services, count] = await Promise.all([
    getHomeData(),
    getHomeShelves(),
    getCuratedBusinesses({ limit: 8, areaLabel }),
    getActiveLocalPasses(24).catch(() => []),
    getBookableServices({ area: areaKey }).catch(() => []),
    publicClient().from("local_businesses").select("id", { count: "exact", head: true }).eq("is_active", true).then((r) => r.count ?? 0, () => 0),
  ]);
  const commerce = buildCommerce(state, viewer, mapLiveCommerce({ products: shelves.freshProducts, offers: data.offers, passes, services }));
  const now = new Date();
  const work = buildWork(state, parseMix(sp.work), { jobs: mapLiveJobs(shelves.hiring), shifts: state === "live" ? await loadLiveShifts() : [] }, now);
  const base = `/preview/local-v2?state=${state}&as=${viewer}`;

  return (
    <>
      <PreviewBar route="/preview/local-v2" state={state} viewer={viewer} other={{ label: "Home V2", href: "/preview/home-v2" }} />
      <LocalHero areaKey={areaKey} base={base} />
      <SixPillars commerce={commerce} businessCount={Math.floor(count / 50) * 50} />
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

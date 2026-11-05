/**
 * home-notices.ts — what the homepage shows from the Notices & Alerts system, composed in one place.
 *
 * Precedence (one coherent rule; mirrored in app/page.tsx):
 *   1. Essential Alert slot: the very top of the page, ONLY get_essential_alerts, red/urgent styling used nowhere else. Collapses to nothing when empty.
 *   2. Community band: a calm "Update from <business>" strip for business partner_alerts (never the top, never red), then up to six equal notice cards
 *      from get_public_notices('all') that EXCLUDE every active essential alert (they live in the slot and are never shown twice), then fundraisers.
 * A signed-in member with chosen areas gets their areas applied to both; a visitor, or a member with none chosen, gets everything (a null argument -
 * NOT the empty list, which would mean Shetland-wide only). A failed read hides that block; it never breaks the homepage.
 */
import { getEssentialAlerts, getMyAreas, getPublicNotices } from "./notices-data";
import { resilient } from "./home-resilience";
import { composeHomeNotices, memberBrowseScope, rpcAreaArg, type NoticeCardModel } from "./notices-alerts";

export type HomeNoticeBundle = { essential: NoticeCardModel[]; notices: NoticeCardModel[]; scopedToMyAreas: boolean };

export async function getHomeNoticeBundle(signedIn: boolean): Promise<HomeNoticeBundle> {
  const scope = memberBrowseScope(signedIn ? await getMyAreas() : null);
  const arg = rpcAreaArg(scope);
  // Essential alerts are never cached: fresh every time, but bounded so a slow database cannot hold the page (the slot then collapses, as it does for "none").
  // The ordinary notice list is shared public data, so for a visitor with no chosen areas it is kept for 30 s; a member's area-scoped list is never kept.
  const publicList = !signedIn || scope.mode !== "areas";
  const [ess, all] = await Promise.all([
    resilient("home:essential:" + JSON.stringify(arg), { ttlMs: 0, staleMs: 0, deadlineMs: 5000, fallback: null }, () => getEssentialAlerts(arg).catch(() => null)),
    // Up to 10 essential alerts sort first; ask for enough that six non-essential cards remain after they are excluded.
    resilient("home:notices:" + JSON.stringify(arg), { ttlMs: publicList ? 30_000 : 0, staleMs: publicList ? 5 * 60_000 : 0, deadlineMs: 5000, fallback: null, isEmpty: (v) => !v || !v.ok || v.data.length === 0 },
      () => getPublicNotices({ level: "all", areaIds: arg, limit: 20 }).catch(() => null)),
  ]);
  const essential = ess && ess.ok ? ess.data : [];
  const notices = all && all.ok ? composeHomeNotices(all.data, essential.map((e) => e.id)) : [];
  return { essential, notices, scopedToMyAreas: scope.mode === "areas" };
}

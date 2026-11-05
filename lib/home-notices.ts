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
import { cache } from "react";
import { getEssentialAlerts, getMyAreas, getPublicNotices } from "./notices-data";
import { resilient } from "./home-resilience";
import { essentialState, type HomeEssential } from "./home-essential.ts";
import { composeHomeNotices, memberBrowseScope, rpcAreaArg, type NoticeCardModel } from "./notices-alerts";

export type HomeNoticeBundle = { notices: NoticeCardModel[]; scopedToMyAreas: boolean };

/** One scope lookup per request, shared by the alert slot and the notice grid (a visitor needs no lookup at all). */
const scopeFor = cache(async (signedIn: boolean) => memberBrowseScope(signedIn ? await getMyAreas() : null));

/**
 * Essential alerts: NEVER kept (fresh on every request), bounded at 3 s. A timeout is reported as "unavailable", not as "none".
 * Rendered in its own Suspense boundary so a slow check cannot hold up the rest of the homepage.
 */
export async function getHomeEssential(signedIn: boolean): Promise<HomeEssential> {
  const scope = await scopeFor(signedIn).catch(() => memberBrowseScope(null));
  const arg = rpcAreaArg(scope);
  const r = await resilient("home:essential:" + JSON.stringify(arg), { ttlMs: 0, staleMs: 0, deadlineMs: 3000, fallback: null }, () => getEssentialAlerts(arg).catch(() => null));
  return essentialState(r, scope.mode === "areas");
}

/** The ordinary notice grid. Active essential alerts are excluded by their own flag (they live in the top slot, never twice). */
export async function getHomeNoticeBundle(signedIn: boolean): Promise<HomeNoticeBundle> {
  const scope = await scopeFor(signedIn);
  const arg = rpcAreaArg(scope);
  // The list is shared public data, so for a visitor with no chosen areas it is kept for 30 s; a member's area-scoped list is never kept.
  const publicList = !signedIn || scope.mode !== "areas";
  const all = await resilient("home:notices:" + JSON.stringify(arg), { ttlMs: publicList ? 30_000 : 0, staleMs: publicList ? 5 * 60_000 : 0, deadlineMs: 5000, fallback: null, isEmpty: (v) => !v || !v.ok || v.data.length === 0 },
    // Up to 10 essential alerts sort first; ask for enough that six non-essential cards remain after they are excluded.
    () => getPublicNotices({ level: "all", areaIds: arg, limit: 20 }).catch(() => null));
  const notices = all && all.ok ? composeHomeNotices(all.data) : [];
  return { notices, scopedToMyAreas: scope.mode === "areas" };
}

import { publicClient } from "./supabase/public";

/**
 * curated-businesses.ts — "Discover local businesses": a short, genuine shelf of businesses, plus a small "Recently joined" strip.
 *
 * WHO IS SHOWN, in order of authority:
 *   1. PREMIUM, RESERVED. The plan promises "a featured spot on the OneShetland home screen" to Premium, so up to PREMIUM_RESERVED
 *      slots go to businesses that are Premium RIGHT NOW (live_tier, from business_meets_tier — a launch grant counts as the tier it
 *      granted; a lapsed or end-dateless plan counts as nothing). When more Premium businesses qualify than there are slots they
 *      take turns (rotate), so none is permanently shut out and none is permanently first.
 *   2. EVERYONE ELSE, by score, dealt one category at a time (café, shop, service, stay, …) so the shelf is not eight banks.
 *      Pro keeps its scoring advantage here but has NO guaranteed slot (that is not part of the Pro promise). A Premium business
 *      that did not hold a reserved slot this turn competes here with the same paid weight as Pro (never less, so a cheaper plan
 *      cannot outrank it, and never more, so the extra Premium businesses do not crowd out the rotation). No more than
 *      PAID_SHELF_MAX cards on the shelf may be paid, so the shelf stays a genuine mix.
 *
 * THE SCORE (higher is better): live Premium 200, live Pro 150, claimed 40, logo 30, a real description 15, verified 10, cover 10,
 * phone 5, website 5. Ties go to the newest listing. "Paid" is the entitlement the business HAS (live_tier), never the recorded
 * plan alone.
 *
 * EXCLUDED BY AN ADMINISTRATOR (homepage_excluded): on the HOMEPAGE surface only ({ surface: "home" }), the business appears in neither the
 * shelf nor the strip. The Local landing page and every other caller use the default "local" surface, which ignores the flag, so a
 * business kept off the homepage is still shown wherever else it qualifies. The flag changes nothing else: the business keeps its plan
 * and every benefit of it, and its Directory position (those do not read it).
 *
 * OPENING HOURS DO NOT AFFECT THIS SHELF, and the heading no longer implies they do.
 *
 * RECENTLY JOINED (up to RECENT_LIMIT): businesses that became owner-managed in the last RECENT_DAYS, by an approved claim OR by being
 * created by their owner — both set owner_activated_at, so they are treated identically. Listings must be reasonably complete to
 * show. Anyone already on the main shelf is left out (no double exposure). If more qualify than fit, they take turns. It is computed
 * from the SAME rows as the shelf: no extra query, no extra load. Nothing to show means the strip is simply absent.
 *
 * ONE READ, NO ARBITRARY CAP. This used to read an unordered .limit(300) of the commercial listings, so which 300 were even
 * considered was up to the database. It now reads every public commercial listing in a fixed order (up to the PostgREST ceiling,
 * with a warning if that is ever reached), and the page keeps the result for a couple of minutes.
 *
 *   • COMMERCIAL categories only: food & drink, retail, services, accommodation. Heritage points of interest stay in the Directory.
 *   • One card per trading name (the directory has the same business from several sources).
 *   • Test fixtures never reach this list: the database withholds them from public reads, so there is nothing to filter here.
 */

export const COMMERCIAL_CATEGORIES = ["food_drink", "retail", "services", "accommodation"] as const;

/** How many cards the homepage actually shows (one lead + five tiles). */
export const HOME_SHELF = 6;
/** Of those, how many are held for live Premium businesses. */
export const PREMIUM_RESERVED = 2;
/** The most cards that may be paid (Premium or Pro) on the shelf, reserved ones included, so a free local business always has a place. */
export const PAID_SHELF_MAX = 4;
export const RECENT_LIMIT = 3;
export const RECENT_DAYS = 30;
/** Rotation period: long enough to feel stable and cache-friendly, short enough that every Premium business gets its turn. */
export const ROTATION_MS = 6 * 60 * 60 * 1000;
/** PostgREST returns at most this many rows per request. */
export const READ_CEILING = 1000;

export type LiveTier = "premium" | "pro" | "free";

export type CuratedBusiness = {
  id: string;
  name: string;
  category: string | null;
  description: string | null;
  logo_url: string | null;
  cover_url: string | null;
  slug: string | null;
  subscription_tier: string;
  is_claimed: boolean;
  is_verified: boolean;
  address: string | null;
};

export type CuratedRow = CuratedBusiness & {
  /** The plan the business is entitled to right now (database: business_meets_tier). */
  live_tier: LiveTier;
  /** When it became owner-managed (approved claim or created by its owner). NULL = unowned. */
  owner_activated_at: string | null;
  /** An administrator has asked for this business to be kept out of the homepage showcase (it changes nothing else about it). */
  homepage_excluded?: boolean;
  phone: string | null;
  website: string | null;
  created_at: string | null;
};

const COLS =
  "id, name, category, description, logo_url, cover_url, slug, subscription_tier, live_tier, owner_activated_at, homepage_excluded, is_claimed, is_verified, address, phone, website, created_at";

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "");

/** Higher is better. Exported so the weighting is testable and visible. */
export function businessScore(b: CuratedRow): number {
  return (
    (b.live_tier === "premium" ? 200 : b.live_tier === "pro" ? 150 : 0) +   // the entitlement the business HAS, not the plan it records
    (b.is_claimed ? 40 : 0) +
    (b.is_verified ? 10 : 0) +
    (b.logo_url ? 30 : 0) +
    (b.cover_url ? 10 : 0) +
    ((b.description?.trim().length ?? 0) >= 40 ? 15 : 0) +
    (b.phone ? 5 : 0) +
    (b.website ? 5 : 0)
  );
}

/** Which rotation turn it is. Changes every ROTATION_MS. */
export const rotationBucket = (now: Date): number => Math.floor(now.getTime() / ROTATION_MS);

/**
 * Fair rotation: `k` items from `list`, a window that advances by `k` each turn, around a STABLE order (by id). Over n/gcd turns every
 * item gets the same number of appearances; with k >= n everything shows. Pure, so it is testable and needs no stored state.
 */
export function rotate<T extends { id: string }>(list: T[], bucket: number, k: number): T[] {
  const n = list.length;
  if (n === 0 || k <= 0) return [];
  const ordered = [...list].sort((a, b) => a.id.localeCompare(b.id));
  if (k >= n) return ordered;
  const start = ((bucket * k) % n + n) % n;
  return Array.from({ length: k }, (_, i) => ordered[(start + i) % n]);
}

const toCard = (b: CuratedRow): CuratedBusiness => ({
  id: b.id, name: b.name, category: b.category, description: b.description, logo_url: b.logo_url, cover_url: b.cover_url,
  slug: b.slug, subscription_tier: b.subscription_tier, is_claimed: b.is_claimed, is_verified: b.is_verified, address: b.address,
});

const isCommercial = (b: CuratedRow) => !!b.name?.trim() && (COMMERCIAL_CATEGORIES as readonly string[]).includes(b.category ?? "");

/** Pure: commercial listings, best first, one per trading name. */
export function rankBusinesses(rows: CuratedRow[], honourHomepageExclusion = false): CuratedRow[] {
  const scored = rows
    .filter((b) => isCommercial(b) && !(honourHomepageExclusion && b.homepage_excluded))   // an administrator's HOMEPAGE exclusion; other surfaces ignore it
    .map((b) => ({ b, s: businessScore(b) }))
    .sort((x, y) => y.s - x.s || (y.b.created_at ?? "").localeCompare(x.b.created_at ?? "") || x.b.id.localeCompare(y.b.id));
  const seen = new Set<string>();
  const unique: CuratedRow[] = [];
  for (const { b } of scored) {
    const key = norm(b.name);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    unique.push(b);
  }
  return unique;
}

/** Deal one category at a time, but let at most `paidMax` paid (Pro or Premium) cards in; further paid ones are skipped, never reordered. */
function dealCapped(list: CuratedRow[], take: number, paidMax: number): CuratedRow[] {
  const order = ["food_drink", "retail", "services", "accommodation"];
  const lanes = order.map((c) => list.filter((b) => b.category === c));
  const out: CuratedRow[] = [];
  const idx = lanes.map(() => 0);
  let paid = 0;
  for (let progressed = true; out.length < take && progressed; ) {
    progressed = false;
    for (let l = 0; l < lanes.length && out.length < take; l++) {
      while (idx[l] < lanes[l].length) {
        const b = lanes[l][idx[l]++];
        const isPaid = b.live_tier !== "free";
        if (isPaid && paid >= paidMax) continue;   // over the paid cap: skip this one, try the next in the lane
        if (isPaid) paid += 1;
        out.push(b);
        progressed = true;
        break;
      }
    }
  }
  return out;
}

/** Complete enough to show a stranger: a real description, a picture, and a way to get in touch. */
export function isShowable(b: CuratedRow): boolean {
  return (b.description?.trim().length ?? 0) >= 40 && !!(b.logo_url || b.cover_url) && !!(b.phone || b.website);
}

/** Within the last `days` days (and not in the future). */
export function isRecentlyJoined(b: CuratedRow, now: Date, days = RECENT_DAYS): boolean {
  if (!b.owner_activated_at) return false;
  const t = new Date(b.owner_activated_at).getTime();
  return Number.isFinite(t) && t <= now.getTime() && now.getTime() - t <= days * 86_400_000;
}

/** Where the shelf is for. "home" honours an administrator's homepage exclusion; "local" (the default) does not. */
export type ShowcaseSurface = "home" | "local";

export type Showcase = { main: CuratedBusiness[]; recent: CuratedBusiness[] };

/** Pure: the main shelf (reserved Premium first, then the rest by score) and the Recently joined strip (no overlap, no repeated names). */
export function buildShowcase(
  rows: CuratedRow[],
  now: Date,
  opts: { limit?: number; reserved?: number; recentLimit?: number; paidMax?: number; surface?: ShowcaseSurface } = {},
): Showcase {
  const limit = opts.limit ?? HOME_SHELF;
  const reserved = Math.max(0, Math.min(opts.reserved ?? PREMIUM_RESERVED, limit));
  const recentLimit = opts.recentLimit ?? RECENT_LIMIT;
  const paidMax = opts.paidMax ?? PAID_SHELF_MAX;
  const honour = (opts.surface ?? "local") === "home";
  const bucket = rotationBucket(now);

  const ranked = rankBusinesses(rows, honour);
  const premium = ranked.filter((b) => b.live_tier === "premium");
  const held = rotate(premium, bucket, Math.min(reserved, premium.length));
  const heldIds = new Set(held.map((b) => b.id));
  // Everyone not holding a reserved slot competes on the shelf on equal paid footing: a Premium business is weighed as Pro here.
  const contenders = rankBusinesses(ranked.filter((b) => !heldIds.has(b.id)).map((b) => (b.live_tier === "premium" ? { ...b, live_tier: "pro" as const } : b)), honour);
  const rest = dealCapped(contenders, Math.max(0, limit - held.length), Math.max(0, paidMax - held.length));
  const mainRows = [...held, ...rest];
  const shown = new Set(mainRows.map((b) => b.id));
  const shownNames = new Set(mainRows.map((b) => norm(b.name)));

  const pool = ranked.filter((b) => !shown.has(b.id) && !shownNames.has(norm(b.name)) && isRecentlyJoined(b, now) && isShowable(b));
  const recent = (pool.length > recentLimit ? rotate(pool, bucket, recentLimit) : pool)
    .sort((a, b) => (b.owner_activated_at ?? "").localeCompare(a.owner_activated_at ?? "") || a.id.localeCompare(b.id));

  return { main: mainRows.map(toCard), recent: recent.map(toCard) };
}

/** `areaLabel`, when given, narrows to businesses whose address names that area (the same rule the Directory uses). */
export async function getBusinessShowcase(opts: { limit?: number; areaLabel?: string; reserved?: number; surface?: ShowcaseSurface } = {}): Promise<Showcase> {
  try {
    let q = publicClient()
      .from("local_businesses_public")
      .select(COLS)
      .eq("is_active", true)
      .in("category", [...COMMERCIAL_CATEGORIES])
      .order("id", { ascending: true })
      .limit(READ_CEILING);
    if (opts.areaLabel) q = q.ilike("address", `%${opts.areaLabel}%`);
    const { data, error } = await q;
    if (error) throw error;
    const rows = (data ?? []) as unknown as CuratedRow[];
    if (rows.length >= READ_CEILING) console.warn("[curated-businesses] read ceiling reached; some listings were not considered");
    return buildShowcase(rows, new Date(), { limit: opts.limit, reserved: opts.reserved, surface: opts.surface });
  } catch {
    return { main: [], recent: [] };
  }
}

/** The main shelf only, for the Local page and previews: the "local" surface, which does NOT apply the homepage exclusion. */
export async function getCuratedBusinesses(opts: { limit?: number; areaLabel?: string } = {}): Promise<CuratedBusiness[]> {
  return (await getBusinessShowcase({ ...opts, surface: "local" })).main;
}

/** How many products are genuinely on sale. Test fixtures are withheld by the database, so this is the public count. */
export async function countShopProducts(): Promise<number> {
  try {
    const { count } = await publicClient()
      .from("products")
      .select("id", { count: "exact", head: true })
      .eq("is_active", true)
      .is("sold_at", null);
    return count ?? 0;
  } catch {
    return 0;
  }
}

/**
 * Newly owner-managed businesses for "New in Shetland this week": the SAME eligibility as the Recently joined strip (commercial categories, the
 * administrator's homepage exclusion honoured, reasonably complete, one card per trading name), over the last `days` days, newest first. Ordering
 * ignores subscription tier entirely, so this can neither sell nor hide commercial placement. The caller skips any id already on the Discover shelf.
 */
export async function getNewBusinessCandidates(days = 7, now: Date = new Date()): Promise<CuratedBusiness[]> {
  try {
    const cutoff = new Date(now.getTime() - days * 86_400_000).toISOString();
    const { data, error } = await publicClient()
      .from("local_businesses_public")
      .select(COLS)
      .eq("is_active", true)
      .in("category", [...COMMERCIAL_CATEGORIES])
      .gte("owner_activated_at", cutoff)
      .order("owner_activated_at", { ascending: false })
      .limit(40);
    if (error) throw error;
    const seen = new Set<string>();
    const out: (CuratedBusiness & { owner_activated_at: string })[] = [];
    for (const b of (data ?? []) as unknown as CuratedRow[]) {
      if (!isCommercial(b) || b.homepage_excluded || !isShowable(b) || !isRecentlyJoined(b, now, days)) continue;
      const key = norm(b.name);
      if (!key || seen.has(key)) continue;
      seen.add(key);
      out.push({ ...toCard(b), owner_activated_at: b.owner_activated_at as string });
    }
    return out;
  } catch {
    return [];
  }
}

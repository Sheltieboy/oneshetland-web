/** The Business Spotlight rotation snapshot the composer leaves for administrators (admin_config 'social.spotlight_pool'). Parsed defensively: it is data, not code. */
export type SpotlightRank = { id: string; name: string; lane: "welcome" | "new" | "rotation"; claimedAt: string | null; lastPostedAt: string | null; sensitive: boolean };
export type SpotlightExcluded = { id: string; name: string; reason: string; until?: string | null };
export type SpotlightReport = {
  at: string; streak: number; order: SpotlightRank[]; excluded: SpotlightExcluded[];
  counts: { pool: number; eligible: number; welcome: number; new: number; rotation: number; excluded: number };
  recent: { id: string; name: string; status: string; when: string }[];
};

const str = (v: unknown, max = 200) => (typeof v === "string" ? v.slice(0, max) : "");
type Obj = Record<string, unknown>;
const numOf = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : 0);

export function parseSpotlightReport(raw: unknown): SpotlightReport | null {
  if (typeof raw !== "string" || raw.length > 400_000) return null;
  let j: unknown; try { j = JSON.parse(raw); } catch { return null; }
  if (!j || typeof j !== "object" || Array.isArray(j)) return null;
  const o = j as Record<string, unknown>; const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
  const lane = (v: unknown): SpotlightRank["lane"] => (v === "welcome" || v === "rotation" ? v : "new");
  const c = (o.counts && typeof o.counts === "object" ? o.counts : {}) as Record<string, unknown>;
  return {
    at: str(o.at, 40), streak: numOf(o.streak),
    order: (arr(o.order) as Obj[]).map((r) => r ?? {}).slice(0, 60).map((r) => ({ id: str(r.id, 64), name: str(r.name), lane: lane(r.lane), claimedAt: r.claimedAt ? str(r.claimedAt, 40) : null, lastPostedAt: r.lastPostedAt ? str(r.lastPostedAt, 40) : null, sensitive: r.sensitive === true })),
    excluded: (arr(o.excluded) as Obj[]).map((r) => r ?? {}).slice(0, 100).map((r) => ({ id: str(r.id, 64), name: str(r.name), reason: str(r.reason, 120), until: r.until ? str(r.until, 20) : null })),
    counts: { pool: numOf(c.pool), eligible: numOf(c.eligible), welcome: numOf(c.welcome), new: numOf(c.new), rotation: numOf(c.rotation), excluded: numOf(c.excluded) },
    recent: (arr(o.recent) as Obj[]).map((r) => r ?? {}).slice(0, 20).map((r) => ({ id: str(r.id, 64), name: str(r.name), status: str(r.status, 20), when: str(r.when, 40) })),
  };
}

export const LANE_LABEL: Record<SpotlightRank["lane"], string> = { welcome: "Welcome (claimed in the last 14 days)", new: "Never featured", rotation: "Back in rotation (90 days passed)" };

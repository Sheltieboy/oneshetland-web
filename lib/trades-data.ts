import { publicClient } from "@/lib/supabase/public";
import {
  effectiveAvailability, type Availability, type Scale, type TradeKey, type Urgency,
} from "@/lib/trades";
import { haversineKm } from "@/lib/planner";

/**
 * Finding the trades who could actually take a job on.
 *
 * The ordering here IS the product, so it's worth being explicit about what it
 * deliberately does not do.
 *
 * It does not rank by who pays. A paid tier moves a business up only between
 * two who are otherwise equal — it can never lift a booked-up firm above one
 * with room. Selling position would rebuild the exact concentration this is
 * meant to break: the busiest firms are the ones who can afford Premium, and
 * charging them for the advantage they already have helps nobody who is
 * standing in a wet kitchen trying to find a joiner.
 *
 * It ranks by ROOM first, then by whether they actually answer. Both are facts
 * about the trade's usefulness to this person today, and both are earned.
 */

export type TradeMatch = {
  id: string;
  name: string;
  slug: string | null;
  logo: string | null;
  availability: Availability | null;
  trades: string[];
  credentials: string[];
  minJobPence: number | null;
  distanceKm: number | null;
  /** 0-1, over their last briefs. Null when they've had none yet. */
  responseRate: number | null;
  tier: string;
  score: number;
};

type Row = Record<string, unknown>;

const AVAILABILITY_SCORE: Record<Availability, number> = {
  now: 100,
  weeks: 80,
  months: 40,
  emergency: 10,   // only useful if the job IS an emergency — handled below
  booked_up: -1000, // never matched; kept explicit rather than filtered silently
};

const TIER_NUDGE: Record<string, number> = { premium: 6, pro: 3, free: 0 };

/**
 * Score a business against a brief.
 *
 * Returns null when they shouldn't hear about it at all — wrong trade, booked
 * up, or the job is below the smallest they'll travel for. A brief that can't
 * be done is not a lead, it's noise, and noise is how a trade learns to ignore
 * the notifications.
 */
function scoreFor(
  b: Row,
  brief: { trades: TradeKey[]; urgency: Urgency; scale: Scale; lat?: number | null; lng?: number | null },
): TradeMatch | null {
  const trades = (b.trade_categories as string[] | null) ?? [];
  if (trades.length === 0) return null;
  if (!brief.trades.some((t) => trades.includes(t))) return null;

  const availability = effectiveAvailability(
    b.trade_availability as string | null,
    b.trade_availability_set_at as string | null,
  );

  // Booked up means booked up. Emergencies-only hears about emergencies.
  if (availability === "booked_up") return null;
  if (availability === "emergency" && brief.urgency !== "emergency") return null;

  /* A wee job below their minimum is a wasted call for both sides. Only
     filtered where we can be reasonably sure — an unsized job always goes. */
  const minJob = (b.trade_min_job_pence as number | null) ?? null;
  if (minJob && minJob > 20000 && brief.scale === "small") return null;

  let score = availability ? AVAILABILITY_SCORE[availability] : 20; // hasn't said: below anyone who has
  if (availability === "emergency" && brief.urgency === "emergency") score = 95;

  // How many of the needed trades they cover — one firm doing all three beats
  // three separate calls, and people want that.
  const covered = brief.trades.filter((t) => trades.includes(t)).length;
  score += covered * 4;

  // Answering is the behaviour worth rewarding, in either direction: a fast no
  // is a service. Ignoring briefs is what makes this useless.
  const sent = (b.__sent as number) ?? 0;
  const answered = (b.__answered as number) ?? 0;
  const responseRate = sent > 0 ? answered / sent : null;
  if (responseRate !== null) score += Math.round(responseRate * 25);

  let distanceKm: number | null = null;
  if (brief.lat != null && brief.lng != null && b.lat != null && b.lng != null) {
    distanceKm = haversineKm(
      { lat: brief.lat, lng: brief.lng },
      { lat: Number(b.lat), lng: Number(b.lng) },
    );
    // Shetland is small; distance is a nudge, not a gate. Somebody in Lerwick
    // will happily go to Sandwick and might go to Unst for a big enough job.
    score -= Math.min(distanceKm / 8, 12);
  }

  // Tie-break only, and small enough that it can never outrank having room.
  score += TIER_NUDGE[(b.subscription_tier as string) ?? "free"] ?? 0;

  return {
    id: b.id as string,
    name: b.name as string,
    slug: (b.slug as string | null) ?? null,
    logo: (b.logo_url as string | null) ?? null,
    availability,
    trades,
    credentials: (b.trade_credentials as string[] | null) ?? [],
    minJobPence: minJob,
    distanceKm,
    responseRate,
    tier: (b.subscription_tier as string) ?? "free",
    score: Math.round(score),
  };
}

/**
 * Trades who could take this on, best first.
 *
 * Used two ways: live under the brief form as somebody types (so they can see
 * straight away whether anyone can help, which is the honest answer they've
 * never had), and again on submit to decide who it goes to.
 */
export async function findMatches(brief: {
  trades: TradeKey[];
  urgency: Urgency;
  scale: Scale;
  lat?: number | null;
  lng?: number | null;
  limit?: number;
}): Promise<TradeMatch[]> {
  if (brief.trades.length === 0) return [];
  const sb = publicClient();

  const { data } = await sb
    .from("local_businesses")
    .select("id, name, slug, logo_url, lat, lng, subscription_tier, trade_categories, trade_availability, trade_availability_set_at, trade_min_job_pence, trade_credentials")
    .eq("is_active", true)
    .overlaps("trade_categories", brief.trades)
    .limit(200);

  const rows = (data ?? []) as Row[];
  if (rows.length === 0) return [];

  // Response rates in one query rather than one per business.
  const { data: stats } = await sb
    .from("trade_brief_matches")
    .select("business_id, status")
    .in("business_id", rows.map((r) => r.id as string));

  const sent: Record<string, number> = {};
  const answered: Record<string, number> = {};
  for (const m of (stats ?? []) as Row[]) {
    const id = m.business_id as string;
    sent[id] = (sent[id] ?? 0) + 1;
    if (m.status === "interested" || m.status === "declined") answered[id] = (answered[id] ?? 0) + 1;
  }
  rows.forEach((r) => {
    r.__sent = sent[r.id as string] ?? 0;
    r.__answered = answered[r.id as string] ?? 0;
  });

  return rows
    .map((r) => scoreFor(r, brief))
    .filter((m): m is TradeMatch => m !== null)
    .sort((a, b) => b.score - a.score)
    .slice(0, brief.limit ?? 12);
}

/* ── The waiting list ─────────────────────────────────────────────────────── */

export type DemandRow = {
  trade: string;
  waiting: number;
  unanswered: number;
  avgDaysWaiting: number;
};

/**
 * Unmet demand per trade — aggregate only, no brief exposed, readable signed
 * out.
 *
 * This is the most valuable thing the whole feature produces. "11 folk are
 * waiting for a plumber, average 3 weeks with no answer" is the pitch to every
 * trade not listed yet, the argument for apprentice places, and a story worth
 * printing. Demand is the only leverage there is on supply.
 */
export async function getTradeDemand(): Promise<DemandRow[]> {
  const sb = publicClient();
  const { data, error } = await sb.rpc("trade_demand_summary");
  if (error || !data) return [];
  return (data as Row[]).map((r) => ({
    trade: r.trade as string,
    waiting: Number(r.waiting ?? 0),
    unanswered: Number(r.unanswered ?? 0),
    avgDaysWaiting: Number(r.avg_days_waiting ?? 0),
  }));
}

/* ── Reading briefs ───────────────────────────────────────────────────────── */

/** Everything about a brief EXCEPT how to contact the person. */
export const BRIEF_PUBLIC_COLUMNS =
  "id, created_at, title, description, trades, scale, urgency, location_text, lat, lng, photos, status";

/**
 * The contact columns are never in a browse query. They're released by
 * `revealContact`, and only to a trade that has said yes.
 *
 * Kept as one constant so there is a single place to check that this rule
 * holds, rather than trusting every future select to remember it.
 */
export const BRIEF_CONTACT_COLUMNS = "contact_name, contact_phone, contact_email";

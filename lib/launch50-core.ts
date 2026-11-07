/**
 * launch50-core.ts — OneShetland Launch 50, the pure parts: types, prices, copy, error mapping and small formatters.
 * No server imports, so the page, the billing card and the tests can all use it.
 *
 * Launch 50 is a PAID commercial programme (50 places, one per business). It is not a ranking. The prices here are the totals
 * a business pays; nothing is added to them.
 */
import { TIER_PRICE_PENCE } from "./listing-tiers.ts";

export type Launch50Phase = "closed" | "claimed_only" | "open";
export type Launch50Tier = "pro" | "premium";

export type Launch50Status = {
  phase: Launch50Phase;
  places_total: number;
  places_left: number;
  opens_at: string | null;
  public_opens_at: string | null;
};
/** What we assume when the database cannot be read: the page behaves as if Launch 50 has not opened. */
export const LAUNCH50_CLOSED: Launch50Status = { phase: "closed", places_total: 50, places_left: 0, opens_at: null, public_opens_at: null };

export type Launch50PlaceStatus = "reserved" | "pending_payment" | "active" | "ended" | "released";
export type Launch50Place = {
  business_id: string;
  tier: Launch50Tier;
  status: Launch50PlaceStatus;
  reservation_expires_at: string | null;
  activated_at: string | null;
  discount_ends_at: string | null;
  showcase_opt_in: boolean;
};

export type ShowcaseMember = {
  id: string; name: string; slug: string | null; category: string | null; description: string | null;
  logo_url: string | null; cover_url: string | null; website: string | null; address: string | null;
};

/** Founding prices in pence, per month, for the first 12 months. The standard prices come from listing-tiers.ts. */
export const LAUNCH50_PRICE_PENCE: Record<Launch50Tier, number> = { pro: 900, premium: 2200 };
export const LAUNCH50_DISCOUNT_MONTHS = 12;
export const LAUNCH50_RESERVATION_MINUTES = 30;
export const LAUNCH50_NAME: Record<Launch50Tier, string> = { pro: "Founding Pro", premium: "Founding Premium" };

const pounds = (pence: number) => `£${(pence / 100).toFixed(2).replace(/\.00$/, "")}`;
export const launch50Price = (tier: Launch50Tier) => pounds(LAUNCH50_PRICE_PENCE[tier]);
export const standardPrice = (tier: Launch50Tier) => pounds(TIER_PRICE_PENCE[tier]);
/** "£9/month for 12 months, then £12/month" */
export const launch50PriceLine = (tier: Launch50Tier) =>
  `${launch50Price(tier)}/month for ${LAUNCH50_DISCOUNT_MONTHS} months, then ${standardPrice(tier)}/month`;

/** The plain statement the page must make. */
export const LAUNCH50_STATEMENT = "Launch 50 is a paid commercial programme. It is not a ranking of which businesses supported OneShetland first.";
export const LAUNCH50_SHOWCASE_NOTE = "In the order shown today, nobody ranks first.";
export const LAUNCH50_LOCKED_NOTE = "Plan changes are not available during Launch 50. You can cancel any time below.";

/* ── Friendly messages ────────────────────────────────────────────────────────────────────────────── */
export const LAUNCH50_MESSAGES = {
  closed: "OneShetland Launch 50 is not open yet.",
  not_eligible: "This listing is not eligible for Launch 50.",
  has_subscription: "This business already has a paid subscription, so it cannot join Launch 50.",
  claimed_only: "For the first 14 days, places are for businesses that already had a claimed listing.",
  already_has_place: "This business already has a Launch 50 place.",
  full: "All 50 places have been taken.",
  not_owner: "You can only do this for a business you manage.",
  signed_out: "Please sign in to continue.",
  generic: "Something went wrong. Nothing has been charged. Please try again.",
} as const;
export type Launch50ErrorCode = keyof typeof LAUNCH50_MESSAGES;

/** Maps a PostgREST error (hint first, then SQLSTATE) to a code and a friendly message. */
export function mapLaunch50Error(err: { hint?: string | null; code?: string | null; message?: string | null } | null | undefined): { code: Launch50ErrorCode; error: string } {
  const hint = err?.hint ?? "";
  if (hint in LAUNCH50_MESSAGES && hint !== "generic" && hint !== "not_owner" && hint !== "signed_out") {
    const code = hint as Launch50ErrorCode;
    return { code, error: LAUNCH50_MESSAGES[code] };
  }
  if (err?.code === "42501") {
    // The database uses 42501 for both "not signed in" and "not the owner".
    return /sign in/i.test(err.message ?? "") ? { code: "signed_out", error: LAUNCH50_MESSAGES.signed_out } : { code: "not_owner", error: LAUNCH50_MESSAGES.not_owner };
  }
  return { code: "generic", error: LAUNCH50_MESSAGES.generic };
}

/** Error codes the checkout function (local-subscription-intent / -change) answers with. */
export const LAUNCH50_CHECKOUT_MESSAGES: Record<string, string> = {
  LAUNCH50_UNAVAILABLE: "The Launch 50 price is not available for this business right now. Nothing has been charged.",
  LAUNCH50_NO_PLACE: "Your reserved place is no longer held, so the Launch 50 price cannot be used. Nothing has been charged. You can reserve again if places remain.",
  LAUNCH50_MONTHLY_ONLY: "Launch 50 is monthly billing only. Nothing has been charged.",
  LAUNCH50_PLAN_LOCKED: LAUNCH50_LOCKED_NOTE,
};
export const isLaunch50Code = (code: unknown): code is string => typeof code === "string" && code.startsWith("LAUNCH50_");
export const launch50CheckoutMessage = (code: string): string => LAUNCH50_CHECKOUT_MESSAGES[code] ?? LAUNCH50_MESSAGES.generic;

/** The confirmation shown before a Launch 50 subscription starts — same shape as subscriptionConfirmCopy. */
export function launch50ConfirmCopy(tier: Launch50Tier) {
  const amount = launch50Price(tier);
  const std = standardPrice(tier);
  return {
    title: `Subscribe to ${LAUNCH50_NAME[tier]}?`,
    plan: LAUNCH50_NAME[tier],
    amount,
    interval: "month",
    price: `${amount} a month for ${LAUNCH50_DISCOUNT_MONTHS} months, then ${std} a month`,
    recurrence:
      `This is a subscription. ${amount} is taken today and every month for ${LAUNCH50_DISCOUNT_MONTHS} months. After that the standard ${std} a month starts ` +
      `automatically, and we will email you a reminder first. You can cancel any time from this page. The price you see is the price you pay.`,
    confirmLabel: `Subscribe for ${amount}/month`,
    cancelLabel: "Not now",
    amountPence: LAUNCH50_PRICE_PENCE[tier],
  };
}

/* ── Billing card state ───────────────────────────────────────────────────────────────────────────── */
export type Launch50CardState = "hidden" | "choose" | "held" | "pending" | "active" | "ended";

/** True while a reservation is still inside its 30 minutes. */
export function reservationLive(place: Launch50Place | null | undefined, nowMs: number): boolean {
  return !!place && place.status === "reserved" && !!place.reservation_expires_at && Date.parse(place.reservation_expires_at) > nowMs;
}

/**
 * Which Launch 50 card (if any) the billing page shows.
 *  - a place that is active / pending / ended is always described, whatever the phase;
 *  - a new reservation is offered only while Launch 50 is not closed and the business is Free with no Stripe subscription.
 */
export function launch50CardState(args: { phase: Launch50Phase; tier: string; subscriptionConnected: boolean; hasLaunchGrant?: boolean; place: Launch50Place | null; nowMs: number }): Launch50CardState {
  const { place } = args;
  if (place?.status === "active") return "active";
  if (place?.status === "pending_payment") return "pending";
  if (place?.status === "ended") return "ended";
  if (args.phase === "closed") return "hidden";
  if (args.tier !== "free" || args.subscriptionConnected || args.hasLaunchGrant) return "hidden";
  return reservationLive(place, args.nowMs) ? "held" : "choose";
}

/** A business holding an active or pending place may not change plan. */
export const launch50PlanLocked = (place: Launch50Place | null | undefined) => place?.status === "active" || place?.status === "pending_payment";

/**
 * The rate a Launch 50 member is ACTUALLY paying right now, or null (standard prices apply): an active place on the plan they are on, while the
 * founding discount has not ended. The billing page uses this so it never shows the standard price as the current monthly payment.
 */
export function foundingRate(place: Launch50Place | null | undefined, tier: string, nowMs: number = Date.now()):
  { pence: number; price: string; standard: string; until: string | null; note: string } | null {
  if (!place || place.status !== "active" || place.tier !== tier || (tier !== "pro" && tier !== "premium")) return null;
  const ends = place.discount_ends_at ? Date.parse(place.discount_ends_at) : NaN;
  if (!Number.isFinite(ends) || ends <= nowMs) return null;
  const t = tier as Launch50Tier;
  const until = fmtLaunchDate(place.discount_ends_at);
  return {
    pence: LAUNCH50_PRICE_PENCE[t], price: launch50Price(t), standard: standardPrice(t), until,
    note: `Launch 50 founding rate: ${launch50Price(t)}/month${until ? ` until ${until}` : ""}, then ${standardPrice(t)}/month.`,
  };
}

/* ── Formatters ───────────────────────────────────────────────────────────────────────────────────── */
export function fmtLaunchDate(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return null;
  return new Date(t).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "Europe/London" });
}

/** Clamp to ~max characters at a word boundary. */
export function clampDescription(text: string | null | undefined, max = 220): string {
  const t = (text ?? "").replace(/\s+/g, " ").trim();
  if (t.length <= max) return t;
  const cut = t.slice(0, max);
  const sp = cut.lastIndexOf(" ");
  const base = (sp > max * 0.5 ? cut.slice(0, sp) : cut).replace(/[\s,.;:!?-]+$/, "");
  return `${base}…`;
}

/** Only http(s) websites are ever linked. */
export function safeWebsite(url: string | null | undefined): { href: string; label: string } | null {
  if (!url) return null;
  const raw = url.trim();
  if (!raw) return null;
  try {
    const u = new URL(raw);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    return { href: u.toString(), label: u.hostname.replace(/^www\./, "") };
  } catch { return null; }
}

/** The JSON body for local-subscription-intent. `launch50: true` is added ONLY for the Launch 50 button; the standard body is unchanged. */
export function subscriptionIntentBody(a: { businessId: string; tier: Launch50Tier; period: string; clientRequestId?: string; useSavedCard: boolean; launch50?: boolean }): Record<string, unknown> {
  return { business_id: a.businessId, tier: a.tier, period: a.period, client_request_id: a.clientRequestId, use_saved_card: a.useSavedCard, ...(a.launch50 ? { launch50: true } : {}) };
}

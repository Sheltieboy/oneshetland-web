/**
 * launch-grant.ts — how a manually granted launch-partner plan is described to the owner.
 *
 * A launch grant is Pro or Premium with an end date and no Stripe subscription behind it. The Plan screen used to
 * read that as a paying customer: "Premium · £49.99/mo … Renews 3 April". Nothing renews and nothing is charged,
 * so the screen now says what it is. The grant rows are written only by admin_grant_launch_plan; the owner may
 * read their own business's rows.
 */

export type LaunchGrantRow = {
  tier: "pro" | "premium";
  expires_at: string;
  revoked_at?: string | null;
  superseded_at?: string | null;
};

export type LaunchGrant = { tier: "pro" | "premium"; expiresAt: string };

/**
 * The grant that is giving this business its plan right now, or null.
 *
 * A genuine subscription always wins (the grant is then history), and a lapsed, revoked or replaced grant gives
 * nothing, so none of them may be described as current access.
 */
export function liveLaunchGrant(
  rows: LaunchGrantRow[] | null | undefined,
  subscriptionConnected: boolean,
  now: Date = new Date(),
): LaunchGrant | null {
  if (subscriptionConnected) return null;
  const open = (rows ?? []).filter((r) => !r.revoked_at && !r.superseded_at && new Date(r.expires_at) > now);
  if (open.length === 0) return null;
  const latest = open.reduce((a, b) => (new Date(b.expires_at) > new Date(a.expires_at) ? b : a));
  return { tier: latest.tier, expiresAt: latest.expires_at };
}

const day = (iso: string) =>
  new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });

/** The two strings the Plan card shows for a grant: the badge, and the line under it. */
export function launchGrantCopy(g: LaunchGrant, tierLabel: string): { badge: string; line: string } {
  return {
    badge: `${tierLabel} · Launch partner`,
    line: `Plan access until ${day(g.expiresAt)}. Included free as a launch partner — nothing renews and no payment is taken.`,
  };
}

/* ── The admin screen ────────────────────────────────────────────────────────
 * Only presentation helpers. Whether a grant is allowed, and every limit on it, is decided by the database
 * functions (admin_grant_launch_plan and friends); nothing here is an entitlement rule. */

export type LaunchLookupRow = {
  business_id: string;
  name: string;
  category: string | null;
  address: string | null;
  is_active: boolean;
  is_claimed: boolean;
  tier: string;
  plan_until: string | null;
  plan_live: boolean;
  has_subscription: boolean;
  grant_id: string | null;
  grant_tier: "pro" | "premium" | null;
  grant_expires_at: string | null;
};

const TIER_NAME: Record<string, string> = { free: "Free", pro: "Pro", premium: "Premium" };
export const tierName = (t: string | null | undefined) => TIER_NAME[t ?? "free"] ?? "Free";

/** What the business holds today, in the words the admin sees. `canGrant` only gates the form; the server re-checks. */
export function describePlan(r: LaunchLookupRow): { kind: "subscription" | "grant" | "other-plan" | "free"; text: string; canGrant: boolean } {
  if (r.has_subscription) {
    return { kind: "subscription", canGrant: false,
      text: "This business has a real Stripe subscription. Launch access cannot be added to a business that pays for a plan." };
  }
  if (r.grant_id && r.grant_tier && r.grant_expires_at) {
    return { kind: "grant", canGrant: true,
      text: `Launch partner access: ${tierName(r.grant_tier)}. Included free until ${day(r.grant_expires_at)}. No Stripe subscription or payment will be created.` };
  }
  if (r.plan_live && r.plan_until) {
    return { kind: "other-plan", canGrant: false,
      text: `Holds a ${tierName(r.tier)} plan until ${day(r.plan_until)} that is not a launch grant (for example a paid boost). It cannot be overwritten here.` };
  }
  if (r.tier !== "free" && r.plan_until) {
    return { kind: "free", canGrant: true, text: `Free now. A ${tierName(r.tier)} plan ended on ${day(r.plan_until)}.` };
  }
  return { kind: "free", canGrant: true, text: "On the Free plan." };
}

const pad = (n: number) => String(n).padStart(2, "0");
const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

/** The dates the picker offers: tomorrow .. just under 24 months. (The database enforces the same window.) */
export function expiryBounds(now: Date = new Date()): { min: string; max: string } {
  const min = new Date(now); min.setDate(min.getDate() + 1);
  const max = new Date(now); max.setMonth(max.getMonth() + 24); max.setDate(max.getDate() - 2);
  return { min: ymd(min), max: ymd(max) };
}

/** A picked date becomes the end of that day, local time. Anything that is not a real date becomes null. */
export function expiryFromDate(date: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const d = new Date(`${date}T23:59:00`);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

/** The database raises plain sentences. Strip the transport noise and keep the sentence. */
export function dbMessage(e: unknown): string {
  const m = e instanceof Error ? e.message : typeof e === "object" && e && "message" in e ? String((e as { message: unknown }).message) : String(e ?? "");
  return m.replace(/^ERROR:\s*/i, "").replace(/\s*\(SQLSTATE.*$/i, "").trim() || "Something went wrong.";
}

export const GRANT_REASON_MIN = 10;
export const REVOKE_REASON_MIN = 5;

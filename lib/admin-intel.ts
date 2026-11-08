/**
 * admin-intel.ts — pure types and helpers for the Admin Intelligence dashboard (/admin/intelligence) and Useful Actions.
 * No I/O. The numbers come from the admin-only RPCs admin_intel_overview / admin_useful_actions (migration 20261231000000).
 */

export const PERIODS = [7, 30, 90] as const;
export type Period = (typeof PERIODS)[number];
export const parsePeriod = (v: unknown): Period => { const n = Number(Array.isArray(v) ? v[0] : v); return (PERIODS as readonly number[]).includes(n) ? (n as Period) : 30; };

export const VIEWS = [
  { key: "overview", label: "Overview" },
  { key: "members", label: "Members" },
  { key: "business", label: "Businesses" },
  { key: "content", label: "Content" },
  { key: "commercial", label: "Commercial" },
  { key: "health", label: "Health" },
] as const;
export type ViewKey = (typeof VIEWS)[number]["key"];
export const parseView = (v: unknown): ViewKey => { const s = Array.isArray(v) ? v[0] : v; return (VIEWS.find((x) => x.key === s)?.key ?? "overview") as ViewKey; };

export type Priority = "urgent" | "high" | "medium" | "low";
export type Evidence = "measured" | "partial";
export interface UsefulAction {
  key: string; title: string; what: string; why: string; benefit: string;
  priority: Priority; category: "operations" | "growth" | "quality" | "commercial";
  evidence: Evidence; link: string; value: number; score: number;
  items?: { label: string; href: string }[];
}
export interface ActionHistoryItem { key: string; status: "done" | "dismissed"; acted_at: string; title: string; then: number | null; now: number | null; improved: boolean | null }
export interface UsefulActionsPayload { generated_at: string; actions: UsefulAction[]; history: ActionHistoryItem[]; snoozed: number }

export const PRIORITY_META: Record<Priority, { label: string; tone: "red" | "amber" | "blue" | "gray" }> = {
  urgent: { label: "Urgent", tone: "red" }, high: { label: "High", tone: "amber" }, medium: { label: "Medium", tone: "blue" }, low: { label: "Low", tone: "gray" },
};
export const CATEGORY_LABEL: Record<UsefulAction["category"], string> = { operations: "Operations", growth: "Growth", quality: "Quality", commercial: "Commercial" };

/** Urgent operational issues first, then everything else by score; the three most valuable shown prominently. */
export const topActions = (a: UsefulAction[], n = 3) => a.slice(0, n);
export const isUrgent = (a: UsefulAction) => a.priority === "urgent";

export interface Overview {
  generated_at: string; days: number; period_start: string; prev_start: string;
  members: { total: number; new_period: number; new_prev: number; new_today: number; new_7d: number; new_30d: number; verified_email: number; signed_in_period: number; with_push: number; signups_by_day: { day: string; n: number }[] };
  engagement: {
    events_period: number; events_prev: number; dau: number; wau: number; mau: number; returning_7d: number;
    by_platform: Record<string, number>; content_views: { type: string; cur: number; prev: number }[];
    contact_clicks: { cur: number; prev: number }; searches: { cur: number; prev: number }; last_event_at: string | null;
  };
  businesses: {
    active: number; claimed: number; unclaimed: number; new_period: number; new_prev: number; claimed_period: number; claimed_prev: number;
    claims_pending: number; claims_submitted_period: number; claims_approved_period: number; claims_rejected_period: number; verified: number;
    tiers: Record<string, number>; categories: { category: string; n: number }[];
    completeness: { total: number; with_description: number; with_logo: number; with_cover: number; with_contact: number; with_hours: number; complete_all: number };
    published_by_businesses: { events_period: number; offers_period: number; jobs_period: number; businesses_publishing_60d: number };
  };
  content: {
    events: { upcoming: number; next_14d: number; new_period: number; new_prev: number; cancelled_upcoming: number; by_category: { category: string; n: number }[]; by_locality: { locality: string; n: number }[]; submissions_pending: number; submissions_period: number };
    activities: { published: number; new_period: number; paused: number };
    jobs: { open: number; new_period: number; new_prev: number; closing_7d: number; expired_still_open: number; applications_period: number; applications_prev: number };
    shifts: { open_upcoming: number; new_period: number; positions_filled: number; positions_total: number };
    hubs: { active: number; new_period: number; publishing_60d: number; members: number };
    notices: { live: number; new_period: number; by_category: { category: string; n: number }[] };
    offers: { active: number; added_period: number; expiring_7d: number; redemptions_period: number; redemptions_prev: number; businesses_with_active_offer: number };
  };
  saved: { members_with_saves: number; members_with_2plus: number; total_saves: number; new_saves_period: number; new_saves_prev: number; by_type: Record<string, number>; adoption_pct: number | null };
  commercial: { paid_active: number; paid_by_tier: Record<string, number>; cancelling: number; lapsed_unreconciled: number; claimed_free: number };
  health: {
    pending_claims: number; pending_event_submissions: number; open_reports: number; email_sent_period: number; email_failed_period: number;
    push_sent_period: number; push_errors_period: number; job_sync_last: { ran_at: string; ok: boolean; reason: string | null } | null; job_sync_failed_7d: number;
  };
  unavailable: string[];
}

export type Trend = { dir: "up" | "down" | "flat" | "new" | "none"; pct: number | null };
/** Previous-equivalent-period comparison. Zero in both = none (nothing to compare); zero before = new; never divides by zero. */
export function trend(cur: number, prev: number): Trend {
  const c = Number(cur) || 0, p = Number(prev) || 0;
  if (c === 0 && p === 0) return { dir: "none", pct: null };
  if (p === 0) return { dir: "new", pct: null };
  const pct = Math.round(((c - p) / p) * 100);
  return { dir: pct > 0 ? "up" : pct < 0 ? "down" : "flat", pct };
}
export function trendText(cur: number, prev: number, days: number): string {
  const t = trend(cur, prev);
  if (t.dir === "none") return `no activity in either ${days}-day period`;
  if (t.dir === "new") return `new: none in the previous ${days} days`;
  if (t.dir === "flat") return `no change vs previous ${days} days`;
  return `${t.pct! > 0 ? "+" : ""}${t.pct}% vs previous ${days} days`;
}
export const pct = (n: number, d: number): string => (d > 0 ? `${Math.round((n / d) * 100)}%` : "–");
export const num = (n: number | null | undefined) => (n ?? 0).toLocaleString("en-GB");

export function ago(iso: string | null | undefined, now = Date.now()): string {
  if (!iso) return "never";
  const s = Math.max(0, Math.round((now - new Date(iso).getTime()) / 1000));
  if (s < 90) return "just now";
  const m = Math.round(s / 60); if (m < 90) return `${m} minutes ago`;
  const h = Math.round(m / 60); if (h < 36) return `${h} hours ago`;
  return `${Math.round(h / 24)} days ago`;
}
export const isStale = (iso: string | null | undefined, hours: number, now = Date.now()) => !iso || now - new Date(iso).getTime() > hours * 3600_000;

export const METRIC_DEFINITIONS: { term: string; def: string }[] = [
  { term: "Members", def: "Accounts in profiles that are not deactivated. Registrations use the account creation date in UK time." },
  { term: "Signed in", def: "Members whose last sign-in falls in the period. A lower bound: a member who stays signed in on a device is not counted again." },
  { term: "Tracked activity (DAU / WAU / MAU)", def: "Distinct people or devices that produced at least one analytics event in the last 1 / 7 / 30 days. Counts only people who accepted analytics; administrator accounts are excluded. It understates real use." },
  { term: "Returning", def: "People who were tracked in the last 7 days and also in the 7 days before that." },
  { term: "Active listing", def: "A business with is_active set, excluding test fixtures. Claimed means an owner has been approved." },
  { term: "Paid plans", def: "Businesses on Pro or Premium whose subscription end date is in the future. Counts only; revenue is on the Commercial tab from the payment ledgers (gross, refunded, net)." },
  { term: "Previous period", def: "The same number of days immediately before the selected period. Trends compare these two." },
  { term: "My Saved", def: "Counts only. No member is identified and no list of who saved what is available here." },
  { term: "Not measured", def: "Anything listed under 'Not measured yet' has no reliable source today. It is never estimated." },
];

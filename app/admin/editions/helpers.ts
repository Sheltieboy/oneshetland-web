/** Pure helpers for the Editions admin area (no I/O, unit-tested). The database remains the authority for every rule here. */
import { friendlyError } from "@/lib/editions/rules";

/** The Editions admin sections. Approvals is the landing page; Commerce is its own page (packages and fees). */
export const TABS = [
  { key: "approvals", label: "Approvals", href: "/admin/editions/approvals" },
  { key: "organisers", label: "Organisers", href: "/admin/editions?tab=organisers" },
  { key: "editions", label: "Editions", href: "/admin/editions?tab=editions" },
  { key: "entitlements", label: "Manual package adjustments", href: "/admin/editions?tab=entitlements" },
  { key: "commerce", label: "Commerce", href: "/admin/editions/commerce" },
  { key: "promotions", label: "Promotions", href: "/admin/editions/promotions" },
  { key: "audit", label: "Audit log", href: "/admin/editions?tab=audit" },
] as const;
export type TabKey = (typeof TABS)[number]["key"];
export const parseTab = (v: string | string[] | undefined): TabKey => {
  const s = Array.isArray(v) ? v[0] : v;
  return TABS.find((t) => t.key === s)?.key ?? "approvals";
};
export const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";
export const isUuid = (s: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);

/** Verification now happens inside Edition approval, so an existing organiser can only be suspended or reinstated here. */
export const ORGANISER_DECISIONS = ["reinstate", "suspend"] as const;
export type OrganiserDecision = (typeof ORGANISER_DECISIONS)[number];
/** Suspension and restoration are administrator-only (decision 9 Nov 2026): moderators have no route. */
export const ADMIN_ONLY_DECISIONS: OrganiserDecision[] = ["reinstate", "suspend"];
export const GRANT_FEATURES = ["publish", "featured_strip", "follower_notice"] as const;
export const FEATURE_LABEL: Record<string, string> = { publish: "Publish", featured_strip: "Featured strip", follower_notice: "Follower notice" };

/** Which decisions make sense for an organiser in this state. */
export function decisionsFor(status: string): OrganiserDecision[] {
  switch (status) {
    case "pending": case "verified": return ["suspend"];
    case "rejected": case "suspended": return ["reinstate"];
    default: return [];
  }
}

/** Database refusals an administrator meets while deciding, packaging or switching a Hub, in plain sentences. Checked before anything else. */
const ADMIN_SENTENCES: [RegExp, string][] = [
  [/not waiting for review/i, "This Edition is not waiting for review any more. Someone may have decided it already: go back to the queue."],
  [/reinstate it first/i, "The organiser is suspended or rejected. Reinstate it from the Organisers tab, then approve this Edition."],
  [/the Business or Hub is not active/i, "The Business or Hub that runs this Edition is not active, so the Edition cannot be approved yet."],
  [/reserved list: write a note/i, "This name matches a reserved list. Write a note of at least 10 characters saying how you checked."],
  [/test organiser cannot be approved/i, "This is a test organiser, so its Editions cannot be approved for the public."],
  [/tell the organiser why/i, "Tell the organiser why, in at least 5 characters."],
  [/a note is required/i, "Add a note of at least 5 characters."],
  [/the Hub is already in that state/i, "Nothing changed: the Hub is already set that way."],
  [/Hub not found/i, "That Hub could not be found."],
  [/must be marked free on purpose/i, "A package at £0 can only be offered if you tick \"Free package\". Do that, or set a price."],
  [/a free package costs nothing/i, "A free package costs nothing. Set the price to 0, or untick \"Free package\"."],
  [/unknown feature in package/i, "One of the ticked extras is not recognised. Untick it and save again."],
  [/edition not found/i, "That Edition could not be found."],
];

/** Guard messages an administrator should see verbatim; everything else goes through friendlyError. */
const KNOWN_GUARD = /admins only|staff only|overlapping admin grant|cannot run longer|reason is required|needs an end|not suspended|unknown organiser|unknown edition|no live entitlement|bad decision|bad action|an edition cannot|already approved|more than 30 days|1 to 90 days|a note is required|a free package has nothing to refund|only a paid order can be refunded|no card payment to refund|refund is already in progress|the refund must be more than nothing|give a reason of at least|order not found/i;
export function adminError(message: string | null | undefined): string {
  const m = message ?? "";
  const hit = ADMIN_SENTENCES.find(([re]) => re.test(m));
  if (hit) return hit[1];
  return KNOWN_GUARD.test(m) ? m : friendlyError(m);
}

const DAY = 86_400_000;
export const GRANT_PRESETS = [30, 90, 365] as const;
export const MAX_GRANT_DAYS = 24 * 30 + 20; // the database allows 24 months; stay inside it

/** The end of a grant: a preset number of days, or a custom end date (YYYY-MM-DD, end of that day UTC). */
export function grantEnd(input: { preset?: string; customEnd?: string }, now = new Date()): { ok: true; endsAt: string } | { ok: false; error: string } {
  const p = (input.preset ?? "").trim();
  let end: Date;
  if (p && p !== "custom") {
    const n = Number(p);
    if (!GRANT_PRESETS.includes(n as (typeof GRANT_PRESETS)[number])) return { ok: false, error: "Choose 30, 90 or 365 days, or a custom end date." };
    end = new Date(now.getTime() + n * DAY);
  } else {
    const c = (input.customEnd ?? "").trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(c)) return { ok: false, error: "Choose an end date." };
    end = new Date(`${c}T23:59:00Z`);
    if (Number.isNaN(end.getTime())) return { ok: false, error: "Choose a valid end date." };
  }
  if (end.getTime() <= now.getTime()) return { ok: false, error: "The end must be in the future." };
  if (end.getTime() - now.getTime() > MAX_GRANT_DAYS * DAY) return { ok: false, error: "A grant cannot run longer than 24 months." };
  return { ok: true, endsAt: end.toISOString() };
}

export type EntState = "live" | "expired" | "voided" | "scheduled";
export function entitlementState(e: { starts_at: string; ends_at: string; voided_at: string | null }, now = new Date()): EntState {
  if (e.voided_at) return "voided";
  if (Date.parse(e.ends_at) <= now.getTime()) return "expired";
  if (Date.parse(e.starts_at) > now.getTime()) return "scheduled";
  return "live";
}

/** Audit notes are written for the administrator, so routine actions need no typing. Anything they add is appended. Notes are at least 5 characters, as the database requires. */
export const NOTE_KINDS = {
  hub_verify: (subject: string) => `${subject} given the Verified badge`,
  hub_unverify: (subject: string) => `Verified badge removed from ${subject}`,
  hub_events_on: (subject: string) => `Events from ${subject} set to skip approval`,
  hub_events_off: (subject: string) => `Events from ${subject} set to need approval again`,
} as const;
export type NoteKind = keyof typeof NOTE_KINDS;
export function autoNote(kind: NoteKind, admin: string, extra?: string, subject = "the Hub"): string {
  const base = NOTE_KINDS[kind](subject);
  const who = (admin || "").trim() || "an administrator";
  const more = String(extra ?? "").trim();
  return `${base} by ${who} from the admin Hubs page.${more ? ` ${more}` : ""}`.slice(0, 480);
}

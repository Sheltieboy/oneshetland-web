/** Pure helpers for the Editions admin area (no I/O, unit-tested). The database remains the authority for every rule here. */
import { friendlyError } from "@/lib/editions/rules";

export const TABS = [
  { key: "queue", label: "Verification queue" },
  { key: "organisers", label: "Organisers" },
  { key: "editions", label: "Editions" },
  { key: "entitlements", label: "Entitlements" },
  { key: "pilot", label: "Pilot" },
  { key: "audit", label: "Audit log" },
] as const;
export type TabKey = (typeof TABS)[number]["key"];
export const parseTab = (v: string | string[] | undefined): TabKey => {
  const s = Array.isArray(v) ? v[0] : v;
  return TABS.find((t) => t.key === s)?.key ?? "queue";
};
export const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";
export const isUuid = (s: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);

export const ORGANISER_DECISIONS = ["verify", "reject", "reinstate", "suspend"] as const;
export type OrganiserDecision = (typeof ORGANISER_DECISIONS)[number];
/** Decisions that only administrators may make. Suspension and restoration are admin-only too (decision 9 Nov 2026): moderators have no route. */
export const ADMIN_ONLY_DECISIONS: OrganiserDecision[] = ["verify", "reject", "reinstate", "suspend"];
export const GRANT_FEATURES = ["publish", "featured_strip", "follower_notice"] as const;
export const FEATURE_LABEL: Record<string, string> = { publish: "Publish", featured_strip: "Featured strip", follower_notice: "Follower notice" };

/** Which decisions make sense for an organiser in this state. */
export function decisionsFor(status: string): OrganiserDecision[] {
  switch (status) {
    case "pending": return ["verify", "reject", "suspend"];
    case "verified": return ["suspend"];
    case "rejected": return ["reinstate"];
    case "suspended": return ["reinstate"];
    default: return [];
  }
}

/** Guard messages an administrator should see verbatim; everything else goes through friendlyError. */
const KNOWN_GUARD = /reserved-name organiser|admins only|staff only|overlapping admin grant|cannot run longer|reason is required|needs an end|not suspended|unknown organiser|unknown edition|no live entitlement|bad decision|bad action|an edition cannot|already verified|pilot|must be verified|Hub is not active|a note is required|already approved|more than 30 days|1 to 90 days|test organiser|already has an Editions organiser|web address|that address is reserved|Hub not found|already in that state/i;
export function adminError(message: string | null | undefined): string {
  const m = message ?? "";
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

/* ── ZZ TEST organisation plan ─────────────────────────────────────────────── */
export const TEST_ORG = { name: "ZZ TEST Editions Co.", slug: "zz-test-editions-co" } as const;
export const TEST_EDITION_SLUG = "zz-test-edition-2027";

const addDays = (iso: string, n: number) => new Date(Date.parse(`${iso}T00:00:00Z`) + n * DAY).toISOString().slice(0, 10);

export type TestPlan = ReturnType<typeof buildTestPlan>;
export function buildTestPlan(now = new Date()) {
  const today = now.toISOString().slice(0, 10);
  const start = addDays(today, 60), mid = addDays(start, 1), end = addDays(start, 2);
  const at = (day: string, hhmm: string) => `${day}T${hhmm}:00Z`;
  const t = "https://example.com/zz-test-tickets";
  return {
    organiser: { ...TEST_ORG, tagline: "ZZ TEST sample organiser for staff acceptance testing", description: "ZZ TEST: a private sample organisation used by OneShetland staff to exercise Editions. It is not a real organiser." },
    evidence: "ZZ TEST: staff acceptance-test organisation created by an administrator. No real organisation is represented.",
    verifyNote: "ZZ TEST organisation verified for acceptance testing.",
    edition: {
      slug: TEST_EDITION_SLUG, title: "ZZ TEST Edition 2027", kind: "multi_day" as const, starts_on: start, ends_on: end, year_label: "2027", brand_color: "#7a3b8f",
      summary: "ZZ TEST: a sample three-day Edition for staff acceptance testing. Not a real event.",
      description: "ZZ TEST: sample Edition. Everything on this page is placeholder content.",
    },
    pages: [
      { slug: "welcome", nav_label: "Welcome", title: "ZZ TEST welcome", is_home: true, in_nav: true, position: 0, body: "## ZZ TEST welcome\n\nThis is **sample content** for staff acceptance testing.\n\n- Sample item one\n- Sample item two" },
      { slug: "about-this-test", nav_label: "About", title: "ZZ TEST about", is_home: false, in_nav: true, position: 1, body: "## About this test Edition\n\nZZ TEST sample page. It exists only to exercise navigation." },
      { slug: "getting-here", nav_label: "Getting here", title: "ZZ TEST getting here", is_home: false, in_nav: true, position: 2, body: "## Getting here\n\nZZ TEST sample travel notes. Not real directions." },
    ],
    venue: { name: "ZZ TEST Sample Hall", address: "ZZ TEST sample address, Lerwick", notes: "ZZ TEST sample venue" },
    sessions: [
      { title: "ZZ TEST Opening session", starts_at: at(start, "10:00"), ends_at: at(start, "11:00"), kind: "event" as const, ticket_mode: "none" as const, ticket_url: null, price_text: "Free", status: "scheduled" as const },
      { title: "ZZ TEST Workshop (ticketed)", starts_at: at(start, "14:00"), ends_at: at(start, "16:00"), kind: "activity" as const, ticket_mode: "external" as const, ticket_url: t, price_text: "ZZ TEST £0", status: "scheduled" as const },
      { title: "ZZ TEST Talk", starts_at: at(mid, "10:00"), ends_at: at(mid, "11:00"), kind: "session" as const, ticket_mode: "none" as const, ticket_url: null, price_text: null, status: "scheduled" as const },
      { title: "ZZ TEST Exhibition (ticketed)", starts_at: at(mid, "14:00"), ends_at: at(mid, "17:00"), kind: "exhibition" as const, ticket_mode: "external" as const, ticket_url: t, price_text: "ZZ TEST £0", status: "scheduled" as const },
      { title: "ZZ TEST Cancelled tour", starts_at: at(end, "10:00"), ends_at: at(end, "11:30"), kind: "tour" as const, ticket_mode: "none" as const, ticket_url: null, price_text: null, status: "cancelled" as const },
      { title: "ZZ TEST Closing event", starts_at: at(end, "14:00"), ends_at: at(end, "15:00"), kind: "event" as const, ticket_mode: "none" as const, ticket_url: null, price_text: "Free", status: "scheduled" as const },
    ],
    updates: [
      { title: "ZZ TEST pinned update", body: "ZZ TEST: this pinned update is sample content.", pinned: true },
      { title: "ZZ TEST second update", body: "ZZ TEST: another sample update.", pinned: false },
    ],
    sponsors: [
      { name: "ZZ TEST Sponsor One", level: "Sample", url: "https://example.com/zz-test-sponsor-one", position: 0 },
      { name: "ZZ TEST Sponsor Two", level: "Sample", url: null, position: 1 },
    ],
    grant: { feature: "publish" as const, days: 90, reason: "ZZ TEST acceptance grant" },
  };
}

export type StepKey = "organiser" | "request_verification" | "verify" | "mark_org_test" | "edition" | "mark_edition_test" | "pages" | "venue" | "sessions" | "updates" | "sponsors" | "grant" | "publish";
export const STEPS: { key: StepKey; label: string }[] = [
  { key: "organiser", label: "Create ZZ TEST organiser (create_edition_organiser)" },
  { key: "request_verification", label: "Request verification (request_edition_organiser_verification)" },
  { key: "verify", label: "Verify organiser (admin_decide_edition_organiser)" },
  { key: "mark_org_test", label: "Mark organiser as test (admin_mark_edition_test)" },
  { key: "edition", label: "Create draft ZZ TEST Edition" },
  { key: "mark_edition_test", label: "Mark Edition as test (admin_mark_edition_test)" },
  { key: "pages", label: "Add 3 pages" },
  { key: "venue", label: "Add venue" },
  { key: "sessions", label: "Add 6 sessions" },
  { key: "updates", label: "Add 2 updates" },
  { key: "sponsors", label: "Add 2 sponsors" },
  { key: "grant", label: "Grant 90-day publish entitlement (admin_grant_edition_entitlement)" },
  { key: "publish", label: "Publish (edition_set_status)" },
];
export type StepResult = { key: StepKey; label: string; status: "done" | "skipped" | "failed"; detail?: string };
export const isStepKey = (s: string): s is StepKey => STEPS.some((x) => x.key === s);

/** Pilot: the Hub web address (slug) shape the database enforces, checked early so an administrator gets a clear message. */
export const isPilotSlug = (s: string) => /^[a-z0-9]+(-[a-z0-9]+)*$/.test(s) && s.length >= 3 && s.length <= 60;
/** A pilot Edition page is public through its direct link only: never search-indexed and never in the sitemap, until Editions is opened to everyone. */
export const PILOT_PUBLIC_DAYS = 90;

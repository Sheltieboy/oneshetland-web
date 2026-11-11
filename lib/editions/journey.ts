/**
 * The owner's journey through an Edition, as pure rules (no I/O, no React): Draft -> In review -> (Changes requested -> In review) -> Approved -> choose a package -> Live.
 * The database is the authority for every step; these helpers decide what the screens say and which single action to offer next, so each state is unit-tested.
 */
import { can } from "./rules";
import { pounds, type Pkg } from "./commerce";
import type { Edition, EditionEntitlement, EditionKind, EditionStatus, OrgRole, ReviewState } from "./types";

/* ── review status (edition_review_status) ─────────────────────────────────────────────────────────────────── */

export type ReviewEvent = { action: string; at: string; note: string | null };
export type ReviewStatus = {
  state: ReviewState; submitted_at: string | null; approved_at: string | null; last_decision: string | null; last_note: string | null; last_at: string | null;
  /** True when the Edition went back to review because an approved Edition's title, kind or dates were changed. */
  material: boolean; history: ReviewEvent[];
};
const STATES: ReviewState[] = ["not_submitted", "submitted", "changes_requested", "approved", "rejected"];
const str = (v: unknown): string | null => (typeof v === "string" && v ? v : null);

/** Reads the database's review status defensively. `fallback` is the state already on the Edition row, used if the status could not be read. */
export function parseReviewStatus(raw: unknown, fallback: ReviewState = "not_submitted"): ReviewStatus {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const state = STATES.includes(r.state as ReviewState) ? (r.state as ReviewState) : fallback;
  const history = Array.isArray(r.history)
    ? (r.history as Record<string, unknown>[]).flatMap((h): ReviewEvent[] => (h && typeof h.action === "string" && typeof h.at === "string" ? [{ action: h.action, at: h.at, note: str(h.note) }] : []))
    : [];
  return { state, submitted_at: str(r.submitted_at), approved_at: str(r.approved_at), last_decision: str(r.last_decision), last_note: str(r.last_note), last_at: str(r.last_at), material: r.material === true, history };
}

const HISTORY_LABEL: Record<string, string> = {
  submitted: "Sent for review", withdrawn: "Taken back from review", approved: "Approved by OneShetland", changes_requested: "OneShetland asked for changes",
  rejected: "OneShetland could not approve it", material_change: "Sent back for review after a change to the title, kind or dates", identity_verified: "Your organiser details were confirmed",
};
export const historyLabel = (action: string) => HISTORY_LABEL[action] ?? "Updated";

/* ── the one state an owner sees ───────────────────────────────────────────────────────────────────────────── */

export type EditionState = "draft" | "in_review" | "changes_requested" | "rejected" | "approved" | "live" | "archived" | "suspended";
export const STATE_LABEL: Record<EditionState, string> = {
  draft: "Draft", in_review: "In review", changes_requested: "Changes requested", rejected: "Not approved", approved: "Approved", live: "Live", archived: "Archived", suspended: "Suspended",
};
export type StateTone = "gray" | "amber" | "red" | "blue" | "green";
export const STATE_TONE: Record<EditionState, StateTone> = { draft: "gray", in_review: "blue", changes_requested: "amber", rejected: "red", approved: "blue", live: "green", archived: "gray", suspended: "red" };

/** Status (draft/published/archived/suspended) and review state combined. A published Edition that has gone back to review (a material change) reads as "In review". */
export function editionState(e: { status: EditionStatus; review_state?: ReviewState | null }): EditionState {
  if (e.status === "suspended") return "suspended";
  if (e.status === "archived") return "archived";
  switch (e.review_state ?? "not_submitted") {
    case "submitted": return "in_review";
    case "changes_requested": return "changes_requested";
    case "rejected": return "rejected";
    case "approved": return e.status === "published" ? "live" : "approved";
    default: return "draft";
  }
}
/** A small hint for lists and headers. */
export const needsAttention = (s: EditionState) => s === "changes_requested" || s === "rejected";
export const ATTENTION_TEXT = "Needs your attention";

export const STEPS = ["Draft", "In review", "Approved", "Live"] as const;
/** Which of the four steps is current (-1 for archived and suspended, which sit outside the journey). Changes requested and Not approved are still the Draft step: the owner is editing. */
export function stepIndex(s: EditionState): number {
  switch (s) {
    case "draft": case "changes_requested": case "rejected": return 0;
    case "in_review": return 1;
    case "approved": return 2;
    case "live": return 3;
    default: return -1;
  }
}

/* ── the single next action ────────────────────────────────────────────────────────────────────────────────── */

export type NextKey = "finish_checklist" | "submit" | "waiting" | "waiting_material" | "fix_changes" | "fix_rejected" | "choose_package" | "publish" | "live" | "archived" | "suspended";
export type Primary = "submit" | "resubmit" | "withdraw" | "choose_package" | "publish" | "view_live" | "restore";
export type NextAction = { key: NextKey; state: EditionState; step: number; headline: string; detail: string; primary: Primary | null; /** false = the person's role may not take the step. */ canAct: boolean; ownerOnlyNote: string | null };

const ADMIN_NOTE = "Ask an administrator or owner of your team to take this step.";

export function nextAction(a: { status: EditionStatus; review_state?: ReviewState | null; entitled: boolean; role: OrgRole | null | undefined; ready: boolean; material?: boolean }): NextAction {
  const state = editionState(a);
  const step = stepIndex(state);
  const canAct = can(a.role, "admin");
  const mk = (key: NextKey, headline: string, detail: string, primary: Primary | null): NextAction => ({ key, state, step, headline, detail, primary, canAct, ownerOnlyNote: primary && !canAct ? ADMIN_NOTE : null });
  switch (state) {
    case "suspended": return mk("suspended", "This Edition is suspended", "OneShetland has paused this Edition. It is hidden from visitors until the matter is resolved.", null);
    case "archived": return mk("archived", "This Edition is archived", "It is kept for your records and hidden from visitors. Restore it as a draft if you want to run it again.", "restore");
    case "in_review":
      return a.material
        ? mk("waiting_material", "OneShetland is checking your changes", "You changed the title, kind or dates of an approved Edition, so OneShetland is checking it again. Until it is approved, your Edition is hidden from the public.", null)
        : mk("waiting", "Waiting for OneShetland", "Your Edition is with OneShetland. We will email you as soon as there is a decision. You can keep editing, or take it back to make larger changes.", "withdraw");
    case "changes_requested": return mk("fix_changes", "OneShetland has asked for changes", "Read the message below, make the changes, then send your Edition back for review.", "resubmit");
    case "rejected": return mk("fix_rejected", "OneShetland could not approve this Edition", "Read the message below. If you can put it right, make the changes and send it back for review.", "resubmit");
    case "approved":
      return a.entitled
        ? mk("publish", "Approved and ready to publish", "Your package is active. Press Publish when you want visitors to see your Edition.", "publish")
        : mk("choose_package", "Approved: choose a package", "OneShetland has approved your Edition. Choose a package to cover it, then you can publish.", "choose_package");
    case "live": return mk("live", "Your Edition is live", "Visitors can see it now. You can keep editing; changing the title, kind or dates sends it back for review.", "view_live");
    default:
      return a.ready
        ? mk("submit", "Ready to send for review", "OneShetland looks over every Edition before it goes public. It usually only takes a short while.", "submit")
        : mk("finish_checklist", "Get your Edition ready", "Finish the required items below, then send your Edition for review. Only your team can see it until it is approved and published.", "submit");
  }
}

/** Why Publish is not available yet, in words (empty = it is available). The database enforces both conditions; this explains them. */
export function publishBlockers(a: { status: EditionStatus; review_state?: ReviewState | null; entitled: boolean }): string[] {
  const out: string[] = [];
  if (a.review_state !== "approved") out.push("OneShetland needs to approve your Edition first.");
  if (!a.entitled) out.push("Choose a package for your Edition.");
  return out;
}
export const canPublishNow = (a: { status: EditionStatus; review_state?: ReviewState | null; entitled: boolean }) => a.status === "draft" && publishBlockers(a).length === 0;

/* ── promotion: an optional next step after publishing ─────────────────────────────────────────────────────── */

export type PromoteNudge = { prominent: boolean; headline: string; detail: string; cta: string };
/** After publishing, promotion is offered but never required, and the stepper does not change. It is more prominent when a promotion the organiser already holds has no dates yet. */
export function promoteNudge(a: { state: EditionState; unbookedRights: number; canAct: boolean }): PromoteNudge | null {
  if (a.state !== "live") return null;
  if (a.unbookedRights > 0) {
    return { prominent: true, headline: "Choose when to promote your Edition", detail: "Your package includes promotion that has no dates yet. Pick the days that suit you, subject to availability.", cta: a.canAct ? "Choose promotion dates" : "See your promotion" };
  }
  return { prominent: false, headline: "Promote your Edition", detail: "Optional. Reach more people with a share of the promoted places on the homepage and in the Editions list.", cta: "See promotion options" };
}

/* ── material changes ──────────────────────────────────────────────────────────────────────────────────────── */

export const MATERIAL_FIELDS = ["title", "kind", "starts_on", "ends_on"] as const;
export type MaterialField = (typeof MATERIAL_FIELDS)[number];
export const MATERIAL_LABEL: Record<MaterialField, string> = { title: "the title", kind: "the kind of Edition", starts_on: "the start date", ends_on: "the end date" };
export const MATERIAL_WARNING = "This sends your Edition back to OneShetland for review. While it is in review it will not be visible to the public.";

type Material = { title: string; kind: EditionKind | string; starts_on: string; ends_on: string };
/** Which of the four review-triggering fields differ. Titles are compared as saved (trimmed). */
export function changedMaterialFields(before: Material, after: Material): MaterialField[] {
  return MATERIAL_FIELDS.filter((f) => (f === "title" ? before.title.trim() !== after.title.trim() : before[f] !== after[f]));
}
/** Fields whose change will send this Edition back to review: only an APPROVED Edition is affected. */
export const materialChangesFor = (reviewState: ReviewState | null | undefined, before: Material, after: Material): MaterialField[] =>
  reviewState === "approved" ? changedMaterialFields(before, after) : [];
export function materialSentence(fields: MaterialField[]): string {
  const l = fields.map((f) => MATERIAL_LABEL[f]);
  return l.length <= 1 ? (l[0] ?? "") : `${l.slice(0, -1).join(", ")} and ${l[l.length - 1]}`;
}
export const MATERIAL_SAVED = "Saved. Because you changed a key detail, your Edition has gone back to OneShetland for review and is hidden from the public until it is approved again.";

/* ── packages ──────────────────────────────────────────────────────────────────────────────────────────────── */

export const PAYMENTS_UNAVAILABLE = "Online payment is not available yet.";
/** What every package includes, in plain words. Launch and Showcase both carry all of it: a package never limits how an Edition is run. */
export const CORE_INCLUDES = [
  "Editorial pages", "Programme", "Sponsors and partners", "Updates", "Memberships", "Participation fees", "Taking payments", "Offline records", "CSV export", "Organiser management",
] as const;

export type PackageView = {
  id: string; name: string; description: string | null; priceLabel: string; /** The configurable note shown after the price (empty = show nothing). */ priceNote: string; free: boolean; durationLabel: string;
  /** Everything every package carries. */ includes: string[];
  /** Promotion that comes with the package, e.g. "Six weeks of enhanced discovery". Empty for a package with no promotion. */ promoIncludes: string[];
  /** claim = a free package, chosen without paying; pay = paid online; unavailable = paid but online payment is off. */
  choice: "claim" | "pay" | "unavailable"; unavailableText: string | null;
};
export function durationLabel(days: number): string {
  if (days <= 60) return `${days} ${days === 1 ? "day" : "days"}`;
  const months = Math.round(days / 30.4);
  if (months >= 12 && months % 12 === 0) { const y = months / 12; return `${y} ${y === 1 ? "year" : "years"}`; }
  return `${months} months`;
}
/** "42 days" reads better as "six weeks" when it is a whole number of weeks of two or more; anything else stays in days. */
const WORDS = ["", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve"];
export function spanLabel(days: number): string {
  if (days >= 14 && days % 7 === 0) { const w = days / 7; return `${WORDS[w] ?? w} weeks`; }
  return `${WORDS[days] ?? days} ${days === 1 ? "day" : "days"}`;
}
/** The promotion a row carries, from its grants (never from its name). */
export function promoIncludesFor(grants: Pkg["grants"]): string[] {
  const d = Number(grants?.discovery_days ?? 0), h = Number(grants?.homepage_days ?? 0);
  const out: string[] = [];
  if (d > 0) out.push(`${cap(spanLabel(d))} of enhanced discovery`);
  if (h > 0) out.push(`${cap(spanLabel(h))} of homepage featuring, chosen by you`);
  if (d > 0 || h > 0) out.push("Campaign reporting");
  return out;
}
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** A package as the owner reads it. Only an explicit free package is free; a paid package can be chosen only while online payment is switched on. `vatNote` is the wording OneShetland has configured; nothing is calculated here. */
export function packageView(p: Pkg & { is_free?: boolean }, opts: { commerceOn: boolean; vatNote?: string | null }): PackageView {
  const free = p.is_free === true;
  return {
    id: p.id, name: p.name, description: p.description, free,
    priceLabel: free ? "Free" : pounds(p.price_pence), priceNote: free ? "" : (opts.vatNote ?? "").trim(), durationLabel: durationLabel(p.duration_days ?? 365),
    includes: [...CORE_INCLUDES, ...(p.max_members ? [`Up to ${p.max_members} members`] : [])], promoIncludes: promoIncludesFor(p.grants),
    choice: free ? "claim" : opts.commerceOn ? "pay" : "unavailable", unavailableText: free || opts.commerceOn ? null : PAYMENTS_UNAVAILABLE,
  };
}

/** Is this row a package (as opposed to a promotion on the rate card)? Rows from before the promotion model have no kind. */
export const isPackageRow = (p: Pick<Pkg, "kind">) => (p.kind ?? "package") === "package";
export const isPromotionRow = (p: Pick<Pkg, "kind">) => p.kind === "promotion";

/**
 * Where a package can be chosen. A package is refused while the Edition is live with more than `windowDays` left; in the last `windowDays` it can be renewed.
 * Returns the day the live period ends and whether renewal is open.
 */
export function renewalState(untilIso: string | null, windowDays: number, now = Date.now()): { live: boolean; renewable: boolean } {
  if (!untilIso) return { live: false, renewable: false };
  const left = Date.parse(untilIso) - now;
  return { live: true, renewable: left <= windowDays * 86_400_000 };
}
export const liveUntilText = (untilIso: string, windowDays: number) => `Live until ${dayLabel(untilIso)}; you can renew in the last ${windowDays} days.`;

/** When the Edition's active package runs out (latest end of a current, unwithdrawn publish package), or null when there is none. */
export function activeUntil(entitlements: Pick<EditionEntitlement, "feature" | "starts_at" | "ends_at" | "voided_at">[], now = Date.now()): string | null {
  const live = entitlements.filter((e) => e.feature === "publish" && !e.voided_at && Date.parse(e.starts_at) <= now && Date.parse(e.ends_at) > now).map((e) => e.ends_at);
  return live.length ? live.reduce((a, b) => (Date.parse(a) >= Date.parse(b) ? a : b)) : null;
}
export const dayLabel = (iso: string) => new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "Europe/London" }).format(new Date(iso));
export const dayLabelShort = (iso: string) => new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "Europe/London" }).format(new Date(iso));

export type EditionLike = Pick<Edition, "status" | "review_state">;

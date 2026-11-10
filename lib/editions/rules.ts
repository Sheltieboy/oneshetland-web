/**
 * Pure rules for Editions. No I/O. Everything here is also enforced in the database; these helpers exist so the UI can explain a refusal
 * before a round trip and so the logic is unit-tested. The database is the authority.
 */
import type { Edition, EditionKind, EditionPage, EditionSession, OrgRole } from "./types";

export const ROLE_RANK: Record<OrgRole, number> = { owner: 3, admin: 2, editor: 1 };
export const can = (role: OrgRole | null | undefined, min: OrgRole) => !!role && ROLE_RANK[role] >= ROLE_RANK[min];

const DAY = 86_400_000;
const dayNum = (iso: string) => Math.round(Date.parse(`${iso}T00:00:00Z`) / DAY);
export const spanDays = (startsOn: string, endsOn: string) => dayNum(endsOn) - dayNum(startsOn);

/** Mirrors editions_dates_match_kind. Returns a human reason or null when the dates are valid for the kind. */
export function dateProblem(kind: EditionKind, startsOn: string, endsOn: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(startsOn) || !/^\d{4}-\d{2}-\d{2}$/.test(endsOn)) return "Choose a start and end date.";
  const n = spanDays(startsOn, endsOn);
  if (n < 0) return "The end date cannot be before the start date.";
  switch (kind) {
    case "single_day": return n === 0 ? null : "A single-day edition starts and ends on the same day.";
    case "multi_day": return n >= 1 && n <= 13 ? null : "A multi-day edition runs for 2 to 14 days.";
    case "week": return n >= 5 && n <= 9 ? null : "A week-long edition runs for 6 to 10 days.";
    default: return n <= 400 ? null : "Seasons and campaigns can run for up to 13 months.";
  }
}

/** Built-in Edition routes: organiser pages may not use these slugs. */
export const RESERVED_PAGE_SLUGS = ["programme", "updates", "partners", "sponsors", "organiser", "preview", "opengraph-image"] as const;
export const isReservedPageSlug = (s: string) => (RESERVED_PAGE_SLUGS as readonly string[]).includes(s);

export const slugify = (s: string) =>
  s.toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/&/g, " and ").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60);
export const validSlug = (s: string, min = 3, max = 80) => s.length >= min && s.length <= max && /^[a-z0-9]+(-[a-z0-9]+)*$/.test(s);

/** Brand colours. A hex accent is used for the hero band, so white text on it must be readable. */
export const isHex = (c: string | null | undefined): c is string => !!c && /^#[0-9a-fA-F]{6}$/.test(c);
export function luminance(hex: string): number {
  const ch = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * ch[0] + 0.7152 * ch[1] + 0.0722 * ch[2];
}
export function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}
export const DEFAULT_ACCENT = "#0b5a73";
/** The accent actually used on screen: the Edition's, else its organiser's, else the platform's; low-contrast colours are darkened so white text always passes AA (4.5:1). */
export function safeAccent(...candidates: (string | null | undefined)[]): string {
  const c = candidates.find(isHex) ?? DEFAULT_ACCENT;
  let hex = c, guard = 0;
  while (contrast(hex, "#ffffff") < 4.5 && guard++ < 40) {
    const [r, g, b] = [1, 3, 5].map((i) => Math.max(0, Math.round(parseInt(hex.slice(i, i + 2), 16) * 0.92)));
    hex = `#${[r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("")}`;
  }
  return hex;
}
export const accentWarning = (hex: string | null | undefined) =>
  isHex(hex) && contrast(hex, "#ffffff") < 4.5 ? "This colour is too light for white text; it will be darkened automatically on the page." : null;

const TZ = "Europe/London";
const fmt = (opts: Intl.DateTimeFormatOptions, d: Date) => new Intl.DateTimeFormat("en-GB", { timeZone: TZ, ...opts }).format(d);
const asDate = (iso: string) => new Date(`${iso}T12:00:00Z`);

/** "14 Nov 2027", "14 to 16 Nov 2027", "30 Oct to 3 Nov 2027", "1 Jun to 31 Aug 2027". */
export function dateRangeLabel(startsOn: string, endsOn: string): string {
  const s = asDate(startsOn), e = asDate(endsOn);
  if (startsOn === endsOn) return fmt({ weekday: "short", day: "numeric", month: "long", year: "numeric" }, s);
  const sameYear = s.getUTCFullYear() === e.getUTCFullYear(), sameMonth = sameYear && s.getUTCMonth() === e.getUTCMonth();
  const a = fmt(sameMonth ? { day: "numeric" } : { day: "numeric", month: "short" }, s);
  const b = fmt({ day: "numeric", month: "short", year: "numeric" }, e);
  return `${a} to ${b}`;
}
export type Phase = "upcoming" | "running" | "ended";
export function phaseOf(ed: Pick<Edition, "starts_on" | "ends_on">, now = new Date()): Phase {
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(now);
  return today < ed.starts_on ? "upcoming" : today > ed.ends_on ? "ended" : "running";
}
export const PHASE_LABEL: Record<Phase, string> = { upcoming: "Coming up", running: "On now", ended: "Finished" };

/** Group programme sessions by Europe/London day, in time order. */
export function groupSessionsByDay(sessions: EditionSession[]): { day: string; label: string; items: EditionSession[] }[] {
  const days = new Map<string, EditionSession[]>();
  for (const s of [...sessions].sort((a, b) => Date.parse(a.starts_at) - Date.parse(b.starts_at) || a.position - b.position)) {
    const k = new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(new Date(s.starts_at));
    (days.get(k) ?? days.set(k, []).get(k)!).push(s);
  }
  return [...days.entries()].map(([day, items]) => ({ day, label: fmt({ weekday: "long", day: "numeric", month: "long" }, asDate(day)), items }));
}
/** The pieces of a day for typographic display, read in Europe/London: { weekday: "Thu", day: "9", month: "December", monthShort: "Dec" }. Accepts "2027-11-14" or a timestamp. */
export function dayParts(iso: string): { weekday: string; weekdayLong: string; day: string; month: string; monthShort: string; year: string } {
  const d = /^\d{4}-\d{2}-\d{2}$/.test(iso) ? asDate(iso) : new Date(iso);
  return {
    weekday: fmt({ weekday: "short" }, d), weekdayLong: fmt({ weekday: "long" }, d), day: fmt({ day: "numeric" }, d),
    month: fmt({ month: "long" }, d), monthShort: fmt({ month: "short" }, d), year: fmt({ year: "numeric" }, d),
  };
}
export const timeLabel = (iso: string) => fmt({ hour: "2-digit", minute: "2-digit", hour12: false }, new Date(iso));

/** Navigation: the pages marked in_nav, home first, then by position. The programme and updates are built-in entries. */
export function navFor(pages: EditionPage[]): { slug: string; label: string; isHome: boolean }[] {
  return [...pages].filter((p) => p.in_nav || p.is_home).sort((a, b) => Number(b.is_home) - Number(a.is_home) || a.position - b.position)
    .map((p) => ({ slug: p.slug, label: p.nav_label, isHome: p.is_home }));
}

/** One line of the Edition checklist, exactly as the database reports it (edition_readiness). `required` items must be done before the Edition can be submitted for review. */
export type ReadinessItem = { key: string; label: string; required: boolean; ok: boolean; hint: string };
export type Readiness = ReadinessItem[];
/** Reads the database's checklist defensively: anything malformed is dropped, so the page never breaks on an unexpected shape. */
export function parseReadiness(raw: unknown): Readiness {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((r): ReadinessItem[] => {
    const x = r as Partial<ReadinessItem> | null;
    return x && typeof x.key === "string" && typeof x.label === "string" ? [{ key: x.key, label: x.label, required: x.required === true, ok: x.ok === true, hint: typeof x.hint === "string" ? x.hint : "" }] : [];
  });
}
export const missingRequired = (r: Readiness): ReadinessItem[] => r.filter((x) => x.required && !x.ok);
/** The database refuses a submission while a required item is missing; this lets the screen explain it first. An empty list (not loaded) never counts as ready. */
export const canSubmit = (r: Readiness) => r.length > 0 && missingRequired(r).length === 0;

const PARTNER_PASSTHROUGH = /run by that Hub already|that package is for Hub-run|the Hub is not taking part yet|choose at most 12|a Hub can only show|items can only be attached|not been claimed|declined recently|several invitations waiting|too many invitations|already invited|not open for new partners|not available to (invite|show)|Pro or Premium|choose up to 6|already been answered|only the (owner|organiser|sender)|lot of requests waiting|edition not found|approve the invitation first/i;

/** Error text from a Postgres/PostgREST refusal, in words an organiser can act on. */
export function friendlyError(message: string | null | undefined): string {
  const m = message ?? "";
  const table: [RegExp, string][] = [
    [/ownership comes from the Business or Hub/i, "Ownership stays with your Business or Hub, so a helper can be an administrator or an editor."],
    [/only the Business owner/i, "Only the Business owner can use Editions for it."],
    [/Business not found/i, "That Business could not be found, or it has not been claimed yet."],
    [/finish these first/i, "Finish the required items before you submit."],
    [/already submitted for review/i, "This Edition is already waiting for review."],
    [/already approved/i, "This Edition is already approved."],
    [/not waiting for review/i, "This Edition is not waiting for review."],
    [/too many submissions/i, "You have submitted this Edition several times today. Please wait before submitting it again."],
    [/not been approved by OneShetland/i, "OneShetland needs to approve this Edition before it can be published."],
    [/once OneShetland has approved the Edition/i, "You can choose a package once OneShetland has approved this Edition."],
    [/the Business or Hub is not active/i, "Your Business or Hub is not active, so its Editions are paused."],
    [/that package is free: claim it/i, "That package is free: choose it without paying."],
    [/already has an active package/i, "This Edition already has an active package."],
    [/only an owner or admin can/i, "Only an owner or administrator can choose or buy a package."],
    [/that package is not available/i, "That package is not available."],
    [/enter a valid email address/i, "Enter a valid email address."],
    [/payments are not switched on/i, "Online payment is not available at the moment."],
    [/no live publish entitlement/i, "This Edition has no active package yet. Choose a package first."],
    [/only the Hub.s owner or committee/i, "Only the Hub's owner or committee can set up Editions for it."],
    [/already has an Editions organiser/i, "This Hub already has Editions set up."],
    [/Editions is not open yet|editions_dark/i, "Editions is not open to Hubs yet. OneShetland will let you know when it is."],
    [/organiser is not verified/i, "Your Edition is not ready to go public yet."],
    [/summary is required/i, "Add a short summary before publishing."],
    [/suspended by OneShetland/i, "OneShetland has suspended this Edition. Get in touch with OneShetland to resolve it."],
    [/outside the edition dates/i, "That session falls outside the Edition's dates."],
    [/venue belongs to another/i, "That venue belongs to another organiser."],
    [/at least one owner/i, "An organiser must always keep at least one owner."],
    [/organiser limit reached/i, "You have reached the limit for organiser profiles."],
    [/team limit reached/i, "The team is full."],
    [/that address is reserved/i, "That address is reserved. Choose another."],
    [/duplicate key|already exists|unique/i, "That address or name is already in use."],
    [/violates check constraint .*edition_sessions_ticket_url/i, "Add a ticket link, or set tickets to none."],
    [/editions_dates_match_kind/i, "The dates do not fit that kind of Edition."],
    [/permission denied|row-level security|42501/i, "You do not have permission to do that."],
  ];
  const hit = table.find(([re]) => re.test(m))?.[1];
  if (hit) return hit;
  // Partnership refusals are already written for people by the database; show them as a sentence.
  if (PARTNER_PASSTHROUGH.test(m)) {
    const clean = m.replace(/^ERROR:\s*/i, "").trim();
    return clean.charAt(0).toUpperCase() + clean.slice(1) + (/[.!?]$/.test(clean) ? "" : ".");
  }
  return "Something went wrong. Please try again.";
}

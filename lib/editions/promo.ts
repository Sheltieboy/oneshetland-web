/**
 * Promotion (Showcase and extra promotions): pure types, dates and rules. No I/O, no React. The database is the authority on every booking; these helpers
 * decide what the picker offers and what the screens say, so a refusal is rare and every case is unit-tested.
 * All dates are whole days in Europe/London, passed to the database explicitly as YYYY-MM-DD.
 */

export const LONDON = "Europe/London";
const DAY = 86_400_000;

export type PromoKind = "discovery" | "homepage";

export type PromoSettings = {
  homepageCapacity: number; discoveryCapacity: number; homepageVisible: number; discoveryVisible: number;
  leadDays: number; horizonDays: number; homepageDaysPer90: number; rescheduleNoticeDays: number; renewalWindowDays: number;
  /** The configurable note shown after a price. Empty means show nothing. */
  vatNote: string;
};
export const DEFAULT_PROMO_SETTINGS: PromoSettings = {
  homepageCapacity: 3, discoveryCapacity: 6, homepageVisible: 3, discoveryVisible: 4, leadDays: 2, horizonDays: 180, homepageDaysPer90: 14, rescheduleNoticeDays: 3, renewalWindowDays: 30, vatNote: "",
};
const int = (v: unknown, d: number) => (typeof v === "number" && Number.isFinite(v) && v >= 0 ? Math.floor(v) : d);
/** Reads edition_promo_settings() defensively; anything missing falls back to the database's own defaults. */
export function parsePromoSettings(raw: unknown): PromoSettings {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const d = DEFAULT_PROMO_SETTINGS;
  return {
    homepageCapacity: int(r.homepage_capacity, d.homepageCapacity), discoveryCapacity: int(r.discovery_capacity, d.discoveryCapacity),
    homepageVisible: int(r.homepage_visible, d.homepageVisible), discoveryVisible: int(r.discovery_visible, d.discoveryVisible),
    leadDays: int(r.lead_days, d.leadDays), horizonDays: int(r.horizon_days, d.horizonDays), homepageDaysPer90: int(r.homepage_days_per_90, d.homepageDaysPer90),
    rescheduleNoticeDays: int(r.reschedule_notice_days, d.rescheduleNoticeDays), renewalWindowDays: int(r.renewal_window_days, d.renewalWindowDays),
    vatNote: typeof r.vat_note === "string" ? r.vat_note.trim().slice(0, 200) : "",
  };
}

/* ── price and note ────────────────────────────────────────────────────────────────────────────────────────── */

/** The price as an amount, followed by the configured note. Nothing is calculated: the note is OneShetland's wording, shown as given (or not at all). */
export function priceWithNote(amount: string, note: string | null | undefined): { amount: string; note: string; text: string } {
  const n = (note ?? "").trim();
  return { amount, note: n, text: n ? `${amount} ${n}` : amount };
}

/* ── dates (Europe/London) ─────────────────────────────────────────────────────────────────────────────────── */

const ISO = /^\d{4}-\d{2}-\d{2}$/;
export const isIsoDay = (s: unknown): s is string => typeof s === "string" && ISO.test(s) && !Number.isNaN(Date.parse(`${s}T00:00:00Z`));
const num = (iso: string) => Math.round(Date.parse(`${iso}T00:00:00Z`) / DAY);
const fromNum = (n: number) => new Date(n * DAY).toISOString().slice(0, 10);
/** Today's date in Europe/London, as YYYY-MM-DD. Around midnight this differs from the UTC date during British Summer Time. */
export const londonToday = (now: Date = new Date()): string => new Intl.DateTimeFormat("en-CA", { timeZone: LONDON, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
/** The Europe/London calendar day of a timestamp. */
export const londonDay = (ts: string | Date): string => londonToday(typeof ts === "string" ? new Date(ts) : ts);
export const addDays = (iso: string, n: number): string => fromNum(num(iso) + n);
export const daysBetween = (a: string, b: string): number => num(b) - num(a);
/** Last day of a run of `days` whole days starting on `start` (inclusive). */
export const endDay = (start: string, days: number): string => addDays(start, days - 1);
export const dayText = (iso: string): string => new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", weekday: "short", day: "numeric", month: "short", year: "numeric" }).format(new Date(`${iso}T12:00:00Z`));
export const dayTextShort = (iso: string): string => new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", day: "numeric", month: "short", year: "numeric" }).format(new Date(`${iso}T12:00:00Z`));
export const monthText = (iso: string): string => new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", month: "long", year: "numeric" }).format(new Date(`${iso}T12:00:00Z`));
/** "14 Dec 2026 to 24 Jan 2027" */
export const runText = (start: string, end: string): string => `${dayTextShort(start)} to ${dayTextShort(end)}`;

export type BookingWindow = { earliest: string; latestStart: string; lastDay: string } | null;
/**
 * Where a run of `days` days may start. The earliest start is the later of (today + lead time) and the day the Edition was published; the run must finish on or
 * before the last whole day of the publishing period (the day before it ends, in London) and start no further ahead than the horizon. Null when no start is possible.
 */
export function bookingWindow(a: { today: string; leadDays: number; horizonDays: number; publishedOn: string | null; entitlementEnd: string | null; days: number; timing?: boolean }): BookingWindow {
  if (!a.publishedOn || !a.entitlementEnd || a.days < 1) return null;
  const timing = a.timing !== false;
  const lastDay = addDays(londonDay(a.entitlementEnd), -1);
  const earliest = [a.publishedOn, timing ? addDays(a.today, a.leadDays) : a.today].reduce((x, y) => (x >= y ? x : y));
  const byEnd = addDays(lastDay, -(a.days - 1));
  const byHorizon = timing ? addDays(a.today, a.horizonDays) : byEnd;
  const latestStart = byEnd <= byHorizon ? byEnd : byHorizon;
  return earliest <= latestStart ? { earliest, latestStart, lastDay } : null;
}

/* ── availability ──────────────────────────────────────────────────────────────────────────────────────────── */

export type AvailRow = { day: string; capacity: number; booked: number; remaining: number };
export type AvailMap = Record<string, number>;
export function parseAvailability(raw: unknown): AvailRow[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((r): AvailRow[] => {
    const x = r as Record<string, unknown> | null;
    return x && isIsoDay(x.day) && typeof x.remaining === "number" ? [{ day: x.day, capacity: Number(x.capacity ?? 0), booked: Number(x.booked ?? 0), remaining: Math.max(0, x.remaining) }] : [];
  });
}
/** Places left per day. `own` gives a booking back its own days, so moving it never counts against itself. */
export function availabilityMap(rows: AvailRow[], own?: { start: string; end: string } | null, capacity?: number): AvailMap {
  const m: AvailMap = {};
  for (const r of rows) {
    let left = r.remaining;
    if (own && r.day >= own.start && r.day <= own.end) left = Math.min(capacity ?? r.capacity, left + 1);
    m[r.day] = left;
  }
  return m;
}
/** The fewest places left across a run starting on `start`, or 0 when any day is full or not known (an unknown day is never offered). */
export function placesLeft(start: string, days: number, avail: AvailMap): number {
  let min = Infinity;
  for (let i = 0; i < days; i++) { const v = avail[addDays(start, i)]; if (v === undefined) return 0; if (v < min) min = v; }
  return min === Infinity ? 0 : min;
}
export type StartState = { ok: boolean; places: number; reason: "ok" | "outside" | "full" | "no_data" };
/** Can a run of `days` days start on `start`? Explains why not, for the picker's labels. */
export function startState(start: string, days: number, win: BookingWindow, avail: AvailMap, limits?: { from: string; to: string }): StartState {
  if (!win || start < win.earliest || start > win.latestStart) return { ok: false, places: 0, reason: "outside" };
  if (limits && (start < limits.from || start > limits.to)) return { ok: false, places: 0, reason: "outside" };
  if (avail[start] === undefined) return { ok: false, places: 0, reason: "no_data" };
  const places = placesLeft(start, days, avail);
  return places > 0 ? { ok: true, places, reason: "ok" } : { ok: false, places: 0, reason: "full" };
}
/** Every day in [from, to], inclusive. */
export function eachDay(from: string, to: string): string[] {
  const out: string[] = []; for (let n = num(from); n <= num(to) && out.length < 800; n++) out.push(fromNum(n)); return out;
}
/** Weekday column (Monday = 0) of a day. */
export const weekdayIndex = (iso: string) => (new Date(`${iso}T12:00:00Z`).getUTCDay() + 6) % 7;
export const monthStart = (iso: string) => `${iso.slice(0, 7)}-01`;
export const addMonths = (iso: string, n: number) => { const d = new Date(`${monthStart(iso)}T12:00:00Z`); d.setUTCMonth(d.getUTCMonth() + n); return d.toISOString().slice(0, 10); };

/* ── rights ────────────────────────────────────────────────────────────────────────────────────────────────── */

export type RightStatus = "unused" | "booked" | "used" | "void";
export type PromoRight = { right_id: string; kind: PromoKind; days: number; group_id: string | null; source: string; status: RightStatus; booking_id: string | null; starts_on: string | null; ends_on: string | null; created_at: string; void_reason: string | null };
const STATUSES: RightStatus[] = ["unused", "booked", "used", "void"];
export function parseRights(raw: unknown): PromoRight[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((r): PromoRight[] => {
    const x = r as Record<string, unknown> | null;
    if (!x || typeof x.right_id !== "string" || (x.kind !== "discovery" && x.kind !== "homepage") || typeof x.days !== "number" || !STATUSES.includes(x.status as RightStatus)) return [];
    return [{ right_id: x.right_id, kind: x.kind, days: x.days, group_id: typeof x.group_id === "string" ? x.group_id : null, source: String(x.source ?? ""), status: x.status as RightStatus,
      booking_id: typeof x.booking_id === "string" ? x.booking_id : null, starts_on: isIsoDay(x.starts_on) ? x.starts_on : null, ends_on: isIsoDay(x.ends_on) ? x.ends_on : null,
      created_at: String(x.created_at ?? ""), void_reason: typeof x.void_reason === "string" ? x.void_reason : null }];
  });
}
/** One thing the organiser can schedule: a campaign (a discovery window with homepage days inside it) or a single run. */
export type PromoItem = { key: string; kind: "campaign" | "discovery" | "homepage"; discovery: PromoRight | null; homepage: PromoRight | null };
/** Groups rights into campaigns and singles. Void rights are left out (they are not something you can use). A homepage right whose discovery right is void stands alone. */
export function groupRights(rights: PromoRight[]): PromoItem[] {
  const live = rights.filter((r) => r.status !== "void");
  const byGroup = new Map<string, PromoRight[]>();
  const items: PromoItem[] = [];
  for (const r of live) if (r.group_id) (byGroup.get(r.group_id) ?? byGroup.set(r.group_id, []).get(r.group_id)!).push(r);
  const seen = new Set<string>();
  for (const r of live) {
    if (r.group_id) {
      if (seen.has(r.group_id)) continue; seen.add(r.group_id);
      const g = byGroup.get(r.group_id)!, d = g.find((x) => x.kind === "discovery") ?? null, h = g.find((x) => x.kind === "homepage") ?? null;
      items.push(d && h ? { key: r.group_id, kind: "campaign", discovery: d, homepage: h } : { key: r.right_id, kind: r.kind, discovery: d, homepage: h });
    } else items.push({ key: r.right_id, kind: r.kind, discovery: r.kind === "discovery" ? r : null, homepage: r.kind === "homepage" ? r : null });
  }
  return items;
}
export const unbookedCount = (rights: PromoRight[]) => rights.filter((r) => r.status === "unused").length;
/** Unused first, then booked (soonest first), then used. */
export const RIGHT_ORDER: Record<RightStatus, number> = { unused: 0, booked: 1, used: 2, void: 3 };
export const rightLabel = (r: Pick<PromoRight, "kind" | "days">) => `${r.days} ${r.days === 1 ? "day" : "days"} of ${r.kind === "homepage" ? "homepage featuring" : "enhanced discovery"}`;
export const STATUS_LABEL: Record<RightStatus, string> = { unused: "Not scheduled", booked: "Scheduled", used: "Done", void: "Cancelled" };

/** A booking can be moved or cancelled while it starts at least `noticeDays` days away (today counts as day zero). */
export function canChangeBooking(startsOn: string, today: string, noticeDays: number): boolean { return daysBetween(today, startsOn) >= noticeDays; }

/* ── report ────────────────────────────────────────────────────────────────────────────────────────────────── */

export type ReportRow = { booking_id: string; kind: PromoKind; status: string; starts_on: string; ends_on: string; shown: number; taps: number; views: number; saves: number; plan_adds: number };
export function parseReport(raw: unknown): ReportRow[] {
  if (!Array.isArray(raw)) return [];
  const n = (v: unknown) => { const x = Number(v); return Number.isFinite(x) && x >= 0 ? x : 0; };
  return raw.flatMap((r): ReportRow[] => {
    const x = r as Record<string, unknown> | null;
    if (!x || typeof x.booking_id !== "string" || (x.kind !== "discovery" && x.kind !== "homepage") || !isIsoDay(x.starts_on) || !isIsoDay(x.ends_on)) return [];
    return [{ booking_id: x.booking_id, kind: x.kind, status: String(x.status ?? "booked"), starts_on: x.starts_on, ends_on: x.ends_on, shown: n(x.shown), taps: n(x.taps), views: n(x.views), saves: n(x.saves), plan_adds: n(x.plan_adds) }];
  });
}
export const KIND_TEXT: Record<PromoKind, string> = { discovery: "Enhanced discovery", homepage: "Homepage featuring" };
export const REPORT_NOTE = "Times shown, taps and views are indicative: they count what we can see, and a person can be counted more than once. Saves and plan additions are exact counts.";

/** The plain-English explanation of how featured places are shared. */
export function sharedPlacementText(s: Pick<PromoSettings, "homepageVisible" | "discoveryVisible">): string {
  return `Featured places are shared. A strip of up to ${s.homepageVisible} Editions appears on the homepage and up to ${s.discoveryVisible} at the top of the Editions list, rotated daily so nobody is always first. Every one is labelled Promoted.`;
}

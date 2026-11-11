/** The promotion calendar for administrators. Pure: shapes admin_edition_promo_calendar rows, validates the date range, and words the database's refusals. */
export type PromoKind = "homepage" | "discovery";
export const KIND_TITLE: Record<PromoKind, string> = { homepage: "Homepage", discovery: "Enhanced discovery" };

export type CalendarBooking = { booking_id: string; edition_id: string; edition_title: string; organiser_name: string; starts_on: string; ends_on: string };
export type CalendarDay = { day: string; kind: PromoKind; capacity: number; booked: number; bookings: CalendarBooking[] };
export type BookingRow = CalendarBooking & { kind: PromoKind; peak: number };

const ISO = /^\d{4}-\d{2}-\d{2}$/;
export const isIsoDay = (s: unknown): s is string => typeof s === "string" && ISO.test(s) && !Number.isNaN(Date.parse(`${s}T00:00:00Z`)) && new Date(`${s}T00:00:00Z`).toISOString().slice(0, 10) === s;
const dayMs = (s: string) => Date.parse(`${s}T00:00:00Z`);
export const addDays = (s: string, n: number) => new Date(dayMs(s) + n * 864e5).toISOString().slice(0, 10);
export const londonToday = (now = new Date()) => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/London" }).format(now);

export const DEFAULT_SPAN = 60;
export const MAX_SPAN = 400;
/** The range to show: the two dates in the address if they are valid and not more than 400 days apart, otherwise today for 60 days. */
export function parseRange(from: unknown, to: unknown, now = new Date()): { from: string; to: string } {
  const today = londonToday(now);
  const f = isIsoDay(from) ? from : today;
  const t = isIsoDay(to) && dayMs(to) >= dayMs(f) && dayMs(to) - dayMs(f) <= MAX_SPAN * 864e5 ? to : addDays(f, DEFAULT_SPAN);
  return { from: f, to: t };
}

const num = (v: unknown, d = 0) => (typeof v === "number" && Number.isFinite(v) ? v : Number.isFinite(Number(v)) ? Number(v) : d);
/** Keep only well-formed rows; anything unexpected is dropped rather than shown wrongly. */
export function parseCalendar(rows: unknown): CalendarDay[] {
  if (!Array.isArray(rows)) return [];
  const out: CalendarDay[] = [];
  for (const r of rows) {
    if (!r || typeof r !== "object") continue;
    const o = r as Record<string, unknown>;
    if (!isIsoDay(o.day) || (o.kind !== "homepage" && o.kind !== "discovery")) continue;
    const bookings = (Array.isArray(o.bookings) ? o.bookings : []).flatMap((b): CalendarBooking[] => {
      const x = b as Record<string, unknown> | null;
      return x && typeof x.booking_id === "string" && isIsoDay(x.starts_on) && isIsoDay(x.ends_on) ? [{ booking_id: x.booking_id, edition_id: String(x.edition_id ?? ""), edition_title: String(x.edition_title ?? "An Edition"), organiser_name: String(x.organiser_name ?? ""), starts_on: x.starts_on, ends_on: x.ends_on }] : [];
    });
    out.push({ day: o.day, kind: o.kind, capacity: num(o.capacity), booked: num(o.booked), bookings });
  }
  return out;
}

/** One row per booking (it appears on many days), in start order, with its busiest day. */
export function bookingRows(days: CalendarDay[]): BookingRow[] {
  const m = new Map<string, BookingRow>();
  for (const d of days) for (const b of d.bookings) {
    const cur = m.get(b.booking_id);
    if (cur) cur.peak = Math.max(cur.peak, d.booked); else m.set(b.booking_id, { ...b, kind: d.kind, peak: d.booked });
  }
  return [...m.values()].sort((a, b) => a.starts_on.localeCompare(b.starts_on) || a.kind.localeCompare(b.kind) || a.edition_title.localeCompare(b.edition_title));
}

export type Usage = "free" | "some" | "full" | "over";
export const usageOf = (d: Pick<CalendarDay, "booked" | "capacity">): Usage => (d.booked > d.capacity ? "over" : d.booked >= d.capacity && d.capacity > 0 ? "full" : d.booked > 0 ? "some" : "free");
export const usageLabel = (d: Pick<CalendarDay, "booked" | "capacity">) => `${d.booked} of ${d.capacity} booked`;
/** Per kind: how many days are full, and the busiest day. */
export function summarise(days: CalendarDay[], kind: PromoKind) {
  const k = days.filter((d) => d.kind === kind);
  return { days: k.length, full: k.filter((d) => usageOf(d) === "full" || usageOf(d) === "over").length, booked: k.reduce((a, d) => a + d.booked, 0), capacity: k[0]?.capacity ?? 0 };
}

export const GRANT_DAYS = { min: 1, max: 120 } as const;
export const REASON_MIN = 5;
export function validateReason(reason: unknown): { ok: true; reason: string } | { ok: false; error: string } {
  const r = String(reason ?? "").trim();
  return r.length >= REASON_MIN ? { ok: true, reason: r.slice(0, 500) } : { ok: false, error: `Give a reason of at least ${REASON_MIN} characters. It is kept in the audit trail.` };
}
export function validateGrant(input: { edition?: unknown; kind?: unknown; days?: unknown; reason?: unknown }): { ok: true; edition: string; kind: "discovery" | "homepage"; days: number; reason: string } | { ok: false; error: string } {
  const edition = String(input.edition ?? ""), kind = input.kind, days = Number(input.days);
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(edition)) return { ok: false, error: "Choose an Edition." };
  if (kind !== "discovery" && kind !== "homepage") return { ok: false, error: "Choose discovery or homepage days." };
  if (!Number.isInteger(days) || days < GRANT_DAYS.min || days > GRANT_DAYS.max) return { ok: false, error: `Choose ${GRANT_DAYS.min} to ${GRANT_DAYS.max} days.` };
  const r = validateReason(input.reason); if (!r.ok) return r;
  return { ok: true, edition, kind, days, reason: r.reason };
}

/** Staff-facing words for the database's hint codes (the organiser wording lives elsewhere). */
const HINT: Record<string, string> = {
  reason_required: "Give a reason of at least 5 characters.",
  bad_range: "Choose a range of up to 400 days.",
  bad_days: "A grant is for 1 to 120 days.",
  full: "One of those days is already full. Choose another start date.",
  already_booked: "That organiser already has this kind of promotion on some of those days.",
  fairness_limit: "That would take the organiser over the homepage-days limit for any 90 days.",
  outside_publish_window: "The days must finish inside the period the Edition is published for.",
  too_early: "That is before the Edition was published.",
  not_live: "The Edition must be approved and published first.",
  no_entitlement: "The Edition has no live publishing period.",
  outside_discovery: "Homepage days must stay inside the discovery days of the same campaign.",
  homepage_would_fall_outside: "Moving the discovery days would leave its homepage days outside them. Move the homepage days first.",
  not_booked: "That booking has already been cancelled or has finished.",
  too_far: "That is too far ahead to book.",
};
export function promoError(message: string | null | undefined, hint?: string | null): string {
  const h = (hint ?? "").trim();
  if (h && HINT[h]) return HINT[h];
  if (/admins only/i.test(message ?? "")) return "Only administrators can do this.";
  if (/booking not found/i.test(message ?? "")) return "That booking could not be found.";
  if (/edition not found/i.test(message ?? "")) return "That Edition could not be found.";
  return "That could not be done. Check the dates and try again.";
}

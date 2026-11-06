/**
 * activities.ts — Regular Activities, the pure parts: labels, schedule wording, London-time windows and form validation.
 *
 * One listing per activity; its sessions are COMPUTED by the database (activity_sessions) in Europe/London. Nothing here stores or expands
 * sessions. Everything shown to a visitor is formatted in Shetland time, whatever clock the viewer's device keeps.
 */

export const ACTIVITY_CATEGORIES = [
  { value: "fitness", label: "Fitness & movement" },
  { value: "kids_family", label: "Kids & families" },
  { value: "social", label: "Social & community" },
  { value: "arts_crafts", label: "Arts & crafts" },
  { value: "sport", label: "Sport" },
  { value: "wellbeing", label: "Wellbeing" },
  { value: "music", label: "Music" },
  { value: "learning", label: "Learning" },
  { value: "faith", label: "Faith" },
  { value: "other", label: "Other" },
] as const;
export type ActivityCategory = (typeof ACTIVITY_CATEGORIES)[number]["value"];
export const CATEGORY_LABEL: Record<string, string> = Object.fromEntries(ACTIVITY_CATEGORIES.map((c) => [c.value, c.label]));

export const BOOKING_MODES = [
  { value: "drop_in", label: "Drop in, no booking needed" },
  { value: "contact", label: "Get in touch to join" },
  { value: "link", label: "Book through a website" },
] as const;
export type BookingMode = (typeof BOOKING_MODES)[number]["value"];

export type SessionStatus = "scheduled" | "cancelled" | "break" | "moved" | "changed" | "extra";
export type SessionRow = {
  activity_id?: string; rule_id: string | null; exception_id: string | null; occurrence_date: string | null; original_starts_at: string | null;
  starts_at: string; ends_at: string; status: SessionStatus; venue: string | null; locality: string | null; note: string | null; is_extra?: boolean;
};
export type UpcomingSession = { starts_at: string; ends_at: string; status: SessionStatus; venue: string | null; note: string | null };

/** One row of regular_activities_listing(): a card. */
export type ListingRow = {
  id: string; slug: string; title: string; description: string | null; category: string; audience: string | null; venue: string | null;
  locality: string | null; price_text: string | null; booking_mode: BookingMode; cover_url: string | null;
  owner_kind: "business" | "hub" | "platform"; owner_id: string | null; owner_name: string; owner_slug: string | null;
  next_starts_at: string | null; next_ends_at: string | null; sessions_in_window: number; cancelled_in_window: number; upcoming: UpcomingSession[];
};

export type RuleRow = {
  id?: string; day_of_week: number; start_time: string; end_time: string; interval_weeks?: number; label?: string | null;
  venue?: string | null; locality?: string | null; is_active?: boolean;
};

export const TZ = "Europe/London";
const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
export const DAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
export const DAY_LONG = DAY_NAMES;
/** Display order for a week that starts on Monday, as people read a timetable. */
export const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0];

/* ── Shetland time ─────────────────────────────────────────────────────────────────────────────────────────────────────────── */
function parts(d: Date, opts: Intl.DateTimeFormatOptions): Record<string, string> {
  const out: Record<string, string> = {};
  for (const p of new Intl.DateTimeFormat("en-GB", { ...opts, timeZone: TZ }).formatToParts(d)) out[p.type] = p.value;
  return out;
}
/** "2026-11-07" for the London calendar date of an instant. */
export function londonDate(d: Date | string): string {
  const p = parts(new Date(d), { year: "numeric", month: "2-digit", day: "2-digit" });
  return `${p.year}-${p.month}-${p.day}`;
}
/** 0 (Sunday) to 6, in London. */
export function londonDow(d: Date | string): number {
  return DAY_SHORT.indexOf(parts(new Date(d), { weekday: "short" }).weekday);
}
/** The instant London's midnight starts the given calendar date ("YYYY-MM-DD"). Correct across clock changes. */
export function londonMidnight(ymd: string): Date {
  const [y, m, d] = ymd.split("-").map(Number);
  const guess = new Date(Date.UTC(y, m - 1, d, 0, 0, 0));
  // London is UTC+0 or UTC+1: if UTC midnight is 01:00 in London, the London day began an hour earlier.
  const hour = Number(parts(guess, { hour: "2-digit", hour12: false }).hour) % 24;
  return new Date(guess.getTime() - hour * 3_600_000);
}
export function addDays(ymd: string, n: number): string {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}
export const timeHM = (iso: string | Date) => { const p = parts(new Date(iso), { hour: "2-digit", minute: "2-digit", hour12: false }); return `${p.hour}:${p.minute}`; };
export const dayShort = (iso: string | Date) => { const p = parts(new Date(iso), { weekday: "short", day: "numeric", month: "short" }); return `${p.weekday} ${p.day} ${p.month}`; };
export const dayLong = (iso: string | Date) => { const p = parts(new Date(iso), { weekday: "long", day: "numeric", month: "long" }); return `${p.weekday} ${p.day} ${p.month}`; };

/** "Today", "Tomorrow" or "Sat 7 Nov", relative to `now`, in London. */
export function dayLabel(iso: string | Date, now: Date = new Date()): string {
  const d = londonDate(iso), today = londonDate(now);
  if (d === today) return "Today";
  if (d === addDays(today, 1)) return "Tomorrow";
  return dayShort(iso);
}
export const timeRange = (start: string, end: string) => `${timeHM(start)}–${timeHM(end)}`;

/* ── Windows ──────────────────────────────────────────────────────────────────────────────────────────────────────────────── */
export type When = "today" | "tomorrow" | "week" | "fortnight" | "month";
export const WHEN_OPTIONS: { value: When; label: string }[] = [
  { value: "today", label: "Today" },
  { value: "tomorrow", label: "Tomorrow" },
  { value: "week", label: "This week" },
  { value: "fortnight", label: "Next 14 days" },
  { value: "month", label: "This month" },
];
export const DEFAULT_WHEN: When = "fortnight";
export const parseWhen = (v: string | undefined): When => (WHEN_OPTIONS.some((o) => o.value === v) ? (v as When) : DEFAULT_WHEN);

/** [from, to) as ISO instants, aligned to London midnights. Never more than 31 days (the database allows 93). */
export function windowFor(when: When, now: Date = new Date()): { from: string; to: string } {
  const today = londonDate(now);
  const span = { today: [0, 1], tomorrow: [1, 2], week: [0, 7], fortnight: [0, 14], month: [0, 31] }[when];
  return { from: londonMidnight(addDays(today, span[0])).toISOString(), to: londonMidnight(addDays(today, span[1])).toISOString() };
}
/** The What's On events date chips (today / week / month / all) mapped to a window for the regular-activities strip. */
export function whenForEventsRange(range: string): When {
  return range === "today" ? "today" : range === "week" ? "week" : range === "month" ? "month" : "fortnight";
}

/* ── Wording ──────────────────────────────────────────────────────────────────────────────────────────────────────────────── */
const hm = (t: string) => t.slice(0, 5);
const plural = (d: number) => `${DAY_NAMES[d]}s`;

/** "Tuesdays and Thursdays, 18:00–19:00" · "Fridays, 10:30–12:30" · "Every other Tuesday, 19:00–20:00". */
export function patternText(rules: RuleRow[]): string {
  const active = rules.filter((r) => r.is_active !== false);
  if (active.length === 0) return "Schedule to be confirmed";
  const groups = new Map<string, { days: number[]; start: string; end: string; every: number }>();
  for (const r of active) {
    const key = `${hm(r.start_time)}-${hm(r.end_time)}-${r.interval_weeks ?? 1}`;
    const g = groups.get(key) ?? { days: [], start: hm(r.start_time), end: hm(r.end_time), every: r.interval_weeks ?? 1 };
    if (!g.days.includes(r.day_of_week)) g.days.push(r.day_of_week);
    groups.set(key, g);
  }
  if (groups.size > 3) return "Several sessions each week";
  const list = (ds: number[]) => {
    const sorted = [...ds].sort((a, b) => WEEK_ORDER.indexOf(a) - WEEK_ORDER.indexOf(b));
    return sorted.length === 1 ? null : sorted.map(plural).reduce((acc, s, i, a) => (i === 0 ? s : i === a.length - 1 ? `${acc} and ${s}` : `${acc}, ${s}`), "");
  };
  return [...groups.values()]
    .sort((a, b) => Math.min(...a.days.map((d) => WEEK_ORDER.indexOf(d))) - Math.min(...b.days.map((d) => WEEK_ORDER.indexOf(d))))
    .map((g) => {
      const days = g.every > 1 ? `Every ${g.every === 2 ? "other" : `${g.every}th week:`} ${g.days.length === 1 ? DAY_NAMES[g.days[0]] : (list(g.days) ?? "")}` : (list(g.days) ?? plural(g.days[0]));
      return `${days}, ${g.start}–${g.end}`;
    })
    .join(" · ");
}

export const SESSION_STATUS_LABEL: Record<SessionStatus, string> = {
  scheduled: "", cancelled: "Cancelled", break: "Break", moved: "Moved", changed: "Changed", extra: "Extra session",
};
export const isLive = (s: { status: SessionStatus }) => s.status !== "cancelled" && s.status !== "break";

/** Group a flat session list by London day, in order. */
export function groupByDay<T extends { starts_at: string }>(rows: T[]): { day: string; rows: T[] }[] {
  const out: { day: string; rows: T[] }[] = [];
  for (const r of rows) {
    const day = londonDate(r.starts_at);
    const last = out[out.length - 1];
    if (last && last.day === day) last.rows.push(r); else out.push({ day, rows: [r] });
  }
  return out;
}

/** One line for a card: the next live session, or why there is none. */
export function nextLine(a: Pick<ListingRow, "next_starts_at" | "next_ends_at" | "sessions_in_window" | "cancelled_in_window">, now: Date = new Date()): { text: string; tone: "ok" | "warn" } {
  if (a.next_starts_at && a.next_ends_at) return { text: `Next: ${dayLabel(a.next_starts_at, now)} ${timeRange(a.next_starts_at, a.next_ends_at)}`, tone: "ok" };
  if (a.cancelled_in_window > 0) return { text: "No session in this period (cancelled or on a break)", tone: "warn" };
  return { text: "No sessions in this period", tone: "warn" };
}

/* ── Links ────────────────────────────────────────────────────────────────────────────────────────────────────────────────── */
export const activityHref = (slug: string, date?: string) => `/whats-on/regular/${slug}${date ? `?session=${date}` : ""}`;
export const REGULAR_HREF = "/whats-on/regular";

export type RegularFilters = { when: When; days: number[]; category?: string; locality?: string; dropIn?: boolean; q?: string };
export function regularHref(f: Partial<RegularFilters>): string {
  const q = new URLSearchParams();
  if (f.when && f.when !== DEFAULT_WHEN) q.set("when", f.when);
  if (f.days && f.days.length) q.set("days", [...f.days].sort().join(","));
  if (f.category) q.set("category", f.category);
  if (f.locality) q.set("place", f.locality);
  if (f.dropIn) q.set("dropin", "1");
  if (f.q) q.set("q", f.q);
  const s = q.toString();
  return s ? `${REGULAR_HREF}?${s}` : REGULAR_HREF;
}
export function parseDays(v: string | undefined): number[] {
  if (!v) return [];
  return [...new Set(v.split(",").map((x) => Number(x)).filter((n) => Number.isInteger(n) && n >= 0 && n <= 6))].slice(0, 7);
}
export const safeCategory = (v: string | undefined) => (v && ACTIVITY_CATEGORIES.some((c) => c.value === v) ? v : undefined);

/* ── Validation (the database enforces every one of these again) ──────────────────────────────────────────────────────────────── */
export type Check = { ok: boolean; errors: Record<string, string> };
const HTTPS = /^https:\/\/[^\s<>"]+$/;
export type ActivityDraft = {
  title: string; description: string; category: string; audience: string; venue: string; locality: string; price_text: string;
  booking_mode: string; contact_info: string; booking_url: string; active_from: string; active_until: string;
};
export function validateActivityDraft(d: ActivityDraft): Check {
  const e: Record<string, string> = {};
  if (!d.title.trim()) e.title = "Give it a name"; else if (d.title.trim().length > 120) e.title = "Keep the name under 120 characters";
  if (d.description.length > 4000) e.description = "Keep the description under 4,000 characters";
  if (!ACTIVITY_CATEGORIES.some((c) => c.value === d.category)) e.category = "Choose a category";
  if (d.audience.length > 80) e.audience = "Keep this under 80 characters";
  if (d.venue.length > 160) e.venue = "Keep the venue under 160 characters";
  if (d.locality.length > 80) e.locality = "Keep the area under 80 characters";
  if (d.price_text.length > 80) e.price_text = "Keep the price under 80 characters";
  if (d.contact_info.length > 300) e.contact_info = "Keep this under 300 characters";
  if (!BOOKING_MODES.some((b) => b.value === d.booking_mode)) e.booking_mode = "Choose how people join";
  if (d.booking_mode === "link" && !HTTPS.test(d.booking_url.trim())) e.booking_url = "Enter a link starting https://";
  if (d.booking_mode === "contact" && !d.contact_info.trim()) e.contact_info = "Say how people should get in touch";
  if (d.active_from && d.active_until && d.active_until < d.active_from) e.active_until = "The end date is before the start date";
  return { ok: Object.keys(e).length === 0, errors: e };
}
export function validateRuleDraft(r: { day_of_week: number; start_time: string; end_time: string }): Check {
  const e: Record<string, string> = {};
  if (!(r.day_of_week >= 0 && r.day_of_week <= 6)) e.day = "Choose a day";
  if (!/^\d{2}:\d{2}$/.test(r.start_time)) e.start = "Enter a start time";
  if (!/^\d{2}:\d{2}$/.test(r.end_time)) e.end = "Enter an end time";
  if (!e.start && !e.end && r.end_time <= r.start_time) e.end = "The end must be after the start";
  return { ok: Object.keys(e).length === 0, errors: e };
}
export function validateBreakDraft(b: { start_date: string; end_date: string; reason: string }): Check {
  const e: Record<string, string> = {};
  if (!b.start_date) e.start = "Choose the first day";
  if (!b.end_date) e.end = "Choose the last day";
  if (b.start_date && b.end_date && b.end_date < b.start_date) e.end = "The last day is before the first";
  if (b.start_date && b.end_date && b.end_date >= b.start_date && (Date.parse(b.end_date) - Date.parse(b.start_date)) / 86_400_000 > 370) e.end = "A break can be at most a year";
  if (b.reason.length > 120) e.reason = "Keep the reason under 120 characters";
  return { ok: Object.keys(e).length === 0, errors: e };
}
/** A London wall-clock date + "HH:MM" → the UTC instant (ISO). Correct across clock changes. */
export function londonInstant(ymd: string, hm: string): string {
  const [h, m] = hm.split(":").map(Number);
  const mid = londonMidnight(ymd);
  // Add the wall-clock offset, then correct if the day had 23/25 hours (a clock change falls between midnight and the time).
  let t = new Date(mid.getTime() + (h * 60 + m) * 60_000);
  const got = timeHM(t);
  if (got !== hm) { const diff = (h * 60 + m) - (Number(got.slice(0, 2)) * 60 + Number(got.slice(3))); t = new Date(t.getTime() + diff * 60_000); }
  return t.toISOString();
}

/* ── Follower-alert queue health (staff) ──────────────────────────────────────────────────────────────────────────────────────── */
export type QueueStatus = { waiting: number; retrying: number; oldest_waiting_seconds: number | null; delivered_7d: number; failed_7d: number; last_error: string | null; last_run: string | null; followers: number };

/** Is the follower-alert job healthy? Waiting items should clear within a few minutes; anything older, or any failure, needs a look. */
export function queueHealth(q: QueueStatus | null, nowMs: number): { tone: "green" | "amber" | "red" | "gray"; text: string } {
  if (!q) return { tone: "gray", text: "Status unavailable" };
  if (q.failed_7d > 0) return { tone: "red", text: `${q.failed_7d} alert${q.failed_7d === 1 ? "" : "s"} could not be delivered in the last 7 days` };
  if (q.retrying > 0) return { tone: "amber", text: `${q.retrying} alert${q.retrying === 1 ? " is" : "s are"} being retried` };
  if (q.waiting > 0 && (q.oldest_waiting_seconds ?? 0) > 600) return { tone: "red", text: "Alerts have been waiting over 10 minutes: the scheduled job may not be running" };
  if (q.waiting > 0) return { tone: "green", text: `${q.waiting} waiting to go out (normally under 3 minutes)` };
  if (q.last_run && nowMs - Date.parse(q.last_run) > 7 * 86_400_000) return { tone: "gray", text: "Nothing waiting. The job has had nothing to do for a week" };
  return { tone: "green", text: "Nothing waiting" };
}

/**
 * Shared, JSX-free cruise helpers (safe to import from server components).
 * Mirrors the app's cruise helpers so web + app stay consistent.
 */

export type Barometer = "quiet" | "busy" | "very_busy" | "peak";

/** Cruise section identity colour (harbour blue). */
export const CRUISE_ACCENT = "#0e6e8c";

/** Lerwick harbour coordinates (map hub). */
export const LERWICK: [number, number] = [60.155, -1.145];

/** A marquee ship photo for the section hero band (served from cruise-media). */
export const CRUISE_HERO =
  "https://nkrtmakxygkvxuxriiil.supabase.co/storage/v1/object/public/cruise-media/viking-neptune.webp";

export const BAROMETER: Record<Barometer, { label: string; color: string; tint: string }> = {
  quiet:     { label: "Quiet",     color: "#1a8f7a", tint: "rgba(26,161,136,0.14)" },
  busy:      { label: "Busy",      color: "#b9831f", tint: "rgba(224,160,48,0.16)" },
  very_busy: { label: "Very busy", color: "#cf5f37", tint: "rgba(231,130,92,0.16)" },
  peak:      { label: "Peak",      color: "#c0392b", tint: "rgba(192,57,43,0.14)" },
};

export function baro(b: string | null | undefined): { label: string; color: string; tint: string } {
  return BAROMETER[(b as Barometer)] ?? BAROMETER.quiet;
}

// ── Time-scope selector (Season / Today / This weekend / This week) ──
export type CruiseScope = "season" | "today" | "weekend" | "week";
export const SCOPES: { key: CruiseScope; label: string }[] = [
  { key: "season", label: "Season" },
  { key: "today", label: "Today" },
  { key: "weekend", label: "This weekend" },
  { key: "week", label: "Next 7 days" },
];

function addDaysISO(iso: string, n: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
/** Monday=0 … Sunday=6 */
function dowMon0(iso: string): number {
  return (new Date(`${iso}T00:00:00Z`).getUTCDay() + 6) % 7;
}

/** Inclusive list of YYYY-MM-DD dates from `from` to `to`. */
export function datesBetween(from: string, to: string): string[] {
  const out: string[] = [];
  let cur = from;
  for (let i = 0; i < 60 && cur <= to; i++) { out.push(cur); cur = addDaysISO(cur, 1); }
  return out;
}

/**
 * Inclusive [from, to] date window for a scope, or null for the full season.
 * weekend = upcoming Sat+Sun (or what's left of the current weekend).
 * week    = a rolling next-7-days window (today through today+6).
 */
export function scopeRange(scope: CruiseScope, today: string): { from: string; to: string; label: string } | null {
  if (scope === "today") return { from: today, to: today, label: "Today" };
  if (scope === "week") {
    return { from: today, to: addDaysISO(today, 6), label: "Next 7 days" };
  }
  if (scope === "weekend") {
    const dow = dowMon0(today); // Sat=5, Sun=6
    if (dow === 5) return { from: today, to: addDaysISO(today, 1), label: "This weekend" };
    if (dow === 6) return { from: today, to: today, label: "This weekend" };
    const sat = addDaysISO(today, 5 - dow);
    return { from: sat, to: addDaysISO(sat, 1), label: "This weekend" };
  }
  return null;
}

export function fmtTime(iso?: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/London" });
}

export function fmtDateLong(date: string): string {
  return new Date(date + "T12:00:00Z").toLocaleDateString("en-GB", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
  });
}

export function fmtDateShort(date: string): string {
  return new Date(date + "T12:00:00Z").toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
}

/** Today's date (YYYY-MM-DD) in Shetland local time (Europe/London).
 *  Cruise season runs in BST, so UTC midnight ≠ local midnight — always use this for "today". */
export function londonToday(now: Date = new Date()): string {
  // en-CA renders ISO-style YYYY-MM-DD; timeZone pins it to Shetland local.
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/London", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

/** Decimal hour-of-day (0–24) in Shetland local time, for timeline plotting. */
export function londonHours(iso?: string | null): number | null {
  if (!iso) return null;
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", hour: "2-digit", minute: "2-digit", hour12: false }).formatToParts(new Date(iso));
  const h = Number(parts.find((p) => p.type === "hour")?.value ?? 0);
  const m = Number(parts.find((p) => p.type === "minute")?.value ?? 0);
  return h + m / 60;
}

/** Format a decimal Shetland hour (e.g. 13.5) as a friendly clock time like "1.30pm". */
export function fmtHourLabel(h: number): string {
  const hh = ((Math.floor(h) % 24) + 24) % 24;
  const mm = Math.round((h - Math.floor(h)) * 60);
  const ampm = hh < 12 ? "am" : "pm";
  const h12 = hh % 12 === 0 ? 12 : hh % 12;
  return mm === 0 ? `${h12}${ampm}` : `${h12}.${String(mm).padStart(2, "0")}${ampm}`;
}

type PeakVisit = { arrival_at: string | null; departure_at: string | null; est_pax: number | null };
/** Busiest footfall window of the day, derived from when passengers are ashore.
 *  Builds each ship's ashore interval (capping unknown departures at +6h, like the timeline),
 *  weights by est_pax, and returns the contiguous band where footfall stays near its peak. */
export function peakWindow(visits: PeakVisit[]): { from: number; to: number; label: string } | null {
  const spans = visits
    .map((v) => {
      const a = londonHours(v.arrival_at);
      let d = londonHours(v.departure_at);
      if (a == null) return null;
      if (d == null || d <= a) d = Math.min(24, a + 6);
      return { a, d, pax: Math.max(1, v.est_pax ?? 1) };
    })
    .filter(Boolean) as { a: number; d: number; pax: number }[];
  if (spans.length === 0) return null;

  // Sample footfall every 30 min across the in-port span.
  const lo = Math.min(...spans.map((s) => s.a));
  const hi = Math.max(...spans.map((s) => s.d));
  const STEP = 0.5;
  const slots: { t: number; pax: number }[] = [];
  for (let t = lo; t <= hi + 1e-9; t += STEP) {
    let pax = 0;
    for (const s of spans) if (t >= s.a && t <= s.d) pax += s.pax;
    slots.push({ t, pax });
  }
  const peak = Math.max(...slots.map((s) => s.pax));
  const threshold = peak * 0.7; // "near peak" band
  const busy = slots.filter((s) => s.pax >= threshold).map((s) => s.t);
  let from = Math.min(...busy);
  let to = Math.max(...busy) + STEP; // include the trailing half-hour
  // Round to friendly half-hours and keep within the day.
  from = Math.max(0, Math.floor(from * 2) / 2);
  to = Math.min(24, Math.ceil(to * 2) / 2);
  if (to - from < 1) to = Math.min(24, from + 1); // never narrower than an hour
  return { from, to, label: `${fmtHourLabel(from)}–${fmtHourLabel(to)}` };
}

export function hoursAshore(v: { time_in_port_hours: number | null; arrival_at: string | null; departure_at: string | null }): number | null {
  if (v.time_in_port_hours) return v.time_in_port_hours;
  if (v.arrival_at && v.departure_at) {
    return Math.round(((+new Date(v.departure_at) - +new Date(v.arrival_at)) / 3_600_000) * 10) / 10;
  }
  return null;
}

/** Live-tracking link. Uses MMSI/IMO when present, else a name search. */
export function trackUrl(ship?: { name: string; imo: string | null; mmsi: string | null } | null): string {
  if (!ship) return "https://www.marinetraffic.com/";
  if (ship.mmsi) return `https://www.marinetraffic.com/en/ais/details/ships/mmsi:${ship.mmsi}`;
  if (ship.imo) return `https://www.marinetraffic.com/en/ais/details/ships/imo:${ship.imo}`;
  return `https://www.marinetraffic.com/en/data/?asset_type=vessels&quicksearch=${encodeURIComponent(ship.name)}`;
}

/** A simple, honest "day ashore" suggestion scaled to hours in port (Lerwick-specific). */
export function ashorePlan(hours: number | null): string {
  if (hours != null && hours < 5) {
    return "Short call — keep it close: Commercial Street and the Lodberries, the Shetland Museum & Archives, and a café or knitwear shop before you head back aboard.";
  }
  return "A full day ashore: Commercial Street and the Lodberries, the Shetland Museum & Archives, lunch at a local café, knitwear and craft shops, and the Knab clifftop walk if the weather's fair.";
}

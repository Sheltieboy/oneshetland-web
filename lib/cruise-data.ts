import { publicClient } from "./supabase/public";
import type { Barometer } from "./cruise-shared";
import { portCoord, type Origin } from "./cruise-stats";
import { scopeRange, datesBetween, type CruiseScope } from "./cruise-shared";

export type CruiseShip = {
  id: string;
  name: string;
  slug: string | null;
  vessel_type: string | null;
  cruise_line: string | null;
  image_url: string | null;
  length_label: string | null;
  length_m: number | null;
  default_pax: number | null;
  imo: string | null;
  mmsi: string | null;
  is_large_ship: boolean;
};

export type CruiseVisit = {
  id: string;
  ship_id: string | null;
  ship_name_cache: string | null;
  arrival_at: string | null;
  departure_at: string | null;
  visit_date: string | null;
  from_location: string | null;
  to_location: string | null;
  berth: string | null;
  berth_area_group: string | null;
  is_tender: boolean;
  time_in_port_hours: number | null;
  est_pax: number | null;
  est_pax_label: string | null;
  est_passenger_range: string | null;
  status: string;
  headline_text: string | null;
  social_caption: string | null;
  ship: CruiseShip | null;
};

export type CruiseDay = {
  visit_date: string;
  ships_count: number;
  total_est_pax: number;
  total_footfall_score: number;
  max_time_in_port_hours: number | null;
  multi_ship: boolean;
  barometer: Barometer;
};

const VISIT_COLS =
  "id, ship_id, ship_name_cache, arrival_at, departure_at, visit_date, from_location, to_location, berth, berth_area_group, is_tender, time_in_port_hours, est_pax, est_pax_label, est_passenger_range, status, headline_text, social_caption, ship:cruise_ships(id,name,slug,vessel_type,cruise_line,image_url,length_label,length_m,default_pax,imo,mmsi,is_large_ship)";

/** Day summaries from today forward (calendar + upcoming list). */
export async function getUpcomingDays(limit = 90): Promise<CruiseDay[]> {
  const sb = publicClient();
  const today = new Date().toISOString().slice(0, 10);
  try {
    const { data } = await sb
      .from("cruise_day_summary")
      .select("*")
      .gte("visit_date", today)
      .order("visit_date", { ascending: true })
      .limit(limit);
    return (data ?? []) as CruiseDay[];
  } catch {
    return [];
  }
}

export type CruiseDayRich = CruiseDay & { lead_image: string | null; lead_ship: string | null };

/** Upcoming days enriched with the day's lead ship photo (highest-pax ship that has an image). */
export async function getUpcomingDaysRich(limit = 40): Promise<CruiseDayRich[]> {
  const days = await getUpcomingDays(limit);
  if (days.length === 0) return [];
  const sb = publicClient();
  const dates = days.map((d) => d.visit_date);
  const lead: Record<string, { pax: number; img: string; name: string | null }> = {};
  try {
    const { data } = await sb
      .from("cruise_visits")
      .select("visit_date, est_pax, ship:cruise_ships(name,image_url)")
      .in("visit_date", dates)
      .neq("status", "cancelled");
    for (const v of (data ?? []) as unknown as { visit_date: string; est_pax: number | null; ship: { name: string | null; image_url: string | null } | null }[]) {
      const img = v.ship?.image_url;
      if (!img) continue;
      const pax = v.est_pax ?? 0;
      if (!lead[v.visit_date] || pax > lead[v.visit_date].pax) lead[v.visit_date] = { pax, img, name: v.ship?.name ?? null };
    }
  } catch { /* ignore */ }
  return days.map((d) => ({ ...d, lead_image: lead[d.visit_date]?.img ?? null, lead_ship: lead[d.visit_date]?.name ?? null }));
}

/** Day summaries within a calendar month, keyed by date (YYYY-MM). */
export async function getMonthDays(month: string): Promise<Record<string, CruiseDay>> {
  const start = `${month}-01`;
  const d = new Date(`${start}T00:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() + 1);
  const end = d.toISOString().slice(0, 10);
  const sb = publicClient();
  const out: Record<string, CruiseDay> = {};
  try {
    const { data } = await sb
      .from("cruise_day_summary")
      .select("*")
      .gte("visit_date", start)
      .lt("visit_date", end);
    for (const r of (data ?? []) as CruiseDay[]) out[r.visit_date] = r;
  } catch { /* empty */ }
  return out;
}

/** First and last dates with cruise activity (to bound the calendar nav). */
export async function getSeasonBounds(): Promise<{ first: string | null; last: string | null }> {
  const sb = publicClient();
  try {
    const [{ data: f }, { data: l }] = await Promise.all([
      sb.from("cruise_day_summary").select("visit_date").order("visit_date", { ascending: true }).limit(1),
      sb.from("cruise_day_summary").select("visit_date").order("visit_date", { ascending: false }).limit(1),
    ]);
    return { first: f?.[0]?.visit_date ?? null, last: l?.[0]?.visit_date ?? null };
  } catch {
    return { first: null, last: null };
  }
}

/** Everything in port on a given date, plus that day's summary. */
export async function getCruiseDay(date: string): Promise<{ summary: CruiseDay | null; visits: CruiseVisit[] }> {
  const sb = publicClient();
  try {
    const [{ data: sum }, { data: vis }] = await Promise.all([
      sb.from("cruise_day_summary").select("*").eq("visit_date", date).maybeSingle(),
      sb.from("cruise_visits").select(VISIT_COLS).eq("visit_date", date).neq("status", "cancelled").order("arrival_at", { ascending: true }),
    ]);
    return { summary: (sum ?? null) as CruiseDay | null, visits: (vis ?? []) as unknown as CruiseVisit[] };
  } catch {
    return { summary: null, visits: [] };
  }
}

/** A single visit + ship. */
export async function getCruiseVisit(id: string): Promise<CruiseVisit | null> {
  const sb = publicClient();
  try {
    const { data } = await sb.from("cruise_visits").select(VISIT_COLS).eq("id", id).maybeSingle();
    return (data ?? null) as unknown as CruiseVisit | null;
  } catch {
    return null;
  }
}

export type CruiseHomeCard = {
  date: string;
  isToday: boolean;
  barometer: Barometer;
  ships_count: number;
  total_est_pax: number;
  thumbs: { id: string; name: string; image: string | null }[];
};

/** The "In port today" card data — today if ships are in, otherwise the next call. */
export async function getCruiseHomeCard(): Promise<CruiseHomeCard | null> {
  const sb = publicClient();
  const today = new Date().toISOString().slice(0, 10);
  try {
    const { data: todayRow } = await sb.from("cruise_day_summary").select("*").eq("visit_date", today).maybeSingle();
    let day = (todayRow ?? null) as CruiseDay | null;
    if (!day) {
      const { data: next } = await sb.from("cruise_day_summary").select("*").gt("visit_date", today).order("visit_date", { ascending: true }).limit(1);
      day = (next?.[0] ?? null) as CruiseDay | null;
    }
    if (!day) return null;
    const { data: vis } = await sb
      .from("cruise_visits")
      .select("id, est_pax, ship:cruise_ships(name,image_url)")
      .eq("visit_date", day.visit_date)
      .neq("status", "cancelled")
      .order("est_pax", { ascending: false, nullsFirst: false })
      .limit(6);
    const thumbs = ((vis ?? []) as unknown as { id: string; ship: { name: string | null; image_url: string | null } | null }[])
      .map((v) => ({ id: v.id, name: v.ship?.name ?? "Ship", image: v.ship?.image_url ?? null }));
    return {
      date: day.visit_date,
      isToday: day.visit_date === today,
      barometer: day.barometer,
      ships_count: day.ships_count,
      total_est_pax: day.total_est_pax,
      thumbs,
    };
  } catch {
    return null;
  }
}

// ── Scoped window (Today / This weekend / This week) ──
export type ScopeStats = {
  calls: number;
  pax: number;
  distinctShips: number;
  busiestDay: { date: string; pax: number } | null;
  firstIn: string | null;
  lastOut: string | null;
};
export type ScopeData = {
  days: CruiseDayRich[];
  daysByDate: Record<string, CruiseDayRich>;
  visits: CruiseVisit[];
  stats: ScopeStats;
  origins: Origin[];
};

/** Which focused scopes actually have ships, so empty pills can be disabled. */
export async function getScopeAvailability(today: string): Promise<Record<Exclude<CruiseScope, "season">, boolean>> {
  const sb = publicClient();
  const horizon = scopeRange("week", today); // widest window (next 7 days) covers today + weekend
  const out: Record<Exclude<CruiseScope, "season">, boolean> = { today: false, weekend: false, week: false };
  if (!horizon) return out;
  try {
    const { data } = await sb.from("cruise_day_summary").select("visit_date").gte("visit_date", horizon.from).lte("visit_date", horizon.to);
    const set = new Set(((data ?? []) as { visit_date: string }[]).map((r) => r.visit_date));
    const has = (scope: Exclude<CruiseScope, "season">) => {
      const r = scopeRange(scope, today);
      return r ? datesBetween(r.from, r.to).some((d) => set.has(d)) : false;
    };
    return { today: has("today"), weekend: has("weekend"), week: has("week") };
  } catch {
    return out;
  }
}

/** Everything needed to render a focused time window in one pair of queries. */
export async function getScopeData(from: string, to: string): Promise<ScopeData> {
  const sb = publicClient();
  const empty: ScopeData = { days: [], daysByDate: {}, visits: [], stats: { calls: 0, pax: 0, distinctShips: 0, busiestDay: null, firstIn: null, lastOut: null }, origins: [] };
  try {
    const [{ data: sum }, { data: vis }] = await Promise.all([
      sb.from("cruise_day_summary").select("*").gte("visit_date", from).lte("visit_date", to).order("visit_date", { ascending: true }),
      sb.from("cruise_visits").select(VISIT_COLS).gte("visit_date", from).lte("visit_date", to).neq("status", "cancelled").order("arrival_at", { ascending: true }),
    ]);
    const visits = (vis ?? []) as unknown as CruiseVisit[];

    // Lead image per day (highest-pax ship that has a photo).
    const lead: Record<string, { pax: number; img: string; name: string | null }> = {};
    for (const v of visits) {
      const img = v.ship?.image_url;
      if (!img || !v.visit_date) continue;
      const pax = v.est_pax ?? 0;
      if (!lead[v.visit_date] || pax > lead[v.visit_date].pax) lead[v.visit_date] = { pax, img, name: v.ship?.name ?? null };
    }
    const days = ((sum ?? []) as CruiseDay[]).map((d) => ({ ...d, lead_image: lead[d.visit_date]?.img ?? null, lead_ship: lead[d.visit_date]?.name ?? null }));
    const daysByDate: Record<string, CruiseDayRich> = {};
    for (const d of days) daysByDate[d.visit_date] = d;

    let pax = 0;
    const shipIds = new Set<string>();
    const arrivals: string[] = [];
    const departures: string[] = [];
    for (const v of visits) {
      pax += v.est_pax ?? 0;
      if (v.ship_id) shipIds.add(v.ship_id);
      if (v.arrival_at) arrivals.push(v.arrival_at);
      if (v.departure_at) departures.push(v.departure_at);
    }
    const busiest = days.slice().sort((a, b) => b.total_est_pax - a.total_est_pax)[0];
    const stats: ScopeStats = {
      calls: visits.length,
      pax,
      distinctShips: shipIds.size,
      busiestDay: busiest ? { date: busiest.visit_date, pax: busiest.total_est_pax } : null,
      firstIn: arrivals.sort()[0] ?? null,
      lastOut: departures.sort().slice(-1)[0] ?? null,
    };

    const counts: Record<string, number> = {};
    for (const v of visits) if (v.from_location) counts[v.from_location] = (counts[v.from_location] ?? 0) + 1;
    const origins: Origin[] = [];
    for (const [name, count] of Object.entries(counts)) {
      const c = portCoord(name);
      if (c) origins.push({ name, lat: c[0], lng: c[1], count });
    }
    origins.sort((a, b) => b.count - a.count);

    return { days, daysByDate, visits, stats, origins };
  } catch {
    return empty;
  }
}

/** Day summary for one date (used on the visit detail page for the Barometer). */
export async function getDaySummary(date: string): Promise<CruiseDay | null> {
  const sb = publicClient();
  try {
    const { data } = await sb.from("cruise_day_summary").select("*").eq("visit_date", date).maybeSingle();
    return (data ?? null) as CruiseDay | null;
  } catch {
    return null;
  }
}

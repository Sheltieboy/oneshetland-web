import { publicClient } from "./supabase/public";
import { LERWICK } from "./cruise-shared";

export { LERWICK };

// ── Port coordinates for the route map (curated to the ports in our data) ──
const PORTS: Record<string, [number, number]> = {
  lerwick: LERWICK,
  aberdeen: [57.144, -2.094], invergordon: [57.69, -4.17], kirkwall: [58.985, -2.96],
  stromness: [58.96, -3.30], scrabster: [58.61, -3.55], thurso: [58.59, -3.52],
  rosyth: [56.02, -3.44], leith: [55.98, -3.17], dundee: [56.46, -2.97], greenock: [55.95, -4.76],
  liverpool: [53.41, -3.0], holyhead: [53.31, -4.63], belfast: [54.60, -5.93],
  dover: [51.13, 1.31], southampton: [50.90, -1.40],
  stornoway: [58.21, -6.39], ullapool: [57.90, -5.16], skye: [57.27, -6.21],
  "st kilda": [57.81, -8.57], hebrides: [57.76, -7.01], westray: [59.29, -2.96],
  orkney: [58.98, -2.96],
  bergen: [60.39, 5.32], haugesund: [59.41, 5.27], stavanger: [58.97, 5.73],
  alesund: [62.47, 6.15], maloy: [61.94, 5.11], kristiansund: [63.11, 7.73],
  olden: [61.84, 6.81], flam: [60.86, 7.11], lysefjorden: [59.0, 6.6], sojnefjord: [61.1, 6.5],
  honningsvaag: [70.98, 25.97], volda: [62.15, 6.07],
  amsterdam: [52.38, 4.90], rotterdam: [51.95, 4.14], hamburg: [53.55, 9.99],
  bremerhaven: [53.54, 8.58], copenhagen: [55.68, 12.57], aarhus: [56.15, 10.21], skagen: [57.72, 10.58],
  reykjavik: [64.15, -21.94], akureyri: [65.69, -18.10], seydisfjordur: [65.26, -14.0],
  djupivogur: [64.66, -14.28], heimaey: [63.44, -20.27],
  torshavn: [62.01, -6.77], klaksvik: [62.23, -6.59], tvoroyri: [61.55, -6.80],
  runavik: [62.11, -6.72], vagur: [61.47, -6.81],
  // Shetland local landfalls
  noss: [60.14, -1.02], mousa: [60.0, -1.18], foula: [60.13, -2.07], "fair isle": [59.53, -1.63],
  "papa stour": [60.32, -1.70], baltasound: [60.75, -0.86], symbister: [60.34, -1.02],
  scalloway: [60.13, -1.27],
};
export function portCoord(name?: string | null): [number, number] | null {
  if (!name) return null;
  return PORTS[name.toLowerCase().trim()] ?? null;
}
export type RoutePoint = { name: string; lat: number; lng: number; kind: "from" | "lerwick" | "to" };
/** Ordered route: from → Lerwick → to, using only ports we can place. */
export function routePoints(from?: string | null, to?: string | null): RoutePoint[] {
  const pts: RoutePoint[] = [];
  const f = portCoord(from);
  if (f && from) pts.push({ name: from, lat: f[0], lng: f[1], kind: "from" });
  pts.push({ name: "Lerwick", lat: LERWICK[0], lng: LERWICK[1], kind: "lerwick" });
  const t = portCoord(to);
  if (t && to) pts.push({ name: to, lat: t[0], lng: t[1], kind: "to" });
  return pts;
}

// ── Season stats ──
export type SeasonStats = {
  totalCalls: number;
  totalPax: number;
  distinctShips: number;
  biggestShip: { name: string; length_m: number } | null;
  peakDays: number;
  busiestDay: { date: string; pax: number } | null;
  byMonth: { month: string; calls: number; pax: number }[];
};
export async function getSeasonStats(): Promise<SeasonStats | null> {
  const sb = publicClient();
  try {
    const [{ data: visits }, { data: ships }, { data: dsum }] = await Promise.all([
      sb.from("cruise_visits").select("visit_date, est_pax, ship_id").neq("status", "cancelled"),
      sb.from("cruise_ships").select("name, length_m"),
      sb.from("cruise_day_summary").select("visit_date, barometer, total_est_pax"),
    ]);
    const v = (visits ?? []) as { visit_date: string | null; est_pax: number | null; ship_id: string | null }[];
    if (v.length === 0) return null;
    const byMonthMap: Record<string, { calls: number; pax: number }> = {};
    let totalPax = 0;
    const shipIds = new Set<string>();
    for (const r of v) {
      totalPax += r.est_pax ?? 0;
      if (r.ship_id) shipIds.add(r.ship_id);
      const m = (r.visit_date ?? "").slice(0, 7);
      if (m) { (byMonthMap[m] ??= { calls: 0, pax: 0 }); byMonthMap[m].calls++; byMonthMap[m].pax += r.est_pax ?? 0; }
    }
    const byMonth = Object.entries(byMonthMap).sort(([a], [b]) => a.localeCompare(b)).map(([month, x]) => ({ month, ...x }));
    const shipsArr = (ships ?? []) as { name: string; length_m: number | null }[];
    const biggest = shipsArr.filter((s) => s.length_m).sort((a, b) => (b.length_m ?? 0) - (a.length_m ?? 0))[0];
    const days = (dsum ?? []) as { visit_date: string; barometer: string; total_est_pax: number }[];
    const peakDays = days.filter((d) => d.barometer === "peak").length;
    const busiest = days.slice().sort((a, b) => b.total_est_pax - a.total_est_pax)[0];
    return {
      totalCalls: v.length,
      totalPax,
      distinctShips: shipIds.size,
      biggestShip: biggest ? { name: biggest.name, length_m: biggest.length_m as number } : null,
      peakDays,
      busiestDay: busiest ? { date: busiest.visit_date, pax: busiest.total_est_pax } : null,
      byMonth,
    };
  } catch {
    return null;
  }
}

// ── Where ships sail from (origin ports this season) ──
export type Origin = { name: string; lat: number; lng: number; count: number };
export async function getSeasonOrigins(): Promise<Origin[]> {
  const sb = publicClient();
  try {
    const { data } = await sb.from("cruise_visits").select("from_location").neq("status", "cancelled");
    const counts: Record<string, number> = {};
    for (const r of (data ?? []) as { from_location: string | null }[]) {
      if (r.from_location) counts[r.from_location] = (counts[r.from_location] ?? 0) + 1;
    }
    const out: Origin[] = [];
    for (const [name, count] of Object.entries(counts)) {
      const c = portCoord(name);
      if (c) out.push({ name, lat: c[0], lng: c[1], count });
    }
    return out.sort((a, b) => b.count - a.count);
  } catch {
    return [];
  }
}

// ── A ship's other calls this season ──
export type OtherCall = { id: string; visit_date: string | null; est_pax: number | null };
export async function getShipOtherCalls(shipId: string, excludeVisitId: string): Promise<OtherCall[]> {
  const sb = publicClient();
  try {
    const { data } = await sb
      .from("cruise_visits")
      .select("id, visit_date, est_pax")
      .eq("ship_id", shipId)
      .neq("status", "cancelled")
      .order("visit_date", { ascending: true });
    return ((data ?? []) as OtherCall[]).filter((c) => c.id !== excludeVisitId);
  } catch {
    return [];
  }
}

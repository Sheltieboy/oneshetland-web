/**
 * map-it.ts (web) — Map It game logic + a self-contained Shetland polygon map.
 * Ported from the app: simplified island polygons + equirectangular projection
 * (so we draw our own SVG and invert clicks), Haversine scoring, daily picker,
 * levels, and localStorage session/cumulative state.
 */

import { publicClient } from "@/lib/supabase/public";

/* ── Geometry ────────────────────────────────────────────────────────────── */

export const VIEW_BOUNDS = { minLat: 59.45, maxLat: 60.92, minLng: -2.30, maxLng: -0.55 };
const CENTRE_LAT = (VIEW_BOUNDS.minLat + VIEW_BOUNDS.maxLat) / 2;
const COS_CENTRE = Math.cos((CENTRE_LAT * Math.PI) / 180);

export function latLngToXY(lat: number, lng: number, w: number, h: number): { x: number; y: number } {
  const fx = ((lng - VIEW_BOUNDS.minLng) * COS_CENTRE) / ((VIEW_BOUNDS.maxLng - VIEW_BOUNDS.minLng) * COS_CENTRE);
  const fy = 1 - (lat - VIEW_BOUNDS.minLat) / (VIEW_BOUNDS.maxLat - VIEW_BOUNDS.minLat);
  return { x: fx * w, y: fy * h };
}
export function xyToLatLng(x: number, y: number, w: number, h: number): { lat: number; lng: number } {
  return {
    lat: VIEW_BOUNDS.minLat + (1 - y / h) * (VIEW_BOUNDS.maxLat - VIEW_BOUNDS.minLat),
    lng: VIEW_BOUNDS.minLng + (x / w) * (VIEW_BOUNDS.maxLng - VIEW_BOUNDS.minLng),
  };
}
export function distanceKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export interface Island { name: string; points: Array<{ lat: number; lng: number }> }
export const ISLANDS: Island[] = [
  { name: "Mainland", points: [
    { lat: 59.852, lng: -1.272 }, { lat: 59.870, lng: -1.300 }, { lat: 59.880, lng: -1.345 }, { lat: 59.940, lng: -1.345 },
    { lat: 59.975, lng: -1.355 }, { lat: 60.005, lng: -1.345 }, { lat: 60.085, lng: -1.395 }, { lat: 60.130, lng: -1.475 },
    { lat: 60.230, lng: -1.625 }, { lat: 60.305, lng: -1.680 }, { lat: 60.355, lng: -1.620 }, { lat: 60.395, lng: -1.500 },
    { lat: 60.440, lng: -1.500 }, { lat: 60.480, lng: -1.640 }, { lat: 60.540, lng: -1.500 }, { lat: 60.605, lng: -1.420 },
    { lat: 60.630, lng: -1.330 }, { lat: 60.580, lng: -1.205 }, { lat: 60.490, lng: -1.140 }, { lat: 60.440, lng: -1.080 },
    { lat: 60.385, lng: -1.060 }, { lat: 60.330, lng: -1.115 }, { lat: 60.270, lng: -1.125 }, { lat: 60.200, lng: -1.105 },
    { lat: 60.155, lng: -1.135 }, { lat: 60.110, lng: -1.180 }, { lat: 60.040, lng: -1.210 }, { lat: 59.990, lng: -1.230 },
    { lat: 59.940, lng: -1.245 }, { lat: 59.890, lng: -1.265 },
  ] },
  { name: "Yell", points: [
    { lat: 60.480, lng: -1.150 }, { lat: 60.520, lng: -1.230 }, { lat: 60.600, lng: -1.240 }, { lat: 60.660, lng: -1.140 },
    { lat: 60.735, lng: -1.020 }, { lat: 60.715, lng: -0.940 }, { lat: 60.620, lng: -0.940 }, { lat: 60.560, lng: -0.985 },
    { lat: 60.515, lng: -1.045 }, { lat: 60.490, lng: -1.110 },
  ] },
  { name: "Unst", points: [
    { lat: 60.690, lng: -0.970 }, { lat: 60.715, lng: -0.965 }, { lat: 60.760, lng: -0.940 }, { lat: 60.830, lng: -0.910 },
    { lat: 60.840, lng: -0.860 }, { lat: 60.815, lng: -0.780 }, { lat: 60.745, lng: -0.780 }, { lat: 60.700, lng: -0.860 }, { lat: 60.685, lng: -0.950 },
  ] },
  { name: "Fetlar", points: [
    { lat: 60.610, lng: -0.900 }, { lat: 60.635, lng: -0.870 }, { lat: 60.640, lng: -0.790 }, { lat: 60.620, lng: -0.755 }, { lat: 60.595, lng: -0.790 }, { lat: 60.590, lng: -0.870 },
  ] },
  { name: "Whalsay", points: [
    { lat: 60.330, lng: -1.000 }, { lat: 60.345, lng: -1.010 }, { lat: 60.390, lng: -0.985 }, { lat: 60.395, lng: -0.940 }, { lat: 60.370, lng: -0.910 }, { lat: 60.335, lng: -0.940 },
  ] },
  { name: "Bressay", points: [
    { lat: 60.090, lng: -1.080 }, { lat: 60.105, lng: -1.105 }, { lat: 60.165, lng: -1.110 }, { lat: 60.200, lng: -1.075 }, { lat: 60.160, lng: -1.020 }, { lat: 60.110, lng: -1.030 },
  ] },
  { name: "Foula", points: [
    { lat: 60.105, lng: -2.080 }, { lat: 60.115, lng: -2.105 }, { lat: 60.140, lng: -2.105 }, { lat: 60.155, lng: -2.075 }, { lat: 60.140, lng: -2.045 }, { lat: 60.110, lng: -2.050 },
  ] },
  { name: "Papa Stour", points: [
    { lat: 60.315, lng: -1.720 }, { lat: 60.345, lng: -1.730 }, { lat: 60.355, lng: -1.690 }, { lat: 60.340, lng: -1.660 }, { lat: 60.320, lng: -1.680 },
  ] },
  { name: "Fair Isle", points: [
    { lat: 59.510, lng: -1.660 }, { lat: 59.530, lng: -1.670 }, { lat: 59.555, lng: -1.640 }, { lat: 59.550, lng: -1.595 }, { lat: 59.520, lng: -1.590 }, { lat: 59.500, lng: -1.625 },
  ] },
  { name: "Burra", points: [
    { lat: 60.025, lng: -1.330 }, { lat: 60.060, lng: -1.380 }, { lat: 60.130, lng: -1.360 }, { lat: 60.130, lng: -1.310 }, { lat: 60.090, lng: -1.300 }, { lat: 60.050, lng: -1.320 },
  ] },
  { name: "Muckle Roe", points: [
    { lat: 60.365, lng: -1.490 }, { lat: 60.405, lng: -1.495 }, { lat: 60.410, lng: -1.430 }, { lat: 60.385, lng: -1.405 }, { lat: 60.365, lng: -1.430 },
  ] },
  { name: "Mousa", points: [
    { lat: 59.990, lng: -1.190 }, { lat: 60.010, lng: -1.195 }, { lat: 60.015, lng: -1.165 }, { lat: 59.995, lng: -1.160 },
  ] },
];

/* ── Game logic ──────────────────────────────────────────────────────────── */

export type Difficulty = "easy" | "medium" | "hard";
export interface Place { id: string; name: string; category: string; region: string | null; lat: number; lng: number; difficulty: Difficulty }
export interface RoundResult { place: Place; guess: { lat: number; lng: number }; distanceKm: number; points: number }
export interface SessionState { dateKey: string; places: Place[]; results: RoundResult[]; submitted: boolean }

export const ROUNDS_PER_DAY = 10;
export const PRACTICE_ROUNDS = 5;
export const MAX_POINTS_PER_ROUND = 1000;
const DIFFICULTY_MIX: Record<Difficulty, number> = { easy: 4, medium: 4, hard: 2 };
const PRACTICE_MIX: Record<Difficulty, number> = { easy: 2, medium: 2, hard: 1 };

export function todayKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
export function formatDateLabel(key: string): string {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" });
}

function hashString(s: string): number { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = (h * 16777619) >>> 0; } return h >>> 0; }
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function () { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
function shuffleInPlace<T>(arr: T[], rng: () => number): T[] { for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]]; } return arr; }

export interface LevelDef { level: number; name: string; color: string; minPts: number }
export const LEVELS: LevelDef[] = [
  { level: 1, name: "Peerie Wanderer", color: "#78C87E", minPts: 0 },
  { level: 2, name: "Geo Explorer", color: "#5BC0DE", minPts: 2500 },
  { level: 3, name: "Voe Voyager", color: "#4A90D9", minPts: 10000 },
  { level: 4, name: "Isle Skipper", color: "#9B59B6", minPts: 25000 },
  { level: 5, name: "Shetland Maaster", color: "#FFD700", minPts: 60000 },
];
export function getLevelInfo(cumulativePts: number) {
  let idx = 0;
  for (let i = LEVELS.length - 1; i >= 0; i--) if (cumulativePts >= LEVELS[i].minPts) { idx = i; break; }
  const current = LEVELS[idx]; const next = LEVELS[idx + 1] ?? null;
  const progress = next ? (cumulativePts - current.minPts) / (next.minPts - current.minPts) : 1;
  return { current, next, progress, cumulativePts };
}

const CUMULATIVE_KEY = "map_it_cumulative_pts_v1";
export function loadCumulativePts(): number {
  if (typeof window === "undefined") return 0;
  try { const s = localStorage.getItem(CUMULATIVE_KEY); return s ? parseInt(s, 10) : 0; } catch { return 0; }
}
export function addCumulativePts(pts: number): number {
  if (typeof window === "undefined") return pts;
  try { const next = loadCumulativePts() + pts; localStorage.setItem(CUMULATIVE_KEY, String(next)); return next; } catch { return pts; }
}

let cachedPool: Place[] | null = null;
export async function loadPlacePool(): Promise<Place[]> {
  if (cachedPool && cachedPool.length) return cachedPool;
  const sb = publicClient();
  const { data } = await sb.from("game_shetland_places")
    .select("id, name, category, region, lat, lng, difficulty, is_active").eq("is_active", true).limit(1000);
  cachedPool = (data ?? []).map((r: { id: string; name: string; category: string; region: string | null; lat: number; lng: number; difficulty: Difficulty }) => ({
    id: r.id, name: r.name, category: r.category, region: r.region, lat: Number(r.lat), lng: Number(r.lng), difficulty: r.difficulty,
  }));
  return cachedPool;
}

export function pickDailyPlaces(dateKey: string, pool: Place[]): Place[] {
  const rng = mulberry32(hashString(`mapit-${dateKey}`));
  const byDiff: Record<Difficulty, Place[]> = { easy: pool.filter((p) => p.difficulty === "easy"), medium: pool.filter((p) => p.difficulty === "medium"), hard: pool.filter((p) => p.difficulty === "hard") };
  const picks: Place[] = [];
  (Object.keys(DIFFICULTY_MIX) as Difficulty[]).forEach((diff) => { picks.push(...shuffleInPlace([...byDiff[diff]], rng).slice(0, DIFFICULTY_MIX[diff])); });
  return shuffleInPlace(picks, rng);
}
export function pickPracticeRounds(pool: Place[], excludeIds: string[] = []): Place[] {
  const rng = mulberry32((Date.now() * 1000 + Math.floor(Math.random() * 999)) >>> 0);
  const avail = pool.filter((p) => !excludeIds.includes(p.id));
  const byDiff: Record<Difficulty, Place[]> = { easy: avail.filter((p) => p.difficulty === "easy"), medium: avail.filter((p) => p.difficulty === "medium"), hard: avail.filter((p) => p.difficulty === "hard") };
  const picks: Place[] = [];
  (Object.keys(PRACTICE_MIX) as Difficulty[]).forEach((diff) => { picks.push(...shuffleInPlace([...byDiff[diff]], rng).slice(0, PRACTICE_MIX[diff])); });
  return shuffleInPlace(picks, rng);
}

export function scoreForDistance(d: number): number { return d <= 0 ? MAX_POINTS_PER_ROUND : Math.round(MAX_POINTS_PER_ROUND * Math.exp(-d / 10)); }
export function starsForDistance(d: number): 0 | 1 | 2 | 3 { if (d <= 1) return 3; if (d <= 5) return 2; if (d <= 25) return 1; return 0; }
export function totalScore(results: RoundResult[]): number { return results.reduce((s, r) => s + r.points, 0); }
export function resolveRound(place: Place, guess: { lat: number; lng: number }): RoundResult {
  const d = distanceKm(place, guess);
  return { place, guess, distanceKm: d, points: scoreForDistance(d) };
}

const STATE_KEY = (userId: string, dateKey: string) => `mapit_state_v1_${userId}_${dateKey}`;
export function loadSession(userId: string, dateKey: string): SessionState | null {
  if (typeof window === "undefined") return null;
  try { const raw = localStorage.getItem(STATE_KEY(userId, dateKey)); return raw ? (JSON.parse(raw) as SessionState) : null; } catch { return null; }
}
export function saveSession(userId: string, state: SessionState): void {
  if (typeof window === "undefined") return;
  try { localStorage.setItem(STATE_KEY(userId, state.dateKey), JSON.stringify(state)); } catch { /* */ }
}

export function buildShareText(state: SessionState, total: number): string {
  const grid = state.results.map((r) => { const s = starsForDistance(r.distanceKm); return s === 3 ? "⚓" : s === 2 ? "〰" : s === 1 ? "·" : "✕"; }).join(" ");
  return `Map It · ${formatDateLabel(state.dateKey)}\n${total.toLocaleString()} / ${ROUNDS_PER_DAY * MAX_POINTS_PER_ROUND} pts\n${grid}\n\nOneShetland`;
}

/** SVG polygon point strings for a given canvas size (for rendering the map). */
export function islandPolygons(w: number, h: number): { name: string; points: string }[] {
  return ISLANDS.map((isl) => ({
    name: isl.name,
    points: isl.points.map((p) => { const { x, y } = latLngToXY(p.lat, p.lng, w, h); return `${x.toFixed(1)},${y.toFixed(1)}`; }).join(" "),
  }));
}

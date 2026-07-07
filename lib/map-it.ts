/**
 * map-it.ts (web) — Map It game logic + the SAME accurate Shetland SVG projection
 * the mobile app uses. We render the real Wikipedia "Shetland UK blank map" SVG
 * (832×1582 units) as the basemap and map lat/lng ↔ SVG coords with the exact
 * linear calibration ported from the app, so both platforms render an identical,
 * accurate map and the shared leaderboard is truly fair. Haversine scoring, daily
 * picker, levels, and localStorage session/cumulative state are unchanged.
 */

import { publicClient } from "@/lib/supabase/public";

/* ── SVG geometry + projection (calibrated 2026-06-06 from 5 control points) ─
 *
 * The Wikipedia "Shetland UK blank map" is 832×1582 SVG units. Latitude maps
 * linearly to Y, longitude linearly to X. These EXACT constants + helpers are
 * shared with the app (app/games/map-it.tsx) so scoring stays comparable and
 * the basemap is pixel-identical across platforms.
 */
const SVG_W = 832, SVG_H = 1582;
const Y_SLOPE = -1163.68, Y_INTERCEPT = 70825.82;
const X_SLOPE = 564.85,  X_INTERCEPT = 1219.31;
export function latToSvgY(lat: number) { return Y_SLOPE * lat + Y_INTERCEPT; }
export function lngToSvgX(lng: number) { return X_SLOPE * lng + X_INTERCEPT; }
export function svgYToLat(y: number)   { return (Y_INTERCEPT - y) / -Y_SLOPE; }
export function svgXToLng(x: number)   { return (x - X_INTERCEPT) / X_SLOPE; }
export { SVG_W, SVG_H };

export function distanceKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

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

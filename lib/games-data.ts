/**
 * games-data.ts — OneShetland Games Centre (web).
 *
 * Client-safe: types, the GAMES registry, XP/level helpers, accent colours,
 * public leaderboard reads, and the Spik word pool + question generators.
 * Auth-scoped reads live in games-data.server.ts; score writes in games-score.ts.
 */

import { publicClient } from "@/lib/supabase/public";
import { BASE_TRIES } from "@/lib/guess-da-wird";

export const GAMES = {
  spik_sprint:   { id: "spik_sprint",   label: "Spik Sprint",   href: "/games/spik-sprint",   live: true, description: "60-second tap-the-right-meaning speed round." },
  spik_snap:     { id: "spik_snap",     label: "Spik Snap",     href: "/games/spik-snap",     live: true, description: "Yes or no — does the meaning match the wird?" },
  guess_da_wird: { id: "guess_da_wird", label: "Guess Da Wird", href: "/games/guess-da-wird", live: true, description: `Daily Shetland dialect word puzzle. ${BASE_TRIES} tries, progressive clues.` },
  map_it:        { id: "map_it",        label: "Map It",        href: "/games/map-it",        live: true, description: "Pin Shetland places on the map. 10 rounds — the closer the better." },
} as const;

export type GameId = keyof typeof GAMES;

export const GAME_COLORS: Record<GameId, string> = {
  spik_sprint: "#059669", spik_snap: "#E0820F", guess_da_wird: "#1D4ED8", map_it: "#0E8FAC",
};
export const GAME_LIGHTS: Record<GameId, string> = {
  spik_sprint: "#D1FAE5", spik_snap: "#FEF3C7", guess_da_wird: "#DBEAFE", map_it: "#CFFAFE",
};

export const GAMES_ACCENT = "#10b981";

export interface GameScore {
  id: string; user_id: string; game_id: string; score: number;
  duration_ms: number | null; metadata: Record<string, unknown> | null; played_at: string;
}
export interface UserGameStats {
  user_id: string; total_xp: number; level: number;
  current_streak_days: number; longest_streak_days: number;
  last_played_date: string | null; games_played: number; updated_at: string;
}
export interface LeaderboardRow {
  user_id: string; games_handle: string | null; best_score: number; played_at: string;
}
export interface GameBreakdownEntry {
  game_id: string; best_score: number; games_played: number; average_score: number; last_played: string | null;
}

/* ── XP / levels ─────────────────────────────────────────────────────────── */

export function xpForLevel(level: number): number {
  return Math.round(100 * level + 50 * level * (level - 1));
}
export function levelFromXp(xp: number): number {
  let level = 1;
  while (xp >= xpForLevel(level + 1)) level++;
  return level;
}
export function levelTitle(level: number): string {
  if (level <= 1) return "Peerie Beginner";
  if (level <= 3) return "Learner";
  if (level <= 6) return "Spik Speaker";
  if (level <= 10) return "Dialect Don";
  return "Da Spik Master";
}

/* ── Leaderboard (public read) ───────────────────────────────────────────── */

export async function fetchTopScores(gameId: GameId, period: "today" | "week" | "all" = "all", limit = 10): Promise<LeaderboardRow[]> {
  const sb = publicClient();
  try {
    let q = sb.from("games_scores")
      .select("user_id, score, played_at")
      .eq("game_id", gameId)
      .order("score", { ascending: false })
      .order("played_at", { ascending: true })
      .limit(200);
    if (period === "today") { const s = new Date(); s.setHours(0, 0, 0, 0); q = q.gte("played_at", s.toISOString()); }
    else if (period === "week") { q = q.gte("played_at", new Date(Date.now() - 7 * 86_400_000).toISOString()); }
    const { data } = await q;
    const rows = (data ?? []) as { user_id: string; score: number; played_at: string }[];
    const best = new Map<string, { score: number; played_at: string }>();
    for (const r of rows) {
      const cur = best.get(r.user_id);
      if (!cur || r.score > cur.score) best.set(r.user_id, { score: r.score, played_at: r.played_at });
    }
    const ids = [...best.keys()];
    if (!ids.length) return [];
    const { data: profiles } = await sb.from("profiles").select("id, games_handle").in("id", ids);
    const handles = Object.fromEntries((profiles ?? []).map((p: { id: string; games_handle: string | null }) => [p.id, p.games_handle]));
    return ids.map((uid) => ({
      user_id: uid, games_handle: handles[uid] ?? null,
      best_score: best.get(uid)!.score, played_at: best.get(uid)!.played_at,
    })).sort((a, b) => b.best_score - a.best_score).slice(0, limit);
  } catch { return []; }
}

export type LeaderTrend = "up" | "down" | "same";
export interface LeaderboardTrendRow {
  rank: number;
  user_id: string;
  games_handle: string | null;
  best_score: number;
  trend: LeaderTrend;
}

/** Best score per user for a game, ordered into a ranking, with a movement
 *  indicator vs the ranking as it stood `sinceDays` ago (default a week).
 *  Public read; safe to call from a server component. Never throws. */
export async function fetchLeaderboardWithTrend(
  gameId: GameId,
  limit = 5,
  sinceDays = 7,
): Promise<LeaderboardTrendRow[]> {
  const sb = publicClient();
  try {
    // Best score per user across the top score rows (all-time = current ranking).
    const { data: nowData } = await sb
      .from("games_scores")
      .select("user_id, score, played_at")
      .eq("game_id", gameId)
      .order("score", { ascending: false })
      .order("played_at", { ascending: true })
      .limit(300);
    const bestNow = new Map<string, number>();
    for (const r of (nowData ?? []) as { user_id: string; score: number }[]) {
      if (!bestNow.has(r.user_id) || r.score > bestNow.get(r.user_id)!) bestNow.set(r.user_id, r.score);
    }
    const current = [...bestNow.entries()].sort((a, b) => b[1] - a[1]);
    if (!current.length) return [];

    // Ranking as of `sinceDays` ago — best score per user among plays before the
    // cutoff. Empty when the board didn't exist yet → everyone shows "same".
    const cutoff = new Date(Date.now() - sinceDays * 86_400_000).toISOString();
    const { data: prevData } = await sb
      .from("games_scores")
      .select("user_id, score")
      .eq("game_id", gameId)
      .lte("played_at", cutoff)
      .order("score", { ascending: false })
      .limit(300);
    const bestPrev = new Map<string, number>();
    for (const r of (prevData ?? []) as { user_id: string; score: number }[]) {
      if (!bestPrev.has(r.user_id) || r.score > bestPrev.get(r.user_id)!) bestPrev.set(r.user_id, r.score);
    }
    const prevRank = new Map<string, number>();
    [...bestPrev.entries()].sort((a, b) => b[1] - a[1]).forEach(([uid], i) => prevRank.set(uid, i + 1));
    const hadHistory = prevRank.size > 0;

    const top = current.slice(0, limit);
    const ids = top.map(([uid]) => uid);
    const { data: profiles } = await sb.from("profiles").select("id, games_handle").in("id", ids);
    const handles = Object.fromEntries(
      ((profiles ?? []) as { id: string; games_handle: string | null }[]).map((p) => [p.id, p.games_handle]),
    );

    return top.map(([uid, score], i) => {
      const currRank = i + 1;
      let trend: LeaderTrend = "same";
      if (hadHistory) {
        const pr = prevRank.get(uid);
        if (pr == null) trend = "up";            // new to the board
        else if (pr > currRank) trend = "up";
        else if (pr < currRank) trend = "down";
      }
      return { rank: currRank, user_id: uid, games_handle: handles[uid] ?? null, best_score: score, trend };
    });
  } catch {
    return [];
  }
}

/* ── Spik word pool + question generators (Sprint / Snap) ─────────────────── */

export interface SpikGameWord { id: number; word: string; meaning: string; pronunciation?: string | null }

export async function loadSpikGameWords(): Promise<SpikGameWord[]> {
  const sb = publicClient();
  try {
    const { data } = await sb.from("spik_dictionary")
      .select("id, word, short_meaning, spik_meaning, pronunciation")
      .or("short_meaning.not.is.null,spik_meaning.not.is.null")
      .limit(3000);
    return (data ?? [])
      .map((r: { id: number; word: string; short_meaning: string | null; spik_meaning: string | null; pronunciation: string | null }) => ({
        id: r.id, word: r.word,
        meaning: (r.short_meaning ?? r.spik_meaning ?? "").trim(),
        pronunciation: r.pronunciation ?? null,
      }))
      .filter((w) => w.word && w.meaning && w.meaning.length < 80);
  } catch { return []; }
}

function shuffle<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]]; }
  return arr;
}
export function pickRandom(pool: SpikGameWord[], n: number): SpikGameWord[] {
  if (!pool.length) return [];
  return shuffle(pool.slice()).slice(0, Math.min(n, pool.length));
}
export function makeSprintQuestion(pool: SpikGameWord[], optionsCount = 4): { meaning: string; options: SpikGameWord[]; correctIndex: number } | null {
  if (pool.length < optionsCount) return null;
  const picks = pickRandom(pool, optionsCount);
  const correctIndex = Math.floor(Math.random() * optionsCount);
  return { meaning: picks[correctIndex].meaning, options: picks, correctIndex };
}
export function makeSnapCard(pool: SpikGameWord[]): { word: SpikGameWord; shownMeaning: string; match: boolean } | null {
  if (pool.length < 2) return null;
  const word = pool[Math.floor(Math.random() * pool.length)];
  if (Math.random() < 0.5) return { word, shownMeaning: word.meaning, match: true };
  let other = pool[Math.floor(Math.random() * pool.length)];
  let safety = 0;
  while ((other.id === word.id || other.meaning === word.meaning) && safety < 20) { other = pool[Math.floor(Math.random() * pool.length)]; safety++; }
  return { word, shownMeaning: other.meaning, match: false };
}

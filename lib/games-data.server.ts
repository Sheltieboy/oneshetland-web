/**
 * games-data.server.ts — auth-scoped Games reads (cookie session).
 * SERVER-ONLY: never import from a client component.
 */

import { createClient as createServerClient } from "@/lib/supabase/server";
import type { GameId, GameScore, UserGameStats, GameBreakdownEntry } from "@/lib/games-data";

export async function fetchUserStats(userId: string): Promise<UserGameStats | null> {
  const sb = await createServerClient();
  const { data } = await sb.from("games_user_stats").select("*").eq("user_id", userId).maybeSingle();
  return (data ?? null) as UserGameStats | null;
}

export async function fetchMyBestScore(userId: string, gameId: GameId): Promise<number> {
  const sb = await createServerClient();
  const { data } = await sb.from("games_scores")
    .select("score").eq("user_id", userId).eq("game_id", gameId)
    .order("score", { ascending: false }).limit(1);
  return (data?.[0] as { score: number } | undefined)?.score ?? 0;
}

export async function fetchGameBreakdown(userId: string): Promise<GameBreakdownEntry[]> {
  const sb = await createServerClient();
  const { data } = await sb.from("games_scores")
    .select("game_id, score, played_at").eq("user_id", userId)
    .order("played_at", { ascending: false });
  const rows = (data ?? []) as { game_id: string; score: number; played_at: string }[];
  const byGame = new Map<string, { scores: number[]; last: string }>();
  for (const r of rows) {
    const e = byGame.get(r.game_id);
    if (e) e.scores.push(r.score);
    else byGame.set(r.game_id, { scores: [r.score], last: r.played_at });
  }
  return [...byGame.entries()].map(([game_id, e]) => ({
    game_id,
    best_score: Math.max(...e.scores),
    games_played: e.scores.length,
    average_score: Math.round(e.scores.reduce((a, b) => a + b, 0) / e.scores.length),
    last_played: e.last,
  }));
}

export async function fetchMyRecentScores(userId: string, limit = 15): Promise<GameScore[]> {
  const sb = await createServerClient();
  const { data } = await sb.from("games_scores")
    .select("*").eq("user_id", userId)
    .order("played_at", { ascending: false }).limit(limit);
  return (data ?? []) as GameScore[];
}

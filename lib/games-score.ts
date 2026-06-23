/**
 * games-score.ts — client-side score submission + stats update.
 * Imported only by client game components (uses the browser Supabase client).
 */

import { createClient } from "@/lib/supabase/client";
import { type GameId, levelFromXp } from "@/lib/games-data";

/** Submit a score and update the player's stats (streak, level, XP, count). */
export async function submitScore(
  userId: string,
  gameId: GameId,
  score: number,
  opts?: { durationMs?: number; metadata?: Record<string, unknown>; xpEarned?: number },
): Promise<void> {
  const sb = createClient();
  const { error } = await sb.from("games_scores").insert({
    user_id: userId,
    game_id: gameId,
    score,
    duration_ms: opts?.durationMs ?? null,
    metadata: opts?.metadata ?? null,
  });
  if (error) throw error;
  await updateStatsAfterPlay(userId, opts?.xpEarned ?? score);
}

async function updateStatsAfterPlay(userId: string, xpGained: number): Promise<void> {
  const sb = createClient();
  const { data: existing } = await sb.from("games_user_stats").select("*").eq("user_id", userId).maybeSingle();
  const today = new Date().toISOString().split("T")[0];
  const yesterday = new Date(Date.now() - 86_400_000).toISOString().split("T")[0];
  const lastPlayed = existing?.last_played_date as string | null | undefined;

  let streak = existing?.current_streak_days ?? 0;
  if (lastPlayed === today) { /* unchanged */ }
  else if (lastPlayed === yesterday) streak += 1;
  else streak = 1;

  const longest = Math.max(existing?.longest_streak_days ?? 0, streak);
  const newXp = (existing?.total_xp ?? 0) + xpGained;

  await sb.from("games_user_stats").upsert({
    user_id: userId,
    total_xp: newXp,
    level: levelFromXp(newXp),
    current_streak_days: streak,
    longest_streak_days: longest,
    last_played_date: today,
    games_played: (existing?.games_played ?? 0) + 1,
    updated_at: new Date().toISOString(),
  }, { onConflict: "user_id" });
}

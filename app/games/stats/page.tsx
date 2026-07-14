import Link from "next/link";
import { getAccount } from "@/lib/auth";
import { GAMES, GAMES_ACCENT, xpForLevel, levelFromXp, levelTitle, type GameId } from "@/lib/games-data";
import { fetchUserStats, fetchGameBreakdown, fetchMyRecentScores } from "@/lib/games-data.server";
import { GameArt } from "@/components/games/GameArt";

export const dynamic = "force-dynamic";
export const metadata = { title: "My game stats" };

function relTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.round(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60); if (h < 24) return `${h}h ago`;
  const d = Math.round(h / 24); if (d < 7) return `${d}d ago`;
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

export default async function StatsPage() {
  const account = await getAccount();
  if (!account) {
    return (
      <div className="mx-auto max-w-2xl px-5 py-16 text-center">
        <p className="font-display text-2xl font-bold">Sign in to see your stats</p>
        <a href="/sign-in?next=/games/stats" className="mt-5 inline-block rounded-pill px-6 py-3 font-semibold text-paper" style={{ background: GAMES_ACCENT }}>Sign in</a>
      </div>
    );
  }

  const [stats, breakdown, recent] = await Promise.all([
    fetchUserStats(account.id), fetchGameBreakdown(account.id), fetchMyRecentScores(account.id, 15),
  ]);
  const ids = Object.keys(GAMES) as GameId[];
  const byGame = Object.fromEntries(breakdown.map((b) => [b.game_id, b]));
  const level = stats ? levelFromXp(stats.total_xp) : 1;
  const intoLevel = stats ? stats.total_xp - xpForLevel(level) : 0;
  const span = xpForLevel(level + 1) - xpForLevel(level);
  const pct = stats ? Math.min(100, Math.round((intoLevel / span) * 100)) : 0;

  return (
    <div className="mx-auto max-w-2xl px-5 py-10 sm:py-14">
      <Link href="/games" className="text-sm font-semibold text-ink-soft hover:text-ink">← Games</Link>
      <h1 className="mt-4 font-display text-4xl font-bold">My stats</h1>

      {/* Summary */}
      <div className="mt-6 flex flex-wrap items-center gap-x-8 gap-y-4 rounded-card border border-line bg-paper p-5 shadow-soft">
        <div className="flex items-center gap-3">
          <div className="grid h-14 w-14 place-items-center rounded-full font-display text-xl font-bold text-paper" style={{ background: GAMES_ACCENT }}>{level}</div>
          <div>
            <p className="font-display font-bold text-ink">{levelTitle(level)}</p>
            <p className="text-sm text-ink-muted">{(stats?.total_xp ?? 0).toLocaleString()} total XP</p>
          </div>
        </div>
        <div className="text-center">
          <p className="font-display text-2xl font-bold text-ink">🔥 {stats?.current_streak_days ?? 0}</p>
          <p className="text-xs text-ink-muted">day streak (best {stats?.longest_streak_days ?? 0})</p>
        </div>
        <div className="min-w-[160px] flex-1">
          <div className="h-2.5 overflow-hidden rounded-pill bg-sand"><div className="h-full rounded-pill" style={{ width: `${pct}%`, background: GAMES_ACCENT }} /></div>
          <p className="mt-1 text-xs text-ink-muted">{intoLevel} / {span} XP to level {level + 1}</p>
        </div>
      </div>

      {/* Per-game */}
      <h2 className="mt-10 font-display text-2xl font-bold text-ink">By game</h2>
      <div className="mt-4 space-y-3">
        {ids.map((id) => {
          const b = byGame[id];
          return (
            <div key={id} className="flex items-center gap-4 rounded-card border border-line bg-paper p-4 shadow-soft">
              <GameArt id={id} size={44} />
              <div className="min-w-0 flex-1">
                <p className="font-display font-bold text-ink">{GAMES[id].label}</p>
                {b ? <p className="text-sm text-ink-muted">Best {b.best_score} · {b.games_played} play{b.games_played === 1 ? "" : "s"} · avg {b.average_score}</p> : <p className="text-sm text-ink-faint">Not played yet</p>}
              </div>
              {b?.last_played && <span className="shrink-0 text-xs text-ink-faint">{relTime(b.last_played)}</span>}
            </div>
          );
        })}
      </div>

      {/* Recent */}
      <h2 className="mt-10 font-display text-2xl font-bold text-ink">Recent activity</h2>
      <div className="mt-4 space-y-2">
        {recent.length === 0 ? (
          <p className="text-sm text-ink-muted">No games played yet — <Link href="/games" className="font-semibold underline">jump in</Link>.</p>
        ) : recent.map((s) => (
          <div key={s.id} className="flex items-center gap-3 rounded-xl border border-line bg-paper px-4 py-2.5 shadow-soft">
            <GameArt id={(s.game_id as GameId)} size={28} />
            <span className="flex-1 text-sm font-semibold text-ink">{GAMES[s.game_id as GameId]?.label ?? s.game_id}</span>
            <span className="text-xs text-ink-faint">{relTime(s.played_at)}</span>
            <span className="font-display font-bold text-ink">{s.score}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

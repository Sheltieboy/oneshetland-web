import Image from "next/image";
import Link from "next/link";
import { getAccount } from "@/lib/auth";
import {
  GAMES, GAMES_ACCENT, fetchTopScores, xpForLevel, levelFromXp, levelTitle,
  type GameId, type LeaderboardRow,
} from "@/lib/games-data";
import { fetchUserStats, fetchMyBestScore } from "@/lib/games-data.server";
import { GameArt } from "@/components/games/GameArt";

export const dynamic = "force-dynamic";
export const metadata = { title: "Games · OneShetland" };

const COMING_SOON = [
  { icon: "👨‍👩‍👧", label: "Family Mode" }, { icon: "🔎", label: "Wird Hunt" }, { icon: "🏫", label: "Class Mode" },
  { icon: "⚔️", label: "Spik Duel" }, { icon: "🔊", label: "Hear-da-Wird" }, { icon: "🏆", label: "Tournaments" },
];

export default async function GamesHub() {
  const account = await getAccount();
  const ids = Object.keys(GAMES) as GameId[];

  const [stats, bests, boards] = await Promise.all([
    account ? fetchUserStats(account.id) : Promise.resolve(null),
    account ? Promise.all(ids.map((id) => fetchMyBestScore(account.id, id))) : Promise.resolve([] as number[]),
    Promise.all(ids.map((id) => fetchTopScores(id, "all", 5))),
  ]);
  const bestByGame: Partial<Record<GameId, number>> = {};
  ids.forEach((id, i) => { bestByGame[id] = bests[i] ?? 0; });

  const level = stats ? levelFromXp(stats.total_xp) : 1;
  const intoLevel = stats ? stats.total_xp - xpForLevel(level) : 0;
  const span = xpForLevel(level + 1) - xpForLevel(level);
  const pct = stats ? Math.min(100, Math.round((intoLevel / span) * 100)) : 0;

  return (
    <>
      <section className="relative isolate overflow-hidden" style={{ background: GAMES_ACCENT }}>
        <Image src="/heroes/jobs.webp" alt="" fill priority className="object-cover opacity-10" />
        <div className="absolute inset-0" style={{ background: `linear-gradient(160deg,${GAMES_ACCENT}e6 30%,${GAMES_ACCENT}b0)` }} />
        <div className="relative mx-auto max-w-6xl px-5 py-10 sm:py-12">
          <p className="text-xs font-bold uppercase tracking-widest text-white/80">OneShetland · Games</p>
          <h1 className="mt-1 font-display text-4xl font-bold text-white sm:text-5xl">Learn da dialect through play</h1>
          <p className="mt-2 max-w-xl text-base text-white/90 sm:text-lg">Daily puzzles, speed rounds and leaderboards — all built on the Spik dictionary.</p>
        </div>
      </section>

      <div className="mx-auto max-w-6xl px-5 py-10 sm:py-12 space-y-12">
        {account ? (
          <Link href="/games/stats" className="block rounded-card border border-line bg-paper p-5 shadow-soft transition hover:shadow-lift">
            <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
              <div className="flex items-center gap-3">
                <div className="grid h-12 w-12 place-items-center rounded-full font-display text-lg font-bold text-paper" style={{ background: GAMES_ACCENT }}>{level}</div>
                <div>
                  <p className="font-display font-bold text-ink">Level {level} · {levelTitle(level)}</p>
                  <p className="text-sm text-ink-muted">🔥 {stats?.current_streak_days ?? 0}-day streak · {stats?.games_played ?? 0} games played</p>
                </div>
              </div>
              <div className="min-w-[180px] flex-1">
                <div className="h-2.5 overflow-hidden rounded-pill bg-sand"><div className="h-full rounded-pill" style={{ width: `${pct}%`, background: GAMES_ACCENT }} /></div>
                <p className="mt-1 text-xs text-ink-muted">{intoLevel} / {span} XP to level {level + 1} · {(stats?.total_xp ?? 0).toLocaleString()} total</p>
              </div>
              <span className="text-sm font-semibold" style={{ color: GAMES_ACCENT }}>Full stats →</span>
            </div>
          </Link>
        ) : (
          <div className="rounded-card border border-line bg-paper p-5 text-center shadow-soft">
            <p className="text-ink-soft"><a href="/sign-in?next=/games" className="font-semibold underline" style={{ color: GAMES_ACCENT }}>Sign in</a> to track XP, streaks and climb the leaderboards.</p>
          </div>
        )}

        <section>
          <h2 className="mb-5 font-display text-2xl font-bold text-ink sm:text-3xl">Play now</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {ids.map((id) => (
              <Link key={id} href={GAMES[id].href} className="group flex items-center gap-4 rounded-card border border-line bg-paper p-4 shadow-soft transition hover:-translate-y-1 hover:shadow-lift">
                <GameArt id={id} size={60} />
                <div className="min-w-0 flex-1">
                  <p className="font-display text-lg font-bold text-ink group-hover:underline">{GAMES[id].label}</p>
                  <p className="text-sm text-ink-soft">{GAMES[id].description}</p>
                  {account && (bestByGame[id] ?? 0) > 0 && <p className="mt-1 text-xs font-semibold text-ink-muted">Your best: {bestByGame[id]}</p>}
                </div>
                <span className="shrink-0 text-ink-faint">→</span>
              </Link>
            ))}
          </div>
        </section>

        <section>
          <h2 className="mb-5 font-display text-2xl font-bold text-ink sm:text-3xl">Leaderboards</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {ids.map((id, i) => (
              <MiniBoard key={id} label={GAMES[id].label} rows={boards[i]} meId={account?.id ?? null} />
            ))}
          </div>
        </section>

        <section>
          <h2 className="mb-5 font-display text-2xl font-bold text-ink sm:text-3xl">Coming soon</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {COMING_SOON.map((c) => (
              <div key={c.label} className="rounded-card border border-dashed border-line bg-paper/60 p-4 text-center">
                <span className="text-2xl">{c.icon}</span>
                <p className="mt-1 text-sm font-semibold text-ink-soft">{c.label}</p>
              </div>
            ))}
          </div>
        </section>
      </div>
    </>
  );
}

function MiniBoard({ label, rows, meId }: { label: string; rows: LeaderboardRow[]; meId: string | null }) {
  return (
    <div className="rounded-card border border-line bg-paper p-5 shadow-soft">
      <p className="mb-3 font-display font-bold text-ink">{label}</p>
      {rows.length === 0 ? (
        <p className="text-sm text-ink-muted">No scores yet — be the first!</p>
      ) : (
        <ol className="space-y-1.5">
          {rows.map((r, i) => (
            <li key={r.user_id} className="flex items-center gap-3 text-sm">
              <span className={"w-5 text-center font-bold " + (i === 0 ? "text-amber-500" : "text-ink-faint")}>{i + 1}</span>
              <span className="flex-1 truncate text-ink">{r.games_handle ?? "Player"}{r.user_id === meId ? " · you" : ""}</span>
              <span className="font-display font-bold text-ink">{r.best_score}</span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

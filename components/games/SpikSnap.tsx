"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { loadSpikGameWords, makeSnapCard, type SpikGameWord } from "@/lib/games-data";
import { submitScore } from "@/lib/games-score";
import { Burst, Rain, PopNumber } from "@/components/games/Confetti";

const ACCENT = "#E0820F";
type Phase = "loading" | "ready" | "playing" | "done";
type Card = { word: SpikGameWord; shownMeaning: string; match: boolean };

export function SpikSnap({ userId }: { userId: string | null }) {
  const [phase, setPhase] = useState<Phase>("loading");
  const [pool, setPool] = useState<SpikGameWord[]>([]);
  const [card, setCard] = useState<Card | null>(null);
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [bestStreak, setBestStreak] = useState(0);
  const [timeLeft, setTimeLeft] = useState(60);
  const [flash, setFlash] = useState<"ok" | "no" | null>(null);
  const [burstKey, setBurstKey] = useState(0);
  const [locked, setLocked] = useState(false);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => { loadSpikGameWords().then((w) => { setPool(w); setPhase("ready"); }); }, []);

  const end = useCallback(async () => {
    if (timer.current) clearInterval(timer.current);
    setPhase("done");
    setScore((s) => { if (userId) submitScore(userId, "spik_snap", s, { durationMs: 60000, metadata: { best_streak: bestStreak }, xpEarned: s }).catch(() => {}); return s; });
  }, [userId, bestStreak]);

  function start() {
    setScore(0); setStreak(0); setBestStreak(0); setTimeLeft(60); setPhase("playing"); setCard(makeSnapCard(pool));
    timer.current = setInterval(() => setTimeLeft((t) => { if (t <= 1) { end(); return 0; } return t - 1; }), 1000);
  }

  function answer(saidMatch: boolean) {
    if (locked || !card) return;
    setLocked(true);
    const correct = saidMatch === card.match;
    if (correct) { setScore((s) => s + 1); setStreak((st) => { const n = st + 1; setBestStreak((b) => Math.max(b, n)); return n; }); setFlash("ok"); setBurstKey((k) => k + 1); }
    else { setStreak(0); setFlash("no"); setTimeLeft((t) => Math.max(0, t - 2)); }
    setTimeout(() => { setFlash(null); setCard(makeSnapCard(pool)); setLocked(false); }, 380);
  }

  useEffect(() => () => { if (timer.current) clearInterval(timer.current); }, []);

  if (phase === "loading") return <Centered><p className="text-ink-muted">Loading wirds…</p></Centered>;
  if (phase === "ready") return (
    <Centered>
      <div className="rounded-card border border-line bg-paper p-8 text-center shadow-soft">
        <h2 className="font-display text-3xl font-bold text-ink">Spik Snap</h2>
        <p className="mx-auto mt-2 max-w-sm text-ink-soft">Does the meaning match the wird? Tap <b>Match</b> or <b>No match</b>. As many as you can in 60 seconds — wrong answers cost 2 seconds.</p>
        <button onClick={start} className="mt-6 rounded-pill px-8 py-3 font-semibold text-paper transition hover:brightness-95" style={{ background: ACCENT }}>Start</button>
        {!userId && <p className="mt-3 text-xs text-ink-muted">Playing as a guest — <a href="/sign-in?next=/games/spik-snap" className="underline">sign in</a> to save scores.</p>}
      </div>
    </Centered>
  );
  if (phase === "done") return (
    <Centered>
      <Rain show={score >= 10} />
      <div className="rounded-card border border-line bg-paper p-8 text-center shadow-soft">
        <p className="text-sm font-bold uppercase tracking-widest" style={{ color: ACCENT }}>{score >= 10 ? "🎉 Sharp work!" : "Time's up"}</p>
        <p className="mt-2 font-display text-5xl font-bold text-ink">{score}</p>
        <p className="text-ink-muted">correct{bestStreak >= 3 ? ` · best streak ${bestStreak}` : ""}</p>
        {userId ? <p className="mt-2 text-sm font-semibold" style={{ color: ACCENT }}>+{score} XP</p> : <p className="mt-2 text-xs text-ink-muted"><a href="/sign-in" className="underline">Sign in</a> to save your score</p>}
        <div className="mt-6 flex justify-center gap-3">
          <button onClick={start} className="rounded-pill px-6 py-2.5 font-semibold text-paper hover:brightness-95" style={{ background: ACCENT }}>Play again</button>
          <Link href="/games" className="rounded-pill border border-line-strong px-6 py-2.5 font-semibold text-ink hover:bg-sand">Back to games</Link>
        </div>
      </div>
    </Centered>
  );

  return (
    <div className="mx-auto max-w-xl px-5 py-8">
      <Burst fireKey={burstKey} />
      <div className="mb-3 flex items-center justify-between">
        <span className="font-display text-2xl font-bold text-ink"><PopNumber value={score} />{streak >= 3 ? <span className="ml-2 text-sm" style={{ color: ACCENT }}>🔥{streak}</span> : null}</span>
        <span className={"font-display text-2xl font-bold " + (timeLeft <= 5 ? "text-rose-600" : "text-ink")}>{timeLeft}s</span>
      </div>
      <div className="h-2 overflow-hidden rounded-pill bg-sand"><div className="h-full rounded-pill transition-[width] duration-1000 ease-linear" style={{ width: `${(timeLeft / 60) * 100}%`, background: ACCENT }} /></div>

      <div className="mt-6 rounded-card border border-line bg-paper p-8 text-center shadow-soft">
        <p className="font-display text-3xl font-bold text-ink">{card?.word.word}</p>
        {card?.word.pronunciation && <p className="mt-1 text-sm italic text-ink-muted">{card.word.pronunciation}</p>}
        <div className="my-4 h-px bg-line" />
        <p className="text-lg text-ink-soft">{card?.shownMeaning}</p>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3">
        <button onClick={() => answer(false)} disabled={locked} className="rounded-pill border border-rose-300 bg-rose-50 py-3.5 font-bold text-rose-700 transition hover:bg-rose-100 disabled:opacity-60">✕ No match</button>
        <button onClick={() => answer(true)} disabled={locked} className="rounded-pill py-3.5 font-bold text-paper transition hover:brightness-95 disabled:opacity-60" style={{ background: ACCENT }}>✓ Match</button>
      </div>
      {flash && <div className={"pointer-events-none fixed inset-0 z-50 " + (flash === "no" ? "bg-rose-500/10" : "bg-amber-500/10")} />}
    </div>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return <div className="mx-auto flex max-w-xl items-center justify-center px-5 py-16">{children}</div>;
}

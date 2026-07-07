"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { loadSpikGameWords, makeSprintQuestion, type SpikGameWord } from "@/lib/games-data";
import { submitScore } from "@/lib/games-score";
import { Burst, Rain, PopNumber } from "@/components/games/Confetti";

const ACCENT = "#059669";
type Phase = "loading" | "ready" | "playing" | "done";
type Q = { meaning: string; options: SpikGameWord[]; correctIndex: number };

export function SpikSprint({ userId }: { userId: string | null }) {
  const [phase, setPhase] = useState<Phase>("loading");
  const [pool, setPool] = useState<SpikGameWord[]>([]);
  const [q, setQ] = useState<Q | null>(null);
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [bestStreak, setBestStreak] = useState(0);
  const [timeLeft, setTimeLeft] = useState(60);
  const [picked, setPicked] = useState<number | null>(null);
  const [flash, setFlash] = useState<"ok" | "no" | null>(null);
  const [burstKey, setBurstKey] = useState(0);
  const [saveError, setSaveError] = useState(false);
  const [saving, setSaving] = useState(false);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => { loadSpikGameWords().then((w) => { setPool(w); setPhase("ready"); }); }, []);

  const next = useCallback((p: SpikGameWord[]) => { setQ(makeSprintQuestion(p, 4)); setPicked(null); }, []);

  const save = useCallback(async (finalScore: number, finalBestStreak: number) => {
    if (!userId || finalScore < 0) return;
    setSaving(true);
    setSaveError(false);
    try {
      await submitScore(userId, "spik_sprint", finalScore, { durationMs: 60000, metadata: { best_streak: finalBestStreak }, xpEarned: finalScore });
    } catch (e) {
      console.error("Score submit failed", e);
      setSaveError(true);
    } finally {
      setSaving(false);
    }
  }, [userId]);

  const end = useCallback(async () => {
    if (timer.current) clearInterval(timer.current);
    setPhase("done");
    setScore((s) => { void save(s, bestStreak); return s; });
  }, [save, bestStreak]);

  function start() {
    setScore(0); setStreak(0); setBestStreak(0); setTimeLeft(60); setPhase("playing"); next(pool);
    timer.current = setInterval(() => setTimeLeft((t) => { if (t <= 1) { end(); return 0; } return t - 1; }), 1000);
  }

  function answer(i: number) {
    if (picked !== null || !q) return;
    setPicked(i);
    if (i === q.correctIndex) {
      setScore((s) => s + 1);
      setStreak((st) => { const n = st + 1; setBestStreak((b) => Math.max(b, n)); return n; });
      setFlash("ok");
      setBurstKey((k) => k + 1);
    } else {
      setStreak(0); setFlash("no");
      setTimeLeft((t) => Math.max(0, t - 2));
    }
    setTimeout(() => { setFlash(null); next(pool); }, 420);
  }

  useEffect(() => () => { if (timer.current) clearInterval(timer.current); }, []);

  if (phase === "loading") return <Centered><p className="text-ink-muted">Loading wirds…</p></Centered>;

  if (phase === "ready") {
    return (
      <Centered>
        <div className="rounded-card border border-line bg-paper p-8 text-center shadow-soft">
          <h2 className="font-display text-3xl font-bold text-ink">Spik Sprint</h2>
          <p className="mx-auto mt-2 max-w-sm text-ink-soft">Tap the Shetland wird that matches the meaning. As many as you can in 60 seconds. Wrong answers cost 2 seconds.</p>
          <button onClick={start} className="mt-6 rounded-pill px-8 py-3 font-semibold text-paper transition hover:brightness-95" style={{ background: ACCENT }}>Start</button>
          {!userId && <p className="mt-3 text-xs text-ink-muted">Playing as a guest — <a href="/sign-in?next=/games/spik-sprint" className="underline">sign in</a> to save scores.</p>}
        </div>
      </Centered>
    );
  }

  if (phase === "done") {
    const great = score >= 10;
    return (
      <Centered>
        <Rain show={great} />
        <div className="rounded-card border border-line bg-paper p-8 text-center shadow-soft">
          <p className="text-sm font-bold uppercase tracking-widest" style={{ color: ACCENT }}>{great ? "🎉 Brilliant sprint!" : "Time's up"}</p>
          <p className="mt-2 font-display text-5xl font-bold text-ink">{score}</p>
          <p className="text-ink-muted">correct{bestStreak >= 3 ? ` · best streak ${bestStreak}` : ""}</p>
          {userId && !saveError && <p className="mt-2 text-sm font-semibold" style={{ color: ACCENT }}>+{score} XP</p>}
          {!userId && <p className="mt-2 text-xs text-ink-muted"><a href="/sign-in?next=/games/spik-sprint" className="underline">Sign in</a> to save your score</p>}
          {userId && saveError && (
            <div className="mt-3 rounded-card border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              <p className="font-semibold">Couldn&apos;t save your score.</p>
              <p className="mt-0.5 text-rose-600">It won&apos;t count on the leaderboard until it saves.</p>
              <button onClick={() => save(score, bestStreak)} disabled={saving} className="mt-2 rounded-pill bg-rose-600 px-4 py-1.5 text-xs font-semibold text-white hover:brightness-95 disabled:opacity-60">{saving ? "Saving…" : "Retry"}</button>
            </div>
          )}
          <div className="mt-6 flex justify-center gap-3">
            <button onClick={start} className="rounded-pill px-6 py-2.5 font-semibold text-paper hover:brightness-95" style={{ background: ACCENT }}>Play again</button>
            <Link href="/games" className="rounded-pill border border-line-strong px-6 py-2.5 font-semibold text-ink hover:bg-sand">Back to games</Link>
          </div>
        </div>
      </Centered>
    );
  }

  // playing
  return (
    <div className="mx-auto max-w-xl px-5 py-8">
      <Burst fireKey={burstKey} />
      <div className="mb-3 flex items-center justify-between">
        <PopNumber value={score} className="font-display text-2xl font-bold text-ink" />
        <span className={"font-display text-2xl font-bold " + (timeLeft <= 5 ? "text-rose-600" : "text-ink")}>{timeLeft}s</span>
      </div>
      <div className="h-2 overflow-hidden rounded-pill bg-sand"><div className="h-full rounded-pill transition-[width] duration-1000 ease-linear" style={{ width: `${(timeLeft / 60) * 100}%`, background: ACCENT }} /></div>
      {streak >= 3 && <p className="mt-3 text-center text-sm font-bold" style={{ color: ACCENT }}>🔥 {streak} in a row!</p>}

      <div className="mt-6 rounded-card border border-line bg-paper p-6 text-center shadow-soft">
        <p className="text-xs font-bold uppercase tracking-widest text-ink-muted">Which wird means</p>
        <p className="mt-2 font-display text-xl font-bold text-ink">{q?.meaning}</p>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3">
        {q?.options.map((o, i) => {
          let cls = "border-line bg-paper hover:border-line-strong";
          if (picked !== null) {
            if (i === q.correctIndex) cls = "text-paper";
            else if (i === picked) cls = "bg-rose-100 border-rose-300";
            else cls = "opacity-50 border-line bg-paper";
          }
          return (
            <button key={o.id} onClick={() => answer(i)} disabled={picked !== null}
              className={"rounded-card border p-4 text-center shadow-soft transition " + cls}
              style={picked !== null && i === q.correctIndex ? { background: ACCENT, borderColor: ACCENT } : undefined}>
              <span className="block font-display text-lg font-bold">{o.word}</span>
              {o.pronunciation && <span className="block text-xs opacity-70">{o.pronunciation}</span>}
            </button>
          );
        })}
      </div>
      {flash && <div className={"pointer-events-none fixed inset-0 z-50 " + (flash === "no" ? "bg-rose-500/10" : "bg-emerald-500/10")} />}
    </div>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return <div className="mx-auto flex max-w-xl items-center justify-center px-5 py-16">{children}</div>;
}

"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  loadPlacePool, pickDailyPlaces, pickPracticeRounds, resolveRound, totalScore,
  starsForDistance, addCumulativePts, loadSession, saveSession, buildShareText, todayKey, formatDateLabel,
  latLngToXY, xyToLatLng, islandPolygons,
  ROUNDS_PER_DAY, MAX_POINTS_PER_ROUND,
  type Place, type RoundResult, type SessionState,
} from "@/lib/map-it";
import { submitScore } from "@/lib/games-score";
import { Burst, Rain } from "@/components/games/Confetti";

const ACCENT = "#0E8FAC";
const W = 320, H = 540;
type Phase = "loading" | "intro" | "playing" | "revealing" | "done";

export function MapIt({ userId }: { userId: string | null }) {
  const uid = userId ?? "guest";
  const [mode, setMode] = useState<"daily" | "practice">("daily");
  const [phase, setPhase] = useState<Phase>("loading");
  const [pool, setPool] = useState<Place[]>([]);
  const [places, setPlaces] = useState<Place[]>([]);
  const [roundIdx, setRoundIdx] = useState(0);
  const [guess, setGuess] = useState<{ lat: number; lng: number } | null>(null);
  const [results, setResults] = useState<RoundResult[]>([]);
  const [copied, setCopied] = useState(false);
  const [burstKey, setBurstKey] = useState(0);

  const polys = useMemo(() => islandPolygons(W, H), []);

  useEffect(() => {
    (async () => {
      const p = await loadPlacePool();
      setPool(p);
      const saved = loadSession(uid, todayKey());
      if (saved && saved.dateKey === todayKey() && !saved.submitted && saved.places.length) {
        setPlaces(saved.places); setResults(saved.results); setRoundIdx(saved.results.length); setMode("daily");
        setPhase(saved.results.length === 0 ? "intro" : "playing");
      } else if (saved && saved.submitted) {
        setPlaces(saved.places); setResults(saved.results); setRoundIdx(saved.places.length); setMode("daily"); setPhase("done");
      } else {
        setPlaces(pickDailyPlaces(todayKey(), p)); setPhase("intro");
      }
    })();
  }, [uid]);

  const persist = useCallback((next: Partial<SessionState>) => {
    if (mode !== "daily") return;
    const state: SessionState = { dateKey: todayKey(), places, results, submitted: false, ...next };
    saveSession(uid, state);
  }, [mode, places, results, uid]);

  const finishGame = useCallback((finalResults: RoundResult[]) => {
    const total = totalScore(finalResults);
    addCumulativePts(total);
    if (userId && mode === "daily") {
      submitScore(userId, "map_it", total, { metadata: { date: todayKey(), rounds: finalResults.map((r) => ({ place: r.place.name, distance: Math.round(r.distanceKm * 10) / 10, points: r.points })) } }).catch(() => {});
      saveSession(uid, { dateKey: todayKey(), places, results: finalResults, submitted: true });
    }
    setPhase("done");
  }, [userId, mode, places, uid]);

  function startDaily() { setMode("daily"); setPlaces(pickDailyPlaces(todayKey(), pool)); setResults([]); setRoundIdx(0); setGuess(null); setPhase("playing"); }
  function startPractice() { setMode("practice"); setPlaces(pickPracticeRounds(pool, pickDailyPlaces(todayKey(), pool).map((p) => p.id))); setResults([]); setRoundIdx(0); setGuess(null); setPhase("playing"); }

  function onMapClick(e: React.MouseEvent<SVGSVGElement>) {
    if (phase !== "playing") return;
    const rect = e.currentTarget.getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width) * W;
    const py = ((e.clientY - rect.top) / rect.height) * H;
    setGuess(xyToLatLng(px, py, W, H));
  }

  function submitGuess() {
    if (!guess) return;
    const r = resolveRound(places[roundIdx], guess);
    if (starsForDistance(r.distanceKm) === 3) setBurstKey((k) => k + 1);
    const newResults = [...results, r];
    setResults(newResults);
    persist({ results: newResults });
    setPhase("revealing");
  }

  function nextRound() {
    const last = roundIdx + 1;
    if (last >= places.length) { finishGame(results); return; }
    setRoundIdx(last); setGuess(null); setPhase("playing");
  }

  async function share() {
    const txt = buildShareText({ dateKey: todayKey(), places, results, submitted: true }, totalScore(results));
    try { await navigator.clipboard.writeText(txt); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { /* */ }
  }

  if (phase === "loading") return <div className="mx-auto max-w-md px-5 py-16 text-center text-ink-muted">Loading da map…</div>;

  if (phase === "intro") {
    return (
      <div className="mx-auto max-w-md px-5 py-10 text-center">
        <h2 className="font-display text-3xl font-bold text-ink">Map It</h2>
        <p className="mt-1 text-sm font-semibold" style={{ color: ACCENT }}>{formatDateLabel(todayKey())}</p>
        <p className="mx-auto mt-3 max-w-sm text-ink-soft">You'll be given {ROUNDS_PER_DAY} Shetland places. Tap the map where you think each one is — the closer your pin, the more points. Three stars for a bullseye.</p>
        <button onClick={startDaily} className="mt-6 rounded-pill px-8 py-3 font-semibold text-paper transition hover:brightness-95" style={{ background: ACCENT }}>Start today's round</button>
        {!userId && <p className="mt-3 text-xs text-ink-muted">Playing as a guest — <a href="/sign-in?next=/games/map-it" className="underline">sign in</a> to save scores.</p>}
      </div>
    );
  }

  if (phase === "done") {
    const total = totalScore(results);
    const great = total >= places.length * 600;
    return (
      <div className="mx-auto max-w-md px-5 py-10 text-center">
        <Rain show={great} />
        {great && <p className="font-display text-lg font-bold" style={{ color: ACCENT }}>🎉 Weel kent!</p>}
        <p className="text-sm font-bold uppercase tracking-widest" style={{ color: ACCENT }}>{mode === "daily" ? formatDateLabel(todayKey()) : "Practice"}</p>
        <p className="mt-2 font-display text-5xl font-bold text-ink">{total.toLocaleString()}</p>
        <p className="text-ink-muted">of {places.length * MAX_POINTS_PER_ROUND} points</p>
        <div className="mx-auto mt-5 flex max-w-xs flex-wrap justify-center gap-1.5">
          {results.map((r, i) => { const s = starsForDistance(r.distanceKm); return <span key={i} className="text-2xl" title={`${r.place.name} · ${r.distanceKm.toFixed(1)} km`}>{s === 3 ? "⚓" : s === 2 ? "〰️" : s === 1 ? "·" : "✕"}</span>; })}
        </div>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          {mode === "daily" && <button onClick={share} className="rounded-pill px-5 py-2.5 text-sm font-semibold text-paper hover:brightness-95" style={{ background: ACCENT }}>{copied ? "Copied!" : "Share"}</button>}
          <button onClick={startPractice} className="rounded-pill border border-line-strong px-5 py-2.5 text-sm font-semibold text-ink hover:bg-sand">Practice round</button>
          <Link href="/games" className="rounded-pill border border-line-strong px-5 py-2.5 text-sm font-semibold text-ink hover:bg-sand">Back to games</Link>
        </div>
      </div>
    );
  }

  // playing / revealing
  const place = places[roundIdx];
  const result = phase === "revealing" ? results[results.length - 1] : null;
  const guessXY = guess ? latLngToXY(guess.lat, guess.lng, W, H) : null;
  const answerXY = result ? latLngToXY(result.place.lat, result.place.lng, W, H) : null;

  return (
    <div className="mx-auto max-w-md px-5 py-6">
      <Burst fireKey={burstKey} />
      <div className="mb-2 flex items-center justify-between text-sm">
        <span className="font-semibold text-ink-muted">Round {roundIdx + 1} of {places.length}</span>
        <span className="font-display font-bold text-ink">{totalScore(results).toLocaleString()} pts</span>
      </div>

      <div className="rounded-card border border-line bg-paper p-4 text-center shadow-soft">
        <p className="text-xs font-bold uppercase tracking-widest text-ink-muted">Where is</p>
        <p className="font-display text-2xl font-bold text-ink">{place.name}</p>
        <p className="text-xs text-ink-faint">{place.category}{place.region ? ` · ${place.region}` : ""}</p>
      </div>

      <svg viewBox={`0 0 ${W} ${H}`} onClick={onMapClick} className="mt-4 w-full rounded-card border border-line shadow-soft" style={{ background: "#b2daf7", cursor: phase === "playing" ? "crosshair" : "default" }}>
        {polys.map((p) => <polygon key={p.name} points={p.points} fill="#cde8c9" stroke="#8bbf86" strokeWidth={0.8} />)}
        {result && answerXY && guessXY && <line x1={guessXY.x} y1={guessXY.y} x2={answerXY.x} y2={answerXY.y} stroke="#475569" strokeWidth={1.5} strokeDasharray="4 3" />}
        {guessXY && <g><circle cx={guessXY.x} cy={guessXY.y} r={6} fill={ACCENT} stroke="#fff" strokeWidth={2} /></g>}
        {result && answerXY && <g><circle cx={answerXY.x} cy={answerXY.y} r={6} fill="#DC2626" stroke="#fff" strokeWidth={2} /></g>}
      </svg>

      {phase === "playing" ? (
        <div className="mt-4 flex items-center justify-between gap-3">
          <p className="text-sm text-ink-muted">{guess ? "Tap Submit, or tap the map again to move your pin." : "Tap the map to drop your pin."}</p>
          <button onClick={submitGuess} disabled={!guess} className="rounded-pill px-6 py-2.5 text-sm font-semibold text-paper transition hover:brightness-95 disabled:opacity-40" style={{ background: ACCENT }}>Submit</button>
        </div>
      ) : result ? (
        <div className="mt-4 rounded-card border border-line bg-paper p-4 text-center shadow-soft">
          <p className="font-display text-2xl font-bold text-ink">{"★".repeat(starsForDistance(result.distanceKm))}<span className="text-line-strong">{"★".repeat(3 - starsForDistance(result.distanceKm))}</span></p>
          <p className="mt-1 text-ink-soft"><b>{result.distanceKm.toFixed(1)} km</b> away · <b style={{ color: ACCENT }}>+{result.points}</b> points</p>
          <button onClick={nextRound} className="mt-3 rounded-pill px-6 py-2.5 text-sm font-semibold text-paper hover:brightness-95" style={{ background: ACCENT }}>
            {roundIdx + 1 >= places.length ? "See results" : "Next place →"}
          </button>
        </div>
      ) : null}
    </div>
  );
}

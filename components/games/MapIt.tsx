"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  loadPlacePool, pickDailyPlaces, pickPracticeRounds, resolveRound, totalScore,
  starsForDistance, addCumulativePts, loadSession, saveSession, buildShareText, todayKey, formatDateLabel,
  latToSvgY, lngToSvgX, svgXToLng, svgYToLat, SVG_W, SVG_H,
  ROUNDS_PER_DAY, MAX_POINTS_PER_ROUND,
  type Place, type RoundResult, type SessionState,
} from "@/lib/map-it";
import { submitScore } from "@/lib/games-score";
import { Burst, Rain } from "@/components/games/Confetti";
import { GameIntro } from "@/components/games/GameIntro";

const ACCENT = "#0E8FAC";
const SEA = "#b2daf7"; // matches the SVG's own sea fill so the canvas backdrop reads seamlessly
type Phase = "loading" | "intro" | "playing" | "revealing" | "done";

type VB = { x: number; y: number; w: number; h: number };
const FULL_VB: VB = { x: 0, y: 0, w: SVG_W, h: SVG_H };

// The "base" (fully-zoomed-out) viewBox frames the whole map to the container's
// aspect ratio WITHOUT distortion — mirrors computeBaseVb in app/games/map-it.tsx.
// When the container is wider than the map's natural aspect we extend into the
// surrounding sea on the sides; narrower → top/bottom. The canvas backdrop is the
// same sea colour, so the extension reads seamlessly.
function computeBaseVb(cw: number, ch: number): VB {
  if (!cw || !ch) return FULL_VB;
  const canvasAR = cw / ch;
  const contentAR = SVG_W / SVG_H;
  if (canvasAR >= contentAR) {
    const h = SVG_H;
    const w = h * canvasAR;
    return { x: (SVG_W - w) / 2, y: 0, w, h };
  }
  const w = SVG_W;
  const h = w / canvasAR;
  return { x: 0, y: (SVG_H - h) / 2, w, h };
}

// Clamp a viewBox to stay within the base view, max 8× zoom. Height tracks the
// base aspect so the render never distorts (mirrors clampVB in the app).
function clampVBTo(vb: VB, base: VB): VB {
  const w = Math.max(base.w / 8, Math.min(base.w, vb.w));
  const h = w * (base.h / base.w);
  const x = Math.max(base.x, Math.min(base.x + base.w - w, vb.x));
  const y = Math.max(base.y, Math.min(base.y + base.h - h, vb.y));
  return { x, y, w, h };
}

// Fetch the real Shetland SVG once, strip its outer <svg …> wrapper, and return
// just the inner markup (the sea <rect> + the islands <g>) so it can be injected
// into the game's own <svg> and share its viewBox coordinate space (crisp at zoom).
function extractInnerSvg(text: string): string {
  const open = text.indexOf(">", text.indexOf("<svg"));
  const close = text.lastIndexOf("</svg>");
  if (open === -1 || close === -1) return "";
  return text.slice(open + 1, close);
}

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
  const [saveError, setSaveError] = useState(false);
  const [saving, setSaving] = useState(false);

  // ── Basemap (real Shetland SVG, inlined once and shared into our viewBox) ──
  const [basemap, setBasemap] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    fetch("/shetland-blank-map.svg")
      .then((r) => r.text())
      .then((t) => { if (!cancelled) setBasemap(extractInnerSvg(t)); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  // ── Zoom / pan ──────────────────────────────────────────────────────────
  // Dynamic viewBox over the SVG's native 832×1582 space, so the basemap, pins,
  // and taps all share one coordinate system and scoring stays unchanged.
  const [vb, setVb] = useState<VB>(FULL_VB);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const vbRef = useRef<VB>(FULL_VB);
  vbRef.current = vb;

  // The base (fully-zoomed-out) viewBox depends on the rendered container size.
  const [containerSize, setContainerSize] = useState({ w: 0, h: 0 });
  const base = useMemo(() => computeBaseVb(containerSize.w, containerSize.h), [containerSize]);
  const baseRef = useRef<VB>(FULL_VB);
  baseRef.current = base;

  const clampVB = useCallback((next: VB): VB => clampVBTo(next, baseRef.current), []);
  const resetVB = useCallback(() => { setVb(baseRef.current); }, []);

  // Convert a client point (px) to SVG-space coords through the current viewBox.
  const clientToLocal = useCallback((clientX: number, clientY: number, v: VB) => {
    const rect = svgRef.current!.getBoundingClientRect();
    return {
      x: v.x + ((clientX - rect.left) / rect.width) * v.w,
      y: v.y + ((clientY - rect.top) / rect.height) * v.h,
    };
  }, []);

  // Zoom toward a focal local point: keep that point under the same client position.
  const zoomToward = useCallback((focalX: number, focalY: number, factor: number, v: VB) => {
    const b = baseRef.current;
    const targetW = Math.min(b.w, Math.max(b.w / 8, v.w * factor));
    const realFactor = targetW / v.w; // after clamping
    const nx = focalX - (focalX - v.x) * realFactor;
    const ny = focalY - (focalY - v.y) * realFactor;
    return clampVBTo({ x: nx, y: ny, w: targetW, h: targetW * (b.h / b.w) }, b);
  }, []);

  // Pointer tracking for tap-vs-drag and one-finger pan / two-finger pinch.
  const pointers = useRef<Map<number, { x: number; y: number }>>(new Map());
  const dragState = useRef<{
    startClientX: number; startClientY: number; startVb: VB; moved: boolean; pinch: boolean;
  } | null>(null);
  const pinchRef = useRef<{ dist: number; startVb: VB } | null>(null);
  const [isPanning, setIsPanning] = useState(false);

  useEffect(() => {
    (async () => {
      const p = await loadPlacePool();
      setPool(p);
      const saved = loadSession(uid, todayKey());
      if (saved && saved.dateKey === todayKey() && !saved.submitted && saved.places.length) {
        setPlaces(saved.places); setResults(saved.results); setMode("daily");
        if (saved.results.length >= saved.places.length) {
          // Every round was answered but the session was never submitted (e.g. the
          // tab closed on the last reveal). Resume straight to the results screen
          // rather than a non-existent round.
          setRoundIdx(saved.places.length); setPhase("done");
        } else {
          setRoundIdx(saved.results.length);
          setPhase(saved.results.length === 0 ? "intro" : "playing");
        }
      } else if (saved && saved.submitted) {
        setPlaces(saved.places); setResults(saved.results); setRoundIdx(saved.places.length); setMode("daily"); setPhase("done");
      } else {
        setPlaces(pickDailyPlaces(todayKey(), p)); setPhase("intro");
      }
    })();
  }, [uid]);

  // Snap the view to the base whenever the base changes (first measurement,
  // resize, rotation) so the map always fills the container without distortion.
  useEffect(() => { setVb(base); }, [base]);

  // Reset zoom/pan to the full map at the start of each round and on reveal,
  // so both the guess pin and the answer pin (+ dashed line) are always visible.
  useEffect(() => { resetVB(); }, [roundIdx, resetVB]);
  useEffect(() => { if (phase === "revealing") resetVB(); }, [phase, resetVB]);

  // Measure the rendered container so computeBaseVb frames to its aspect ratio.
  const containerRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const measure = () => {
      const r = el.getBoundingClientRect();
      setContainerSize((prev) => (prev.w === r.width && prev.h === r.height ? prev : { w: r.width, h: r.height }));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [phase]);

  // Non-passive wheel listener so we can preventDefault and stop the page scrolling.
  useEffect(() => {
    const el = svgRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const focal = clientToLocal(e.clientX, e.clientY, vbRef.current);
      // Negative deltaY = zoom in. Scale factor per notch.
      const factor = e.deltaY < 0 ? 0.85 : 1 / 0.85;
      setVb(zoomToward(focal.x, focal.y, factor, vbRef.current));
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [clientToLocal, zoomToward]);

  const persist = useCallback((next: Partial<SessionState>) => {
    if (mode !== "daily") return;
    const state: SessionState = { dateKey: todayKey(), places, results, submitted: false, ...next };
    saveSession(uid, state);
  }, [mode, places, results, uid]);

  // Save the daily score. Only marks the session "submitted" once the score
  // actually saves, so a failed save can be retried and never looks like success.
  const saveDaily = useCallback(async (finalResults: RoundResult[]) => {
    if (!userId) return;
    setSaving(true);
    setSaveError(false);
    const total = totalScore(finalResults);
    try {
      await submitScore(userId, "map_it", total, { metadata: { date: todayKey(), rounds: finalResults.map((r) => ({ place: r.place.name, distance: Math.round(r.distanceKm * 10) / 10, points: r.points })) } });
      saveSession(uid, { dateKey: todayKey(), places, results: finalResults, submitted: true });
    } catch (e) {
      console.error("Map It score submit failed", e);
      setSaveError(true);
    } finally {
      setSaving(false);
    }
  }, [userId, places, uid]);

  const finishGame = useCallback((finalResults: RoundResult[]) => {
    const total = totalScore(finalResults);
    addCumulativePts(total);
    if (userId && mode === "daily") {
      void saveDaily(finalResults);
    }
    setPhase("done");
  }, [userId, mode, saveDaily]);

  function startDaily() { setMode("daily"); setPlaces(pickDailyPlaces(todayKey(), pool)); setResults([]); setRoundIdx(0); setGuess(null); setPhase("playing"); }
  function startPractice() { setMode("practice"); setPlaces(pickPracticeRounds(pool, pickDailyPlaces(todayKey(), pool).map((p) => p.id))); setResults([]); setRoundIdx(0); setGuess(null); setPhase("playing"); }

  const TAP_SLOP = 5; // px of movement allowed before a press counts as a drag

  function onPointerDown(e: React.PointerEvent<SVGSVGElement>) {
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    (e.currentTarget as SVGSVGElement).setPointerCapture?.(e.pointerId);
    if (pointers.current.size === 2) {
      // Begin a pinch: record initial finger distance and current viewBox.
      const pts = [...pointers.current.values()];
      const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      pinchRef.current = { dist, startVb: vbRef.current };
      if (dragState.current) dragState.current.pinch = true;
      setIsPanning(false);
    } else {
      dragState.current = {
        startClientX: e.clientX, startClientY: e.clientY,
        startVb: vbRef.current, moved: false, pinch: false,
      };
    }
  }

  function onPointerMove(e: React.PointerEvent<SVGSVGElement>) {
    if (!pointers.current.has(e.pointerId)) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (pointers.current.size === 2 && pinchRef.current) {
      // Pinch zoom toward the midpoint of the two fingers.
      const pts = [...pointers.current.values()];
      const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      if (dist > 0 && pinchRef.current.dist > 0) {
        const factor = pinchRef.current.dist / dist; // fingers apart → factor<1 → zoom in
        const midX = (pts[0].x + pts[1].x) / 2;
        const midY = (pts[0].y + pts[1].y) / 2;
        const focal = clientToLocal(midX, midY, pinchRef.current.startVb);
        setVb(zoomToward(focal.x, focal.y, factor, pinchRef.current.startVb));
      }
      if (dragState.current) dragState.current.pinch = true;
      return;
    }

    const d = dragState.current;
    if (!d || d.pinch) return;
    const dx = e.clientX - d.startClientX;
    const dy = e.clientY - d.startClientY;
    if (!d.moved && Math.hypot(dx, dy) > TAP_SLOP) { d.moved = true; setIsPanning(true); }
    if (d.moved) {
      // Pan: translate client delta into viewBox units (px → W/H space).
      const rect = svgRef.current!.getBoundingClientRect();
      const vx = d.startVb.x - (dx / rect.width) * d.startVb.w;
      const vy = d.startVb.y - (dy / rect.height) * d.startVb.h;
      setVb(clampVB({ ...d.startVb, x: vx, y: vy }));
    }
  }

  function endPointer(e: React.PointerEvent<SVGSVGElement>) {
    const had = pointers.current.has(e.pointerId);
    pointers.current.delete(e.pointerId);
    (e.currentTarget as SVGSVGElement).releasePointerCapture?.(e.pointerId);
    if (pointers.current.size < 2) pinchRef.current = null;

    const d = dragState.current;
    // Only treat as a tap (drop/move pin) if it was a genuine tap: a single pointer
    // that didn't move past the slop and wasn't part of a pinch.
    if (had && d && !d.moved && !d.pinch && pointers.current.size === 0 && phase === "playing") {
      const local = clientToLocal(e.clientX, e.clientY, d.startVb);
      setGuess({ lat: svgYToLat(local.y), lng: svgXToLng(local.x) });
    }
    if (pointers.current.size === 0) { dragState.current = null; setIsPanning(false); }
  }

  // +/- button zoom toward the centre of the current viewBox.
  function buttonZoom(factor: number) {
    const v = vbRef.current;
    setVb(zoomToward(v.x + v.w / 2, v.y + v.h / 2, factor, v));
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
      <GameIntro
        id="map_it"
        accent={ACCENT}
        title="Map It"
        subtitle={formatDateLabel(todayKey())}
        description={`${ROUNDS_PER_DAY} Shetland places, one map. See how well you know da isles.`}
        howTo={[
          "You'll be given a Shetland place name",
          "Tap the map where you think it is",
          "The closer your pin, the more points — three stars for a bullseye",
        ]}
        onStart={startDaily}
        ctaLabel="Start today's round"
        userId={userId}
        signInPath="/games/map-it"
      />
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
        {userId && mode === "daily" && saveError && (
          <div className="mx-auto mt-5 max-w-xs rounded-card border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            <p className="font-semibold">Couldn&apos;t save your score.</p>
            <p className="mt-0.5 text-rose-600">It won&apos;t count on the leaderboard until it saves.</p>
            <button onClick={() => saveDaily(results)} disabled={saving} className="mt-2 rounded-pill bg-rose-600 px-4 py-1.5 text-xs font-semibold text-white hover:brightness-95 disabled:opacity-60">{saving ? "Saving…" : "Retry"}</button>
          </div>
        )}
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
  // Guard against a corrupt/out-of-range session so we never crash on place.name.
  if (!place) {
    return (
      <div className="mx-auto max-w-md px-5 py-16 text-center">
        <p className="text-ink-soft">That round couldn&apos;t be loaded.</p>
        <button onClick={startDaily} className="mt-4 rounded-pill px-6 py-2.5 text-sm font-semibold text-paper hover:brightness-95" style={{ background: ACCENT }}>Start again</button>
      </div>
    );
  }
  const result = phase === "revealing" ? results[results.length - 1] : null;
  const guessXY = guess ? { x: lngToSvgX(guess.lng), y: latToSvgY(guess.lat) } : null;
  const answerXY = result ? { x: lngToSvgX(result.place.lng), y: latToSvgY(result.place.lat) } : null;
  // Inverse-zoom factor: keeps pins/lines a constant visual size as you zoom in.
  // Scale by vb.w / base.w so visual size is constant relative to the base view.
  const k = vb.w / (base.w || SVG_W);

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

      <div
        ref={containerRef}
        className="relative mt-4 overflow-hidden rounded-card border border-line shadow-soft"
        style={{ background: SEA, aspectRatio: "4 / 5" }}
      >
        <svg
          ref={svgRef}
          viewBox={`${vb.x} ${vb.y} ${vb.w} ${vb.h}`}
          preserveAspectRatio="none"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endPointer}
          onPointerCancel={endPointer}
          className="block h-full w-full"
          style={{ background: SEA, touchAction: "none", cursor: isPanning ? "grabbing" : phase === "playing" ? "crosshair" : "grab" }}
        >
          {/* Real Shetland coastline — injected as native vector paths so it
              scales crisply with the viewBox at every zoom level (up to 8×). */}
          {basemap
            ? <g dangerouslySetInnerHTML={{ __html: basemap }} />
            : <rect x={0} y={0} width={SVG_W} height={SVG_H} fill={SEA} />}
          {result && answerXY && guessXY && <line x1={guessXY.x} y1={guessXY.y} x2={answerXY.x} y2={answerXY.y} stroke="#475569" strokeWidth={4 * k} strokeDasharray={`${11 * k} ${8 * k}`} />}
          {guessXY && <g><circle cx={guessXY.x} cy={guessXY.y} r={16 * k} fill={ACCENT} stroke="#fff" strokeWidth={5 * k} /></g>}
          {result && answerXY && <g><circle cx={answerXY.x} cy={answerXY.y} r={16 * k} fill="#DC2626" stroke="#fff" strokeWidth={5 * k} /></g>}
        </svg>
        {!basemap && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-sm font-semibold text-ink-soft">
            Loading da map…
          </div>
        )}
        <div className="absolute right-2 top-2 flex flex-col gap-1.5">
          <button
            type="button"
            aria-label="Zoom in"
            onClick={() => buttonZoom(0.7)}
            className="flex h-8 w-8 items-center justify-center rounded-full border border-line bg-paper/90 text-lg font-bold leading-none text-ink shadow-soft backdrop-blur hover:bg-paper"
            style={{ color: ACCENT }}
          >+</button>
          <button
            type="button"
            aria-label="Zoom out"
            onClick={() => buttonZoom(1 / 0.7)}
            className="flex h-8 w-8 items-center justify-center rounded-full border border-line bg-paper/90 text-lg font-bold leading-none text-ink shadow-soft backdrop-blur hover:bg-paper"
            style={{ color: ACCENT }}
          >−</button>
        </div>
      </div>

      {phase === "playing" ? (
        <div className="mt-4 flex items-center justify-between gap-3">
          <p className="text-sm text-ink-muted">{guess ? "Tap Submit, or tap the map again to move your pin." : "Tap the map to drop your pin."} Scroll or pinch to zoom, drag to pan.</p>
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

"use client";

import { useEffect, useRef, useState } from "react";
import { MAP_ATTRIBUTION, MAP_VIEWBOX, PLACE_POINTS, REGION_SHAPES } from "@/lib/house-swaps-map-shapes";
import { PLACES, REGIONS, regionName, regionOf } from "@/lib/house-swaps-geo";

/**
 * A plain-SVG, selectable map of Shetland. Regions are the seven localities, dots are the 40 communities (settlement level only: never properties).
 * Everything is a focusable control with a text label, selection is shown by fill AND a tick/ring (never colour alone), and the searchable list in
 * LocationPicker does the same job without the map. No dependency; no tiles; nothing is loaded from elsewhere.
 *
 * Colours (existing tokens): selected = navy fill with white outline and a tick; unselected = sand with a grey outline; focus = ink + white double ring.
 */

// The map is cropped to the mainland and northern isles; Fair Isle (about 40 km further south) is shown as a small framed inset.
const VIEW_H = 612;
const INSET = { x: 22, y: 528, w: 108, h: 78, scale: 2.4, from: { x: 154, y: 786.5 } };
const insetCx = INSET.x + INSET.w / 2, insetCy = INSET.y + INSET.h / 2 + 4;
const insetPoint = (p: { x: number; y: number }) => ({ x: insetCx + INSET.scale * (p.x - INSET.from.x), y: insetCy + INSET.scale * (p.y - INSET.from.y) });
const isFar = (sub: string) => Number(/^M?[\d.]+[ ,]([\d.]+)/.exec(sub)?.[1] ?? 0) > 700;

type Shape = { main: string; far: string; bbox: [number, number, number, number] };
function subBox(sub: string): [number, number, number, number] {
  const pts = sub.replace(/Z/g, "").replace(/M/g, "L").split("L").filter(Boolean).map((s) => s.trim().split(/[ ,]/).map(Number));
  const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
  return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
}
const SHAPES: Record<string, Shape> = Object.fromEntries(Object.entries(REGION_SHAPES).map(([id, r]) => {
  const subs = r.path.split("Z").filter((s) => s.trim()).map((s) => s + "Z");
  const near = subs.filter((s) => !isFar(s));
  // Zoom box: the sizeable pieces only, leaving out far outliers and specks.
  const boxes = near.map(subBox).filter((b) => (b[2] - b[0]) * (b[3] - b[1]) > 150 && b[2] > 60);
  const bb = (boxes.length ? boxes : near.map(subBox)).reduce((a, b) => [Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.max(a[2], b[2]), Math.max(a[3], b[3])] as [number, number, number, number]);
  return [id, { main: near.join(""), far: subs.filter(isFar).join(""), bbox: bb }];
}));

const PILLS: Record<string, { x: number; y: number; lines: string[] }> = {
  yell_unst_fetlar: { x: 238, y: 108, lines: ["Yell, Unst", "& Fetlar"] },
  shetland_north: { x: 196, y: 178, lines: ["North", "Mainland"] },
  whalsay_skerries: { x: 374, y: 338, lines: ["Whalsay", "& Skerries"] },
  shetland_west: { x: 92, y: 372, lines: ["West", "Mainland"] },
  shetland_central: { x: 205, y: 436, lines: ["Central", "Mainland"] },
  lerwick_bressay: { x: 357, y: 436, lines: ["Lerwick", "& Bressay"] },
  shetland_south: { x: 315, y: 520, lines: ["South", "Mainland"] },
};

const pt = (id: string) => (id === "fair_isle" ? insetPoint(PLACE_POINTS[id]) : PLACE_POINTS[id]);
const NEAREST: Record<string, number> = Object.fromEntries(PLACES.map((p) => {
  const a = pt(p.id);
  return [p.id, Math.min(...PLACES.filter((q) => q.id !== p.id).map((q) => Math.hypot(pt(q.id).x - a.x, pt(q.id).y - a.y)))];
}));

type View = { x: number; y: number; w: number; h: number };
const BASE: View = { x: 0, y: 0, w: MAP_VIEWBOX.width, h: VIEW_H };
const clampView = (v: View): View => ({ ...v, x: Math.min(Math.max(v.x, 0), BASE.w - v.w), y: Math.min(Math.max(v.y, 0), BASE.h - v.h) });
const zoomed = (cx: number, cy: number, k: number): View => clampView({ x: cx - BASE.w / k / 2, y: cy - BASE.h / k / 2, w: BASE.w / k, h: BASE.h / k });

export type ShetlandMapProps = {
  mode: "home" | "wants";
  regionIds: string[];
  placeIds: string[];
  onRegion: (id: string) => void;
  onPlace: (id: string) => void;
  /** "Skip the map": the parent moves focus to the list. */
  onSkip?: () => void;
};

export function ShetlandMap({ mode, regionIds, placeIds, onRegion, onPlace, onSkip }: ShetlandMapProps) {
  const [view, setView] = useState<View>(BASE);
  const [focus, setFocus] = useState<string | null>(null);
  const [hover, setHover] = useState<string | null>(null);
  const [width, setWidth] = useState(360);
  const wrap = useRef<HTMLDivElement>(null);
  const drag = useRef<{ sx: number; sy: number; v: View; moved: boolean } | null>(null);
  const suppress = useRef(false);
  const k = BASE.w / view.w;
  const pxPerUnit = width / view.w;
  const inv = 1 / pxPerUnit; // one screen pixel, in map units

  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setWidth(el.clientWidth || 360));
    ro.observe(el);
    setWidth(el.clientWidth || 360);
    return () => ro.disconnect();
  }, []);

  const radio = mode === "home";
  const showNames = k >= 2.4;
  const isRegionOn = (id: string) => regionIds.includes(id);
  const isPlaceOn = (id: string) => placeIds.includes(id);
  const included = (id: string) => mode === "wants" && !isPlaceOn(id) && regionIds.includes(regionOf(id) ?? "");

  function zoomTo(id: string) {
    if (!id) return setView(BASE);
    const b = SHAPES[id]?.bbox;
    if (!b) return;
    const w = Math.max(b[2] - b[0], 60) + 40, h = Math.max(b[3] - b[1], 60) + 40;
    const kk = Math.min(BASE.w / w, BASE.h / h, 6);
    setView(zoomed((b[0] + b[2]) / 2, (b[1] + b[3]) / 2, Math.max(1, kk)));
  }
  const step = (f: number) => setView((v) => zoomed(v.x + v.w / 2, v.y + v.h / 2, Math.min(8, Math.max(1, k * f))));

  function down(e: React.PointerEvent) {
    if (k <= 1.01) return;
    drag.current = { sx: e.clientX, sy: e.clientY, v: view, moved: false };
  }
  function move(e: React.PointerEvent) {
    const d = drag.current;
    if (!d) return;
    const dx = e.clientX - d.sx, dy = e.clientY - d.sy;
    if (!d.moved && Math.hypot(dx, dy) < 6) return;
    d.moved = true;
    setView(clampView({ ...d.v, x: d.v.x - dx * inv, y: d.v.y - dy * inv }));
  }
  function up() {
    if (drag.current?.moved) { suppress.current = true; setTimeout(() => { suppress.current = false; }, 0); }
    drag.current = null;
  }
  const guard = (fn: () => void) => () => { if (!suppress.current) fn(); };
  const keys = (fn: () => void) => (e: React.KeyboardEvent) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); fn(); } };


  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" className={mapBtn} aria-label="Zoom in" onClick={() => step(1.6)} disabled={k >= 7.9}>+</button>
        <button type="button" className={mapBtn} aria-label="Zoom out" onClick={() => step(1 / 1.6)} disabled={k <= 1.01}>{"−"}</button>
        <button type="button" className={`${mapBtn} px-3 text-sm`} onClick={() => setView(BASE)} disabled={k <= 1.01}>Reset map</button>
        <label className="ml-auto flex items-center gap-2 text-sm font-semibold text-ink-soft">
          <span className="sr-only sm:not-sr-only">Zoom to</span>
          <select aria-label="Zoom to a region" className="min-h-[44px] rounded-xl border border-line-strong bg-paper px-2 text-sm text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-navy" value="" onChange={(e) => zoomTo(e.target.value)}>
            <option value="">Zoom to a region</option>
            {REGIONS.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select>
        </label>
      </div>

      <div ref={wrap} className="relative mt-2 overflow-hidden rounded-card border border-line bg-[#eef5f8]" style={{ aspectRatio: `${BASE.w} / ${BASE.h}`, maxHeight: "78vh" }}>
        <svg
          role="group" aria-label="Map of Shetland. Choose areas or communities. The list beside it does the same."
          viewBox={`${view.x} ${view.y} ${view.w} ${view.h}`} preserveAspectRatio="xMidYMid meet"
          className="block h-full w-full select-none" style={{ touchAction: k > 1.01 ? "none" : "pan-y" }}
          onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} onPointerLeave={up}
        >
          {/* Fair Isle inset frame */}
          <g aria-hidden>
            <rect x={INSET.x} y={INSET.y} width={INSET.w} height={INSET.h} rx={6} fill="#fff" fillOpacity={0.55} stroke="var(--color-ink-faint)" strokeWidth={1} strokeDasharray="4 3" />
            <text x={INSET.x + 6} y={INSET.y + 13} fontSize={11} fontWeight={700} fill="var(--color-ink-soft)">Fair Isle</text>
          </g>

          {/* Regions */}
          {REGIONS.map((r) => {
            const sh = SHAPES[r.id]; if (!sh) return null;
            const on = isRegionOn(r.id);
            const fill = on ? "var(--color-navy)" : hover === r.id ? "var(--color-line)" : "var(--color-sand)";
            const stroke = on ? "#fff" : "var(--color-ink-faint)";
            const props = { fill, stroke, strokeWidth: (on ? 0.9 : 0.7), fillRule: "evenodd" as const, strokeLinejoin: "round" as const };
            const toggle = guard(() => onRegion(r.id));
            return (
              <g key={r.id} role={radio ? "radio" : "checkbox"} aria-checked={on} aria-label={`${r.name} region${on ? ", selected" : ""}`} tabIndex={0} style={{ cursor: "pointer", outline: "none" }}
                onClick={toggle} onKeyDown={keys(() => onRegion(r.id))} onFocus={() => setFocus(r.id)} onBlur={() => setFocus((f) => (f === r.id ? null : f))}
                onPointerEnter={() => setHover(r.id)} onPointerLeave={() => setHover((h) => (h === r.id ? null : h))}>
                <path d={sh.main} {...props} />
                {sh.far && <g transform={`translate(${insetCx} ${insetCy}) scale(${INSET.scale}) translate(${-INSET.from.x} ${-INSET.from.y})`}><path d={sh.far} {...props} strokeWidth={props.strokeWidth / INSET.scale} /></g>}
                {focus === r.id && (
                  <g pointerEvents="none" fill="none" strokeLinejoin="round">
                    <path d={sh.main} fillRule="evenodd" stroke="var(--color-ink)" strokeWidth={4 * inv} />
                    <path d={sh.main} fillRule="evenodd" stroke="#fff" strokeWidth={1.6 * inv} />
                  </g>
                )}
              </g>
            );
          })}

          {/* Region name pills: constant size on screen, with a tick when chosen */}
          {REGIONS.map((r) => {
            const p = PILLS[r.id]; if (!p) return null;
            const on = isRegionOn(r.id);
            const w = Math.max(...p.lines.map((l) => l.length)) * 6.6 + (on ? 30 : 16), h = p.lines.length * 13 + 8;
            return (
              <g key={r.id} transform={`translate(${p.x} ${p.y}) scale(${inv})`} pointerEvents="none" aria-hidden>
                <rect x={-w / 2} y={-h / 2} width={w} height={h} rx={9} fill={on ? "var(--color-navy)" : "#fff"} stroke={on ? "#fff" : "var(--color-ink-faint)"} strokeWidth={on ? 1.5 : 1} />
                {on && <path d={`M${-w / 2 + 7} 0l3.5 3.8l6.5 -7.5`} fill="none" stroke="#fff" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />}
                {p.lines.map((l, i) => <text key={l} x={on ? 7 : 0} y={(i - (p.lines.length - 1) / 2) * 13 + 4} textAnchor="middle" fontSize={11.5} fontWeight={700} fill={on ? "#fff" : "var(--color-ink)"}>{l}</text>)}
              </g>
            );
          })}

          {/* Community dots (settlement level only) */}
          {PLACES.map((p) => {
            const c = pt(p.id); if (!c) return null;
            const on = isPlaceOn(p.id), inc = included(p.id);
            // A finger is far wider than the dot: never give a community less than a 22px-wide target, or the tap falls through to the region beneath and chooses the whole area by mistake.
            const hitPx = Math.max(11, Math.min(22, (NEAREST[p.id] * pxPerUnit) / 2));
            const showName = on || focus === p.id || hover === p.id || showNames;
            const r = on ? 6 : 4;
            const toggle = guard(() => onPlace(p.id));
            return (
              <g key={p.id} role="checkbox" aria-checked={on ? true : inc ? "mixed" : false}
                aria-label={`${p.name}, ${regionName(p.regionId)}${on ? ", selected" : inc ? ", included in the whole region" : ""}`}
                tabIndex={0} style={{ cursor: "pointer", outline: "none" }} onClick={toggle} onKeyDown={keys(() => onPlace(p.id))}
                onFocus={() => setFocus(p.id)} onBlur={() => setFocus((f) => (f === p.id ? null : f))}
                onPointerEnter={() => setHover(p.id)} onPointerLeave={() => setHover((h) => (h === p.id ? null : h))}>
                <circle cx={c.x} cy={c.y} r={hitPx * inv} fill="transparent" />
                {focus === p.id && <circle cx={c.x} cy={c.y} r={(r + 5) * inv} fill="none" stroke="var(--color-ink)" strokeWidth={2.5 * inv} />}
                <circle cx={c.x} cy={c.y} r={r * inv} fill={on ? "var(--color-navy)" : "#fff"} stroke={on ? "#fff" : "var(--color-ink)"} strokeWidth={(on ? 2.2 : 1.4) * inv} />
                {on && <circle cx={c.x} cy={c.y} r={(r + 2.2) * inv} fill="none" stroke="var(--color-navy)" strokeWidth={1.2 * inv} />}
                {showName && (
                  <g transform={`translate(${c.x} ${c.y - (r + 9) * inv}) scale(${inv})`} pointerEvents="none">
                    <rect x={-(p.name.length * 3.3 + 7)} y={-9} width={p.name.length * 6.6 + 14} height={17} rx={8.5} fill={on ? "var(--color-navy)" : "#fff"} stroke={on ? "#fff" : "var(--color-ink-faint)"} strokeWidth={1} />
                    <text x={0} y={3.5} textAnchor="middle" fontSize={10.5} fontWeight={700} fill={on ? "#fff" : "var(--color-ink)"}>{p.name}</text>
                  </g>
                )}
              </g>
            );
          })}
        </svg>
        {k > 1.01 && <p className="pointer-events-none absolute inset-x-2 bottom-2 rounded-lg bg-paper/90 px-2 py-1 text-center text-xs font-semibold text-ink-soft">Drag to move the map. Choose Reset map to scroll the page again. Places you have chosen stay chosen, even outside this view.</p>}
      </div>

      <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-ink-muted">{radio ? "Tap an area to choose it, then a dot if you want to name a community." : "Tap an area to choose all of it. Tap a dot to choose just that community."}</p>
        {onSkip && <button type="button" className="inline-flex min-h-[44px] items-center text-sm font-semibold text-navy-light underline" onClick={onSkip}>Skip the map, use the list</button>}
      </div>
      <p className="mt-1 text-[11px] leading-snug text-ink-muted">{MAP_ATTRIBUTION}</p>
    </div>
  );
}

const mapBtn = "grid h-11 min-w-[44px] place-items-center rounded-pill border border-line-strong bg-paper text-xl font-bold text-ink transition hover:bg-sand focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-navy disabled:opacity-40";

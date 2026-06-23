"use client";

import { useEffect, useState } from "react";

const COLORS = ["#10b981", "#059669", "#E0820F", "#F6A723", "#1D4ED8", "#0E8FAC", "#DC2626", "#FFD700", "#7C3AED"];

let injected = false;
function injectKeyframes() {
  if (injected || typeof document === "undefined") return;
  injected = true;
  const s = document.createElement("style");
  s.textContent = `
  @keyframes os-burst { 0%{transform:translate(0,0) rotate(0);opacity:1} 100%{transform:translate(var(--dx),var(--dy)) rotate(var(--rot));opacity:0} }
  @keyframes os-fall { 0%{transform:translateY(-20px) rotate(0);opacity:1} 90%{opacity:1} 100%{transform:translateY(var(--dy)) rotate(var(--rot));opacity:0} }
  @keyframes os-pop { 0%{transform:scale(0.4);opacity:0} 40%{transform:scale(1.15);opacity:1} 100%{transform:scale(1);opacity:1} }
  `;
  document.head.appendChild(s);
}

type Part = { id: number; color: string; size: number; dur: number; delay: number; dx?: number; dy: number; rot: number; left?: number };
function cssVars(p: Part): React.CSSProperties {
  return { ["--dx" as string]: `${p.dx ?? 0}px`, ["--dy" as string]: `${p.dy}px`, ["--rot" as string]: `${p.rot}deg` } as React.CSSProperties;
}

/** Radial confetti burst — re-fires whenever `fireKey` increments. */
export function Burst({ fireKey, count = 22 }: { fireKey: number; count?: number }) {
  const [parts, setParts] = useState<Part[]>([]);
  useEffect(() => {
    if (!fireKey) return;
    injectKeyframes();
    const batch: Part[] = Array.from({ length: count }, (_, i) => {
      const angle = (Math.PI * 2 * i) / count + Math.random() * 0.6;
      const dist = 70 + Math.random() * 150;
      return { id: fireKey * 1000 + i, color: COLORS[i % COLORS.length], size: 6 + Math.random() * 7, dur: 650 + Math.random() * 500, delay: 0, dx: Math.cos(angle) * dist, dy: Math.sin(angle) * dist - 30, rot: Math.random() * 720 - 360 };
    });
    setParts(batch);
    const t = setTimeout(() => setParts([]), 1300);
    return () => clearTimeout(t);
  }, [fireKey, count]);
  if (!parts.length) return null;
  return (
    <div style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 60, overflow: "hidden" }} aria-hidden>
      <div style={{ position: "absolute", left: "50%", top: "40%" }}>
        {parts.map((p) => (
          <span key={p.id} style={{ position: "absolute", width: p.size, height: p.size, background: p.color, borderRadius: 2, animation: `os-burst ${p.dur}ms ease-out forwards`, ...cssVars(p) }} />
        ))}
      </div>
    </div>
  );
}

/** Full-width confetti rain for end celebrations — shows while `show` is true. */
export function Rain({ show, count = 90 }: { show: boolean; count?: number }) {
  const [parts, setParts] = useState<Part[]>([]);
  useEffect(() => {
    if (!show) { setParts([]); return; }
    injectKeyframes();
    const w = typeof window !== "undefined" ? window.innerWidth : 400;
    const h = typeof window !== "undefined" ? window.innerHeight : 700;
    const batch: Part[] = Array.from({ length: count }, (_, i) => ({ id: i, color: COLORS[i % COLORS.length], size: 6 + Math.random() * 7, dur: 1800 + Math.random() * 1400, delay: Math.random() * 800, dy: h + 60, rot: Math.random() * 1080 - 540, left: Math.random() * w }));
    setParts(batch);
    const t = setTimeout(() => setParts([]), 3600);
    return () => clearTimeout(t);
  }, [show, count]);
  if (!parts.length) return null;
  return (
    <div style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 60, overflow: "hidden" }} aria-hidden>
      {parts.map((p) => (
        <span key={p.id} style={{ position: "absolute", top: 0, left: p.left, width: p.size, height: p.size * 0.6, background: p.color, borderRadius: 1, animation: `os-fall ${p.dur}ms ${p.delay}ms cubic-bezier(.3,.6,.5,1) forwards`, ...cssVars(p) }} />
      ))}
    </div>
  );
}

/** A score number that pops when it changes. */
export function PopNumber({ value, className, style }: { value: number; className?: string; style?: React.CSSProperties }) {
  const [animKey, setAnimKey] = useState(0);
  useEffect(() => { injectKeyframes(); setAnimKey((k) => k + 1); }, [value]);
  return <span key={animKey} className={className} style={{ display: "inline-block", animation: "os-pop 300ms ease-out", ...style }}>{value}</span>;
}

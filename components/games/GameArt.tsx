import type { GameId } from "@/lib/games-data";

/** Small flat SVG emblem per game (brand-coloured). */
export function GameArt({ id, size = 56 }: { id: GameId; size?: number }) {
  const common = { width: size, height: size, viewBox: "0 0 100 100", "aria-hidden": true } as const;
  if (id === "spik_sprint") {
    return (
      <svg {...common}><rect width="100" height="100" rx="22" fill="#D1FAE5" /><path d="M54 18 L30 56 H46 L42 82 L70 40 H52 Z" fill="#059669" /></svg>
    );
  }
  if (id === "spik_snap") {
    return (
      <svg {...common}><rect width="100" height="100" rx="22" fill="#FEF3C7" /><rect x="22" y="30" width="38" height="46" rx="6" fill="#E0820F" transform="rotate(-8 41 53)" /><rect x="42" y="26" width="38" height="46" rx="6" fill="#F6A723" transform="rotate(6 61 49)" /></svg>
    );
  }
  if (id === "guess_da_wird") {
    return (
      <svg {...common}><rect width="100" height="100" rx="22" fill="#DBEAFE" />{[[26, 26], [52, 26], [26, 52], [52, 52]].map(([x, y], i) => (<rect key={i} x={x} y={y} width="22" height="22" rx="4" fill={i === 3 ? "#1D4ED8" : "#3B82F6"} />))}<text x="63" y="69" fontSize="16" fontWeight="700" fill="#fff" textAnchor="middle">?</text></svg>
    );
  }
  return (
    <svg {...common}><rect width="100" height="100" rx="22" fill="#CFFAFE" /><circle cx="40" cy="46" r="20" fill="#0E8FAC" opacity="0.5" /><circle cx="64" cy="60" r="12" fill="#0E8FAC" opacity="0.5" /><path d="M62 30 a10 10 0 0 1 10 10 c0 7 -10 18 -10 18 s-10 -11 -10 -18 a10 10 0 0 1 10 -10 Z" fill="#0E8FAC" /><circle cx="62" cy="40" r="3.5" fill="#fff" /></svg>
  );
}

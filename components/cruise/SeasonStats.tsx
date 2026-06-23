import type { SeasonStats } from "@/lib/cruise-stats";
import { CRUISE_ACCENT, fmtDateShort } from "@/lib/cruise-shared";

function monthAbbr(month: string) {
  return new Date(`${month}-01T12:00:00Z`).toLocaleDateString("en-GB", { month: "short" });
}

/** The six headline season metrics, as a responsive tile band. */
export function SeasonStatTiles({ stats: s }: { stats: SeasonStats }) {
  const tiles: { label: string; value: string; sub?: string }[] = [
    { label: "Ship calls", value: s.totalCalls.toLocaleString() },
    { label: "Passengers", value: s.totalPax.toLocaleString(), sub: "this season" },
    { label: "Different ships", value: s.distinctShips.toLocaleString() },
    { label: "Peak days", value: s.peakDays.toLocaleString() },
    ...(s.biggestShip ? [{ label: "Biggest ship", value: `${s.biggestShip.length_m} m`, sub: s.biggestShip.name }] : []),
    ...(s.busiestDay ? [{ label: "Busiest day", value: `~${s.busiestDay.pax.toLocaleString()}`, sub: fmtDateShort(s.busiestDay.date) }] : []),
  ];
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
      {tiles.map((t) => (
        <div key={t.label} className="rounded-xl bg-sand/60 p-4">
          <div className="text-[13px] text-ink-muted">{t.label}</div>
          <div className="mt-1 font-display text-2xl font-bold text-ink">{t.value}</div>
          {t.sub && <div className="truncate text-xs text-ink-faint">{t.sub}</div>}
        </div>
      ))}
    </div>
  );
}

/** Passengers-by-month bar chart. */
export function SeasonMonthChart({ stats: s }: { stats: SeasonStats }) {
  const maxPax = Math.max(1, ...s.byMonth.map((m) => m.pax));
  return (
    <div className="rounded-2xl border border-line bg-paper p-5 shadow-soft">
      <div className="mb-4 text-sm font-semibold text-ink-soft">Passengers by month</div>
      <div className="flex items-end gap-2 sm:gap-3" style={{ height: 170 }}>
        {s.byMonth.map((m) => {
          const h = Math.round((m.pax / maxPax) * 140);
          return (
            <div key={m.month} className="flex flex-1 flex-col items-center justify-end gap-1.5">
              <span className="text-[11px] font-bold text-ink-soft">{m.pax >= 1000 ? `${(m.pax / 1000).toFixed(0)}k` : m.pax}</span>
              <div className="w-full rounded-t-md" style={{ height: Math.max(4, h), background: CRUISE_ACCENT, opacity: 0.85 }} title={`${m.calls} calls · ${m.pax.toLocaleString()} passengers`} />
              <span className="text-[11px] text-ink-muted">{monthAbbr(m.month)}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

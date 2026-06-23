import { londonHours, fmtTime, CRUISE_ACCENT } from "@/lib/cruise-shared";
import type { CruiseVisit } from "@/lib/cruise-data";

/** Horizontal in-port windows for each ship across the day. */
export function DayTimeline({ visits }: { visits: CruiseVisit[] }) {
  const rows = visits
    .map((v) => {
      const a = londonHours(v.arrival_at);
      let d = londonHours(v.departure_at);
      if (a == null) return null;
      if (d == null || d <= a) d = Math.min(24, a + 6); // crosses midnight / unknown → cap
      return { v, a, d };
    })
    .filter(Boolean) as { v: CruiseVisit; a: number; d: number }[];
  if (rows.length === 0) return null;

  const start = Math.max(0, Math.floor(Math.min(...rows.map((r) => r.a))) - 1);
  const end = Math.min(24, Math.ceil(Math.max(...rows.map((r) => r.d))) + 1);
  const span = Math.max(1, end - start);
  const step = span > 12 ? 3 : 2;
  const ticks: number[] = [];
  for (let h = Math.ceil(start / step) * step; h <= end; h += step) ticks.push(h);

  return (
    <div className="rounded-2xl border border-line bg-paper p-5 shadow-soft">
      <div className="mb-4 text-sm font-semibold text-ink-soft">When they&apos;re in port</div>
      <div className="space-y-2.5">
        {rows.map(({ v, a, d }) => (
          <div key={v.id} className="flex items-center gap-3">
            <span className="w-24 shrink-0 truncate text-sm font-medium text-ink">{v.ship?.name ?? v.ship_name_cache ?? "Ship"}</span>
            <div className="relative h-7 flex-1 rounded-md bg-sand/60">
              <div
                className="absolute top-0 flex h-7 items-center overflow-hidden rounded-md px-2"
                style={{ left: `${((a - start) / span) * 100}%`, width: `${Math.max(8, ((d - a) / span) * 100)}%`, background: CRUISE_ACCENT }}
              >
                <span className="truncate text-[11px] font-semibold text-paper">{fmtTime(v.arrival_at)}–{fmtTime(v.departure_at)}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
      <div className="mt-2 flex justify-between pl-[6.75rem] text-[10px] text-ink-faint">
        {ticks.map((h) => <span key={h}>{String(h % 24).padStart(2, "0")}:00</span>)}
      </div>
    </div>
  );
}

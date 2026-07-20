import Link from "next/link";
import { baro, fmtDateShort, fmtTime } from "@/lib/cruise-shared";
import { shipImageUrl } from "@/lib/cruise-ship-images";
import type { ScopeData, CruiseHomeCard } from "@/lib/cruise-data";
import { SeasonMap } from "@/components/cruise/SeasonMap";

function datesBetween(from: string, to: string): string[] {
  const out: string[] = [];
  let cur = from;
  for (let i = 0; i < 60 && cur <= to; i++) {
    out.push(cur);
    const d = new Date(`${cur}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + 1);
    cur = d.toISOString().slice(0, 10);
  }
  return out;
}

export function ScopeView({
  label,
  from,
  to,
  data,
  nextCard,
  today,
}: {
  label: string;
  from: string;
  to: string;
  data: ScopeData;
  nextCard: CruiseHomeCard | null;
  today: string;
}) {
  const { stats, daysByDate, visits, origins } = data;
  const multiday = from !== to;

  const tiles = multiday
    ? [
        { l: "Ship calls", v: String(stats.calls) },
        { l: "Passengers", v: stats.pax.toLocaleString() },
        { l: "Different ships", v: String(stats.distinctShips) },
        ...(stats.busiestDay ? [{ l: "Busiest day", v: `~${stats.busiestDay.pax.toLocaleString()}`, sub: fmtDateShort(stats.busiestDay.date) }] : []),
      ]
    : [
        { l: "Ships in port", v: String(stats.calls) },
        { l: "Passengers", v: stats.pax.toLocaleString() },
        ...(stats.firstIn ? [{ l: "First in", v: fmtTime(stats.firstIn) }] : []),
        ...(stats.lastOut ? [{ l: "Last out", v: fmtTime(stats.lastOut) }] : []),
      ];

  // Group visits by date for the listing.
  const byDate: Record<string, typeof visits> = {};
  for (const v of visits) {
    const k = v.visit_date ?? "";
    (byDate[k] ??= []).push(v);
  }
  const orderedDates = Object.keys(byDate).sort();

  return (
    <div className="space-y-10">
      <div>
        <h2 className="mb-4 font-display text-2xl font-bold text-ink">{label} in Lerwick</h2>
        {visits.length === 0 ? (
          <div className="rounded-2xl border border-line bg-paper p-8 text-center shadow-soft">
            <p className="text-ink-soft">No cruise ships in port {label.toLowerCase()}.</p>
            {nextCard && (
              <Link href={`/cruise/${nextCard.date}`} className="mt-3 inline-block rounded-pill bg-navy px-4 py-2 text-sm font-bold text-paper">
                Next call · {fmtDateShort(nextCard.date)}
              </Link>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {tiles.map((t) => (
              <div key={t.l} className="rounded-2xl border border-line bg-sand/40 p-4">
                <div className="text-sm text-ink-muted">{t.l}</div>
                <div className="mt-0.5 font-display text-2xl font-bold text-ink sm:text-3xl">{t.v}</div>
                {"sub" in t && t.sub ? <div className="text-xs text-ink-faint">{t.sub}</div> : null}
              </div>
            ))}
          </div>
        )}
      </div>

      {visits.length > 0 && (
        <>
          {/* Day strip (multi-day windows only) */}
          {multiday && (
            <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
              {datesBetween(from, to).map((date) => {
                const day = daysByDate[date];
                const b = day ? baro(day.barometer) : null;
                const inner = (
                  <>
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-ink">{fmtDateShort(date)}</span>
                      {date === today && <span className="rounded-pill bg-navy px-2 py-0.5 text-[10px] font-bold text-paper">TODAY</span>}
                    </div>
                    {day ? (
                      <div className="mt-1 flex items-center justify-between">
                        <span className="text-sm text-ink-muted">
                          {day.ships_count} {day.ships_count === 1 ? "ship" : "ships"}
                          {day.total_est_pax ? ` · ~${day.total_est_pax.toLocaleString()}` : ""}
                        </span>
                        <span className="rounded-pill px-2.5 py-0.5 text-xs font-bold" style={{ background: b!.tint, color: b!.color }}>{b!.label}</span>
                      </div>
                    ) : (
                      <div className="mt-1 text-sm text-ink-faint">No ships</div>
                    )}
                  </>
                );
                return day ? (
                  <Link key={date} href={`/cruise/${date}`} className="rounded-xl border border-line bg-paper p-3 shadow-soft transition-colors hover:bg-sand/40">{inner}</Link>
                ) : (
                  <div key={date} className="rounded-xl border border-line bg-sand/30 p-3">{inner}</div>
                );
              })}
            </div>
          )}

          {/* Per-ship listing */}
          <div>
            <h3 className="mb-4 font-display text-xl font-bold text-ink">In port</h3>
            <div className="space-y-5">
              {orderedDates.map((date) => (
                <div key={date}>
                  {multiday && <div className="mb-2 text-sm font-semibold text-ink-muted">{fmtDateShort(date)}</div>}
                  <ul className="space-y-2.5">
                    {byDate[date].map((v) => {
                      const b = baro(daysByDate[date]?.barometer);
                      const name = v.ship?.name ?? v.ship_name_cache ?? "Cruise ship";
                      return (
                        <li key={v.id}>
                          <Link href={`/cruise/visit/${v.id}`} className="flex items-center gap-3 rounded-xl border border-line bg-paper p-2.5 shadow-soft transition-colors hover:bg-sand/40">
                            {shipImageUrl(v.ship) ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={shipImageUrl(v.ship)!} alt={name} className="h-14 w-14 shrink-0 rounded-lg object-cover" />
                            ) : (
                              <span className="grid h-14 w-14 shrink-0 place-items-center rounded-lg text-lg" style={{ background: b.tint, color: b.color }}>⚓</span>
                            )}
                            <div className="min-w-0 flex-1">
                              <div className="font-semibold text-ink">{name}</div>
                              <div className="text-sm text-ink-muted">
                                {fmtTime(v.arrival_at)}–{fmtTime(v.departure_at)}
                                {v.est_pax ? ` · ~${v.est_pax.toLocaleString()} pax` : ""}
                                {v.berth_area_group ? ` · ${v.berth_area_group}` : ""}
                              </div>
                            </div>
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))}
            </div>
          </div>

          {/* Map */}
          {origins.length > 0 && (
            <div>
              <h3 className="mb-1 font-display text-xl font-bold text-ink">Where they sail from</h3>
              <p className="mb-4 text-ink-muted">The ports these ships sailed from before calling at Lerwick.</p>
              <SeasonMap origins={origins} />
            </div>
          )}
        </>
      )}
    </div>
  );
}

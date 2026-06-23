import Link from "next/link";
import Image from "next/image";
import { getMonthDays, getUpcomingDaysRich, getSeasonBounds, getScopeData, getScopeAvailability, getCruiseHomeCard } from "@/lib/cruise-data";
import { baro, BAROMETER, CRUISE_ACCENT, CRUISE_HERO, fmtDateShort, scopeRange, type CruiseScope } from "@/lib/cruise-shared";
import { CruiseTodayCard } from "@/components/cruise/CruiseTodayCard";
import { SeasonStatTiles, SeasonMonthChart } from "@/components/cruise/SeasonStats";
import { SeasonMap } from "@/components/cruise/SeasonMap";
import { ScopePills } from "@/components/cruise/ScopePills";
import { ScopeView } from "@/components/cruise/ScopeView";
import { getSeasonStats, getSeasonOrigins } from "@/lib/cruise-stats";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Cruise ships in Lerwick",
  description:
    "Every cruise ship visiting Lerwick, Shetland — arrival and departure times, passenger numbers, and how busy town will be with the OneShetland Barometer.",
};

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function monthLabel(month: string) {
  return new Date(`${month}-01T12:00:00Z`).toLocaleDateString("en-GB", { month: "long", year: "numeric" });
}
function shiftMonth(month: string, by: number) {
  const d = new Date(`${month}-01T00:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() + by);
  return d.toISOString().slice(0, 7);
}

export default async function CruisePage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string; scope?: string }>;
}) {
  const { month: monthParam, scope: scopeParam } = await searchParams;
  const today = new Date().toISOString().slice(0, 10);
  const scope: CruiseScope = (["today", "weekend", "week"].includes(scopeParam ?? "") ? scopeParam : "season") as CruiseScope;
  const range = scope === "season" ? null : scopeRange(scope, today);
  const available = await getScopeAvailability(today);

  // ── Focused window (Today / Weekend / Next 7 days) ──
  if (range) {
    const [data, nextCard] = await Promise.all([getScopeData(range.from, range.to), getCruiseHomeCard()]);
    return (
      <>
        <Hero />
        <div className="mx-auto max-w-6xl px-5 py-10 sm:py-12">
          <div className="mb-8"><ScopePills active={scope} available={available} /></div>
          <ScopeView label={range.label} from={range.from} to={range.to} data={data} nextCard={nextCard} today={today} />
        </div>
      </>
    );
  }

  const bounds = await getSeasonBounds();
  const fallbackMonth = bounds.first ? bounds.first.slice(0, 7) : new Date().toISOString().slice(0, 7);
  const month = /^\d{4}-\d{2}$/.test(monthParam ?? "") ? (monthParam as string) : (new Date().toISOString().slice(0, 7) >= fallbackMonth ? new Date().toISOString().slice(0, 7) : fallbackMonth);

  const [days, upcoming, seasonStats, origins] = await Promise.all([getMonthDays(month), getUpcomingDaysRich(12), getSeasonStats(), getSeasonOrigins()]);

  // Build the month grid (Mon-first).
  const first = new Date(`${month}-01T00:00:00Z`);
  const daysInMonth = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0)).getUTCDate();
  const offset = (first.getUTCDay() + 6) % 7; // Mon=0
  const cells: (string | null)[] = [];
  for (let i = 0; i < offset; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(`${month}-${String(d).padStart(2, "0")}`);

  const prev = shiftMonth(month, -1);
  const next = shiftMonth(month, 1);
  const minMonth = bounds.first?.slice(0, 7);
  const maxMonth = bounds.last?.slice(0, 7);

  return (
    <>
      <Hero />

      <div className="mx-auto max-w-6xl px-5 py-10 sm:py-12">
        <div className="mb-8"><ScopePills active="season" available={available} /></div>
        <CruiseTodayCard className="mb-8" />
        {seasonStats && (
          <div className="mb-8">
            <SeasonStatTiles stats={seasonStats} />
          </div>
        )}
        <div className="grid items-start gap-8 lg:grid-cols-[1.15fr_0.85fr]">
          {/* Left: calendar + season chart */}
          <div className="space-y-8">
          {/* Calendar */}
          <section>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-display text-2xl font-bold text-ink">{monthLabel(month)}</h2>
              <div className="flex gap-2">
                <MonthLink to={prev} disabled={!!minMonth && prev < minMonth} label="Previous month">‹</MonthLink>
                <MonthLink to={next} disabled={!!maxMonth && next > maxMonth} label="Next month">›</MonthLink>
              </div>
            </div>

            <div className="rounded-2xl border border-line bg-paper p-3 shadow-soft sm:p-4">
              <div className="mb-1.5 grid grid-cols-7 gap-1.5 text-center text-[11px] font-medium text-ink-faint">
                {WEEKDAYS.map((w) => <div key={w}>{w}</div>)}
              </div>
              <div className="grid grid-cols-7 gap-1.5">
                {cells.map((date, i) => {
                  if (!date) return <div key={`b${i}`} />;
                  const day = days[date];
                  const dnum = Number(date.slice(8));
                  if (!day) {
                    return (
                      <div key={date} className="min-h-[44px] rounded-lg bg-sand/50 p-1.5 sm:min-h-[56px]">
                        <span className="text-xs text-ink-faint">{dnum}</span>
                      </div>
                    );
                  }
                  const b = baro(day.barometer);
                  return (
                    <Link
                      key={date}
                      href={`/cruise/${date}`}
                      className="group min-h-[44px] rounded-lg p-1.5 transition-transform hover:-translate-y-0.5 sm:min-h-[56px]"
                      style={{ background: b.tint }}
                    >
                      <span className="text-xs font-bold text-ink">{dnum}</span>
                      <span className="mt-0.5 block text-[10px] font-bold leading-tight" style={{ color: b.color }}>
                        {day.total_est_pax >= 1000 ? `${(day.total_est_pax / 1000).toFixed(1)}k` : day.total_est_pax || day.ships_count}
                        <span className="font-medium"> {day.total_est_pax ? "pax" : "ship"}</span>
                      </span>
                    </Link>
                  );
                })}
              </div>
            </div>
            <p className="mt-3 text-sm text-ink-muted">Coloured days have ships in port — tap one for who&apos;s in and the heads‑up.</p>
          </section>
            {origins.length > 0 && (
              <section>
                <h2 className="mb-1 font-display text-2xl font-bold text-ink">Where ships sail from</h2>
                <p className="mb-4 text-ink-muted">Every cruise that calls at Lerwick this season, by the port it sailed from.</p>
                <SeasonMap origins={origins} />
              </section>
            )}
            {seasonStats && <SeasonMonthChart stats={seasonStats} />}
          </div>

          {/* Upcoming list */}
          <section>
            <h2 className="mb-4 font-display text-2xl font-bold text-ink">Coming up</h2>
            {upcoming.length === 0 ? (
              <div className="rounded-xl border border-line bg-paper p-8 text-center text-ink-soft shadow-soft">
                No upcoming cruise calls listed just now.
              </div>
            ) : (
              <ul className="space-y-2.5">
                {upcoming.map((d) => {
                  const b = baro(d.barometer);
                  return (
                    <li key={d.visit_date}>
                      <Link
                        href={`/cruise/${d.visit_date}`}
                        className="flex items-center gap-3 rounded-xl border border-line bg-paper p-2.5 shadow-soft transition-colors hover:bg-sand/40"
                      >
                        {d.lead_image ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={d.lead_image} alt="" className="h-14 w-14 shrink-0 rounded-lg object-cover" style={{ outline: `2px solid ${b.color}33`, outlineOffset: -2 }} />
                        ) : (
                          <span className="grid h-14 w-14 shrink-0 place-items-center rounded-lg text-lg" style={{ background: b.tint, color: b.color }}>⚓</span>
                        )}
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-ink">{fmtDateShort(d.visit_date)}</span>
                            {d.visit_date === today && (
                              <span className="rounded-pill bg-navy px-2 py-0.5 text-[10px] font-bold text-paper">TODAY</span>
                            )}
                          </div>
                          <div className="text-sm text-ink-muted">
                            {d.ships_count} {d.ships_count === 1 ? "ship" : "ships"}
                            {d.total_est_pax ? ` · ~${d.total_est_pax.toLocaleString()} passengers` : ""}
                          </div>
                        </div>
                        <span className="shrink-0 rounded-pill px-2.5 py-1 text-xs font-bold" style={{ background: b.tint, color: b.color }}>
                          {b.label}
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </div>
      </div>
    </>
  );
}

function Hero() {
  return (
    <section className="relative isolate overflow-hidden text-paper" style={{ background: CRUISE_ACCENT }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={CRUISE_HERO} alt="" className="absolute inset-0 h-full w-full object-cover opacity-30" />
      <div className="absolute inset-0" style={{ background: `linear-gradient(to top, ${CRUISE_ACCENT}f2, ${CRUISE_ACCENT}cc 55%, ${CRUISE_ACCENT}99)` }} />
      <div className="relative mx-auto max-w-6xl px-5 py-12 sm:py-16">
        <p className="eyebrow text-paper/85">OneShetland</p>
        <h1 className="mt-2 font-display text-4xl font-bold leading-none sm:text-6xl">Cruise ships in Lerwick</h1>
        <p className="mt-4 max-w-2xl text-base text-paper/90 sm:text-lg">
          Every ship visiting the port — times, passengers, and how busy town will be. The Barometer tells you at a glance.
        </p>
        <div className="mt-6 flex flex-wrap gap-x-5 gap-y-2 text-sm text-paper/90">
          {(["quiet", "busy", "very_busy", "peak"] as const).map((k) => (
            <span key={k} className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: BAROMETER[k].color }} />
              {BAROMETER[k].label}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}

function MonthLink({ to, disabled, label, children }: { to: string; disabled: boolean; label: string; children: React.ReactNode }) {
  if (disabled) {
    return <span className="grid h-9 w-9 place-items-center rounded-pill border border-line text-ink-faint">{children}</span>;
  }
  return (
    <Link href={`/cruise?month=${to}`} aria-label={label} className="grid h-9 w-9 place-items-center rounded-pill border border-line-strong text-ink transition-colors hover:bg-sand">
      {children}
    </Link>
  );
}

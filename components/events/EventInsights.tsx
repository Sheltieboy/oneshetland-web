/**
 * EventInsights.tsx — What's On differentiators (server components, no client JS):
 *   • ScarcityStrip     — honest "selling fast" badge + sold bar + "only N left"
 *   • GoingCount        — social proof "N going"
 *   • GettingTherePanel — Shetland context: last ferry, weather at showtime, daylight
 *
 * Parity with the app at oneshetland-delivers/components/events/EventInsights.tsx.
 */
import { describeWeather, type EventConditions } from "@/lib/shetland-today";
import { FERRY_MORE_INFO } from "@/lib/ferry-timetable";
import type { EventScarcity } from "@/lib/events-data";
import type { WaysHome } from "@/lib/transit-data";

export function ScarcityStrip({ scarcity, bookedRecent }: { scarcity: EventScarcity; bookedRecent: number }) {
  if (!scarcity.measurable || scarcity.soldOut) return null;
  const showRecent = bookedRecent >= 5;
  if (!scarcity.sellingFast && !scarcity.almostGone && !showRecent) return null;

  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
      <div className="flex items-center justify-between gap-3">
        <span className="inline-flex items-center gap-1.5 text-sm font-bold text-amber-800">
          <span aria-hidden>🔥</span>
          {scarcity.almostGone ? "Almost gone" : "Selling fast"}
        </span>
        <span className="text-sm font-semibold text-amber-800">
          {scarcity.remaining <= 20 ? `Only ${scarcity.remaining} left` : `${scarcity.pctSold}% gone`}
        </span>
      </div>
      <div className="mt-2.5 h-1.5 w-full overflow-hidden rounded-full bg-amber-200" role="presentation">
        <div className="h-full rounded-full" style={{ width: `${scarcity.pctSold}%`, background: "#BA7517" }} />
      </div>
      {showRecent && (
        <p className="mt-2 text-xs font-medium text-amber-800">
          {bookedRecent} booked in the last 24 hours
        </p>
      )}
    </div>
  );
}

export function GoingCount({ count }: { count: number }) {
  if (count < 3) return null;
  return (
    <span className="inline-flex items-center gap-1.5 rounded-pill bg-sand/70 px-3 py-1.5 text-sm font-semibold text-ink">
      <span aria-hidden>👥</span>
      {count} going
    </span>
  );
}

export function GettingTherePanel({
  conditions,
  eventTime,
}: {
  conditions: EventConditions;
  eventTime: string;
}) {
  const wx = describeWeather(conditions.weatherCode);
  const hasWeather = conditions.withinForecast && conditions.tempC !== null;
  const hasDaylight = conditions.daylight !== "—";
  if (!hasWeather && !hasDaylight) return null;

  return (
    <section className="mt-10">
      <h2 className="font-display text-2xl font-bold">Conditions</h2>
      <div className="mt-5 overflow-hidden rounded-xl border border-line bg-paper shadow-soft">
        <div className="grid gap-px bg-line sm:grid-cols-2">
          {hasWeather && (
            <Cell label={`Forecast, ${eventTime}`}>
              {conditions.tempC}°C · {wx.label}
            </Cell>
          )}
          {hasDaylight && (
            <Cell label="Daylight">
              {conditions.simmerDim ? "Simmer dim — light till late" : `${conditions.sunrise}–${conditions.sunset}`}
              <span className="block text-xs text-ink-muted">{conditions.daylight} of daylight</span>
            </Cell>
          )}
        </div>
        <p className="border-t border-line bg-sand/40 px-4 py-2.5 text-xs text-ink-muted">
          Weather from Open-Meteo. Conditions can change — check before you travel.
        </p>
      </div>
    </section>
  );
}

export function GettingHome({ ways }: { ways: WaysHome | null }) {
  if (!ways || ways.options.length === 0) return null;
  return (
    <section className="mt-10">
      <h2 className="font-display text-2xl font-bold">Getting home</h2>
      <p className="mt-1 text-sm text-ink-muted">
        {ways.mode === "to-hub"
          ? "Last way to Lerwick by public transport on this event day."
          : "Last way home by public transport on this event day."}
      </p>
      <ul className="mt-4 space-y-2.5">
        {ways.options.map((o) => {
          const arrive = o.journey.legs[o.journey.legs.length - 1].arrive;
          return (
            <li key={o.area} className="rounded-xl border border-line bg-paper p-4 shadow-soft">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-semibold text-ink">{o.label}</p>
                <div className="flex flex-wrap items-center gap-1.5">
                  {o.journey.needsBooking && (
                    <span className="rounded-pill bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-800">Ferry needs booking</span>
                  )}
                  {o.leavesBeforeEnd && (
                    <span className="rounded-pill bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-800">⚠ Before event ends</span>
                  )}
                </div>
              </div>
              <div className="mt-1.5 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-sm text-ink-soft">
                {o.journey.legs.map((leg, i) => (
                  <span key={i} className="inline-flex items-center gap-1">
                    {i > 0 && <span aria-hidden className="text-ink-muted">→</span>}
                    <span aria-hidden>{leg.mode === "ferry" ? "⛴" : "🚌"}</span>
                    <span className="font-mono text-xs text-ink-muted">{leg.depart}</span>
                    <span>{leg.service}</span>
                  </span>
                ))}
                <span className="text-ink-muted">→ arrives {arrive}</span>
              </div>
            </li>
          );
        })}
      </ul>
      <p className="mt-3 text-xs text-ink-muted">
        Timetabled connections — no live feed yet. Times can change; check before you travel. {FERRY_MORE_INFO}
      </p>
    </section>
  );
}

function Cell({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="bg-paper p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">{label}</p>
      <p className="mt-1 font-medium text-ink">{children}</p>
    </div>
  );
}

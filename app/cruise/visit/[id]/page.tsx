import Link from "next/link";
import { notFound } from "next/navigation";
import { getCruiseVisit, getDaySummary } from "@/lib/cruise-data";
import { baro, fmtTime, fmtDateLong, fmtDateShort, hoursAshore, ashorePlan, trackUrl, CRUISE_ACCENT } from "@/lib/cruise-shared";
import { RouteMap } from "@/components/cruise/RouteMap";
import { routePoints, getShipOtherCalls } from "@/lib/cruise-stats";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const v = await getCruiseVisit(id);
  if (!v) return { title: "Cruise ship" };
  const name = v.ship?.name ?? v.ship_name_cache ?? "Cruise ship";
  const when = v.visit_date ? fmtDateLong(v.visit_date) : "";
  return {
    title: `${name} in Lerwick${when ? ` — ${when}` : ""}`,
    description: `${name} visits Lerwick, Shetland${when ? ` on ${when}` : ""}. Arrival and departure times, passengers, berth and what to do ashore.`,
    openGraph: v.ship?.image_url ? { images: [{ url: v.ship.image_url }] } : undefined,
  };
}

export default async function CruiseVisitPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const v = await getCruiseVisit(id);
  if (!v) notFound();

  const name = v.ship?.name ?? v.ship_name_cache ?? "Cruise ship";
  const day = v.visit_date ? await getDaySummary(v.visit_date) : null;
  const points = routePoints(v.from_location, v.to_location);
  const otherCalls = v.ship_id ? await getShipOtherCalls(v.ship_id, v.id) : [];
  const b = baro(day?.barometer);
  const hrs = hoursAshore(v);
  const inPort = v.status === "in_port";

  const facts = [
    v.ship?.vessel_type ? cap(v.ship.vessel_type) : null,
    v.ship?.length_label,
    v.est_pax ? `~${v.est_pax.toLocaleString()} passengers` : v.est_pax_label,
    v.berth || v.berth_area_group,
  ].filter(Boolean).join(" · ");

  return (
    <div className="mx-auto max-w-3xl px-5 py-8 sm:py-10">
      {v.visit_date && (
        <Link href={`/cruise/${v.visit_date}`} className="text-sm font-semibold" style={{ color: CRUISE_ACCENT }}>
          ← {fmtDateLong(v.visit_date)}
        </Link>
      )}

      {/* Photo */}
      <div className="relative mt-3 aspect-[16/9] overflow-hidden rounded-2xl border border-line bg-sand shadow-soft">
        {v.ship?.image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={v.ship.image_url} alt={name} className="h-full w-full object-cover" />
        ) : (
          <div className="grid h-full w-full place-items-center text-5xl text-ink-faint">⚓</div>
        )}
        <span
          className="absolute right-3 top-3 rounded-pill px-3 py-1 text-xs font-semibold text-paper"
          style={{ background: inPort ? "rgba(26,143,122,0.95)" : "rgba(3,47,76,0.85)" }}
        >
          {inPort ? "Alongside now" : cap(v.status)}
        </span>
      </div>

      <h1 className="mt-4 font-display text-3xl font-bold text-ink sm:text-4xl">{name}</h1>
      {facts && <p className="mt-1 text-ink-muted">{facts}</p>}

      {/* Arrival / departure / hours + Barometer */}
      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl border border-line bg-paper p-4 shadow-soft">
          <Row label="Arrives" value={`${fmtTime(v.arrival_at)}${v.from_location ? ` · from ${v.from_location}` : ""}`} />
          <Row label="Departs" value={`${fmtTime(v.departure_at)}${v.to_location ? ` · to ${v.to_location}` : ""}`} />
          {hrs ? <Row label="Ashore" value={`~${hrs} hours`} /> : null}
        </div>
        {day && (
          <div className="flex items-center gap-3 rounded-xl border border-line bg-paper p-4 shadow-soft" style={{ borderLeft: `5px solid ${b.color}` }}>
            <span className="h-3 w-3 rounded-full" style={{ background: b.color }} />
            <div>
              <div className="font-display text-lg font-bold text-ink">{b.label} in town</div>
              <div className="text-sm text-ink-muted">
                {day.ships_count} {day.ships_count === 1 ? "ship" : "ships"}{day.total_est_pax ? ` · ~${day.total_est_pax.toLocaleString()} ashore` : ""}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Your day ashore */}
      <div className="mt-5 rounded-2xl border border-line bg-paper p-5 shadow-soft">
        <h2 className="font-display text-xl font-bold text-ink">Your day ashore</h2>
        <p className="mt-2 text-ink-soft">{ashorePlan(hrs)}</p>
        <p className="mt-3 text-sm text-ink-muted">
          Toilets, Wi‑Fi, ATMs and taxis are all in the town centre, a short walk from the berth.
          {hrs ? <> Aim to be back on board about <strong className="text-ink">30 minutes</strong> before departure.</> : null}
        </p>
      </div>

      {/* Voyage map */}
      {points.length >= 2 && (
        <div className="mt-5">
          <h2 className="mb-2 font-display text-xl font-bold text-ink">Voyage</h2>
          <RouteMap points={points} />
          <p className="mt-2 text-sm text-ink-muted">
            {v.from_location ? `${v.from_location} → ` : ""}Lerwick{v.to_location ? ` → ${v.to_location}` : ""}
          </p>
        </div>
      )}

      {/* Other calls this season */}
      {otherCalls.length > 0 && (
        <div className="mt-5 rounded-2xl border border-line bg-paper p-5 shadow-soft">
          <h2 className="mb-3 font-display text-lg font-bold text-ink">{name} — other calls this season</h2>
          <div className="flex flex-wrap gap-2">
            {otherCalls.map((c) => (
              <Link key={c.id} href={`/cruise/visit/${c.id}`} className="rounded-pill border border-line px-3 py-1.5 text-sm text-ink transition-colors hover:bg-sand">
                {c.visit_date ? fmtDateShort(c.visit_date) : "—"}
                {c.est_pax ? <span className="text-ink-faint"> · ~{c.est_pax.toLocaleString()}</span> : null}
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="mt-5 flex flex-wrap gap-2.5">
        <a href={trackUrl(v.ship)} target="_blank" rel="noopener noreferrer" className="rounded-pill px-5 py-2.5 text-sm font-semibold text-paper" style={{ background: CRUISE_ACCENT }}>
          Track live ↗
        </a>
        <Link href="/local" className="rounded-pill border border-line-strong px-5 py-2.5 text-sm font-semibold text-ink transition-colors hover:bg-sand">
          What&apos;s open today
        </Link>
        <Link href="/whats-on" className="rounded-pill border border-line-strong px-5 py-2.5 text-sm font-semibold text-ink transition-colors hover:bg-sand">
          Tours &amp; tickets
        </Link>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-3 py-1.5 text-sm">
      <span className="w-16 shrink-0 text-ink-faint">{label}</span>
      <span className="text-ink">{value}</span>
    </div>
  );
}
function cap(s: string) { return s.charAt(0).toUpperCase() + s.slice(1); }

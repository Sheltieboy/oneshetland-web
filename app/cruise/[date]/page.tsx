import Link from "next/link";
import { getCruiseDay } from "@/lib/cruise-data";
import { baro, fmtTime, fmtDateLong, hoursAshore, peakWindow, CRUISE_ACCENT } from "@/lib/cruise-shared";
import { DayTimeline } from "@/components/cruise/DayTimeline";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ date: string }> }) {
  const { date } = await params;
  return { title: `Cruise ships — ${fmtDateLong(date)}` };
}

const STATUS: Record<string, { label: string; color: string }> = {
  scheduled: { label: "Scheduled", color: "#6b7280" },
  confirmed: { label: "Confirmed", color: "#6b7280" },
  in_port: { label: "In port", color: "#1a8f7a" },
  departed: { label: "Departed", color: "#9aa3ad" },
  completed: { label: "Departed", color: "#9aa3ad" },
};

export default async function CruiseDayPage({ params }: { params: Promise<{ date: string }> }) {
  const { date } = await params;
  const { summary, visits } = await getCruiseDay(date);
  const b = baro(summary?.barometer);
  const busy = summary && (summary.barometer === "busy" || summary.barometer === "very_busy" || summary.barometer === "peak");
  const arrSorted = (visits.map((v) => v.arrival_at).filter(Boolean) as string[]).sort();
  const depSorted = (visits.map((v) => v.departure_at).filter(Boolean) as string[]).sort();
  const firstIn = arrSorted[0] ? fmtTime(arrSorted[0]) : null;
  const lastOut = depSorted.length ? fmtTime(depSorted[depSorted.length - 1]) : null;
  const berths = [...new Set(visits.map((v) => v.berth_area_group).filter(Boolean))] as string[];
  const anyTender = visits.some((v) => v.is_tender);
  const peak = busy ? peakWindow(visits) : null;

  return (
    <div className="mx-auto max-w-4xl px-5 py-8 sm:py-10">
      <Link href="/cruise" className="text-sm font-semibold" style={{ color: CRUISE_ACCENT }}>← Cruise calendar</Link>

      <h1 className="mt-3 font-display text-3xl font-bold text-ink sm:text-4xl">{fmtDateLong(date)}</h1>

      {/* Barometer banner */}
      <div className="mt-4 flex items-center gap-3 rounded-2xl border border-line bg-paper p-4 shadow-soft" style={{ borderLeft: `5px solid ${b.color}` }}>
        <span className="h-3 w-3 shrink-0 rounded-full" style={{ background: b.color }} />
        <div className="min-w-0">
          <div className="font-display text-xl font-bold text-ink">
            {b.label}
            {summary ? <span className="font-body text-base font-normal text-ink-muted"> · {summary.ships_count} {summary.ships_count === 1 ? "ship" : "ships"} in port</span> : null}
          </div>
          {summary?.total_est_pax ? (
            <div className="text-sm text-ink-muted">around {summary.total_est_pax.toLocaleString()} passengers ashore</div>
          ) : null}
        </div>
      </div>

      {busy && (
        <div className="mt-3 rounded-xl bg-sand/60 px-4 py-3 text-sm text-ink-soft">
          <p className="font-semibold text-ink">
            Plan for extra footfall{peak ? ` ~${peak.label}` : " through the day"}
          </p>
          <p className="mt-0.5">
            Town and the waterfront will be busy with visitors — worth having extra hands on, more stock out, and the kettle on.
            {berths.length > 0 ? ` Ships berth at ${berths.join(" and ")}.` : ""}
            {anyTender ? " Some come ashore by tender, so folk arrive in waves." : ""}
          </p>
        </div>
      )}

      {/* Day stats + timeline */}
      {visits.length > 0 && (
        <>
          <div className="mt-4 flex flex-wrap gap-2 text-sm">
            {firstIn && <span className="rounded-pill bg-sand px-3 py-1 text-ink-soft">First in {firstIn}</span>}
            {lastOut && <span className="rounded-pill bg-sand px-3 py-1 text-ink-soft">Last out {lastOut}</span>}
            {berths.length > 0 && <span className="rounded-pill bg-sand px-3 py-1 text-ink-soft">Berths: {berths.join(", ")}</span>}
          </div>
          <div className="mt-5">
            <DayTimeline visits={visits} />
          </div>
        </>
      )}

      {/* Ships */}
      <h2 className="mb-3 mt-8 font-display text-xl font-bold text-ink">In port</h2>
      {visits.length === 0 ? (
        <div className="rounded-xl border border-line bg-paper p-8 text-center text-ink-soft shadow-soft">No ships listed for this day.</div>
      ) : (
        <ul className="space-y-3">
          {visits.map((v) => {
            const name = v.ship?.name ?? v.ship_name_cache ?? "Ship";
            const st = STATUS[v.status] ?? STATUS.scheduled;
            const hrs = hoursAshore(v);
            return (
              <li key={v.id}>
                <Link href={`/cruise/visit/${v.id}`} className="flex min-w-0 items-center gap-3 rounded-2xl border border-line bg-paper p-3 shadow-soft transition-colors hover:bg-sand/40">
                  {v.ship?.image_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={v.ship.image_url} alt={name} className="h-16 w-16 shrink-0 rounded-xl object-cover sm:h-20 sm:w-20" />
                  ) : (
                    <div className="grid h-16 w-16 shrink-0 place-items-center rounded-xl bg-sand text-ink-faint sm:h-20 sm:w-20">⚓</div>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="font-display text-lg font-bold text-ink">{name}</div>
                    <div className="text-sm text-ink-muted">
                      {fmtTime(v.arrival_at)}–{fmtTime(v.departure_at)}
                      {v.berth_area_group ? ` · ${v.berth_area_group}${v.is_tender ? " (tender)" : ""}` : ""}
                    </div>
                    <div className="mt-0.5 text-sm text-ink-muted">
                      {v.est_pax ? `~${v.est_pax.toLocaleString()} passengers` : v.est_pax_label ?? ""}
                      {hrs ? ` · ${hrs} hrs ashore` : ""}
                    </div>
                  </div>
                  <span className="shrink-0 text-xs font-bold" style={{ color: st.color }}>{st.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

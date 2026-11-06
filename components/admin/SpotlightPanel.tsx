import { LANE_LABEL, type SpotlightReport } from "@/lib/spotlight-report";

const BADGE: Record<string, string> = { welcome: "bg-emerald-100 text-emerald-900", new: "bg-sky-100 text-sky-900", rotation: "bg-violet-100 text-violet-900" };
const day = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "Europe/London" }) : "–");

/** Business Spotlight: who is next and why, who is waiting out a rule, and what went out recently. Read-only: the composer decides; this only shows its last selection. */
export function SpotlightPanel({ report }: { report: SpotlightReport | null }) {
  return (
    <section aria-labelledby="spot-h" className="mt-10 rounded-card border border-line bg-paper p-5 shadow-soft">
      <h2 id="spot-h" className="font-display text-xl font-bold text-navy">Business Spotlight rotation</h2>
      {!report ? (
        <p className="mt-2 text-sm text-ink-soft">No selection has been recorded yet. It appears here after the composer&apos;s next posting-day run.</p>
      ) : (
        <>
          <p className="mt-1 text-sm text-ink-soft">
            As of the last run, {new Date(report.at).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Europe/London" })}.
            {" "}{report.counts.pool} claimed businesses: <strong className="text-ink">{report.counts.eligible} eligible</strong> ({report.counts.welcome} welcome, {report.counts.new} never featured, {report.counts.rotation} back in rotation), {report.counts.excluded} waiting out a rule.
            {report.streak > 0 && <> The last {report.streak} {report.streak === 1 ? "pick was" : "picks were"} welcome-lane.</>}
          </p>

          <h3 className="mt-5 font-display text-base font-bold text-ink">Next up</h3>
          {report.order.length === 0 ? <p className="mt-1 text-sm text-ink-muted">Nobody is eligible right now.</p> : (
            <ol className="mt-2 space-y-1.5">
              {report.order.slice(0, 12).map((r, i) => (
                <li key={r.id} className="flex flex-wrap items-center gap-2 text-sm">
                  <span className="w-6 text-right font-bold text-ink-muted">{i + 1}.</span>
                  <span className="font-semibold text-ink">{r.name}</span>
                  <span className={"rounded-pill px-2.5 py-0.5 text-xs font-bold " + BADGE[r.lane]}>{LANE_LABEL[r.lane]}</span>
                  {r.sensitive && <span className="rounded-pill bg-amber-100 px-2.5 py-0.5 text-xs font-bold text-amber-950">Needs your approval</span>}
                  <span className="text-xs text-ink-muted">{r.lastPostedAt ? `last featured ${day(r.lastPostedAt)}` : `claimed ${day(r.claimedAt)}`}</span>
                </li>
              ))}
            </ol>
          )}
          {report.order.length > 12 && <p className="mt-1 text-xs text-ink-muted">and {report.order.length - 12} more in the queue.</p>}

          <h3 className="mt-5 font-display text-base font-bold text-ink">Not eligible, and why</h3>
          {report.excluded.length === 0 ? <p className="mt-1 text-sm text-ink-muted">Nothing is being held back.</p> : (
            <ul className="mt-2 space-y-1 text-sm">
              {report.excluded.map((x) => (
                <li key={x.id} className="text-ink-soft"><span className="font-semibold text-ink">{x.name}</span>: {x.reason}{x.until ? `, eligible again ${x.until}` : ""}</li>
              ))}
            </ul>
          )}

          <h3 className="mt-5 font-display text-base font-bold text-ink">Recent picks</h3>
          {report.recent.length === 0 ? <p className="mt-1 text-sm text-ink-muted">None yet.</p> : (
            <ul className="mt-2 space-y-1 text-sm text-ink-soft">
              {report.recent.map((x, i) => <li key={`${x.id}-${i}`}><span className="font-semibold text-ink">{x.name}</span> · {x.status} · {day(x.when)}</li>)}
            </ul>
          )}
        </>
      )}
    </section>
  );
}

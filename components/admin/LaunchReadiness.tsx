import Link from "next/link";
import { StatusPill } from "@/components/admin/AdminUI";
import {
  CRITICALITY_LABEL, FILTERS, FILTER_LABEL, STATUS_CONTRIBUTION, STATUS_LABEL,
  computeReadiness, filterItems, inLaunchScope, isOpenBlocker, isStatus, recentlyCompleted, sortForDisplay,
  type ReadinessDataset, type ReadinessFilter, type ReadinessItem, type Status,
} from "@/lib/launch-readiness";

/*
 * Presentational only — renders whatever lib/launch-readiness-data.ts says.
 * To change what the dashboard shows, edit the data file, not this component.
 * Server component: no client JS, filters are plain links.
 */

const TONE: Record<Status, "green" | "blue" | "amber" | "red" | "gray"> = {
  complete: "green", needs_verification: "blue", in_progress: "amber", blocked: "red", not_started: "gray",
};

const BASE = "/admin/launch-readiness";

function hrefFor(view: ReadinessFilter, area: string | null) {
  const q = new URLSearchParams();
  if (view !== "all") q.set("view", view);
  if (area) q.set("area", area);
  const s = q.toString();
  return s ? `${BASE}?${s}` : BASE;
}

function formatDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
}

function StatusBadge({ status }: { status: ReadinessItem["status"] }) {
  return isStatus(status)
    ? <StatusPill label={STATUS_LABEL[status]} tone={TONE[status]} />
    : <StatusPill label={`Unknown: ${String(status)}`} tone="purple" />;
}

function ProgressBar({ percent, className = "h-3" }: { percent: number; className?: string }) {
  return (
    <div className={"w-full overflow-hidden rounded-pill bg-sand " + className} role="progressbar" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100}>
      <div className="h-full rounded-pill bg-teal" style={{ width: `${percent}%` }} />
    </div>
  );
}

function SummaryCard({ label, value, alert }: { label: string; value: string | number; alert?: boolean }) {
  return (
    <div className={"rounded-card border bg-paper p-4 shadow-soft " + (alert ? "border-rose-300" : "border-line")}>
      <p className={"font-display text-2xl font-bold " + (alert ? "text-rose-600" : "text-ink")}>{value}</p>
      <p className="mt-0.5 text-xs font-semibold text-ink-muted">{label}</p>
    </div>
  );
}

function ItemRow({ item, areaTitle }: { item: ReadinessItem; areaTitle?: string }) {
  const blocker = isOpenBlocker(item);
  return (
    <details className={"group rounded-card border bg-paper shadow-soft " + (blocker ? "border-rose-300" : "border-line")}>
      <summary className="flex cursor-pointer list-none flex-wrap items-center gap-x-3 gap-y-1.5 px-4 py-3 [&::-webkit-details-marker]:hidden">
        <StatusBadge status={item.status} />
        <span className="min-w-0 flex-1 font-semibold text-ink">{item.title}</span>
        {item.criticality === "launch_blocker"
          ? <span className={"text-xs font-bold " + (blocker ? "text-rose-600" : "text-ink-faint")}>{CRITICALITY_LABEL.launch_blocker}</span>
          : <span className="text-xs text-ink-faint">{CRITICALITY_LABEL[item.criticality] ?? item.criticality}</span>}
        <span className="text-xs text-ink-faint">{formatDate(item.lastUpdated)}</span>
        <span className="inline-block text-ink-faint transition group-open:rotate-90" aria-hidden>›</span>
      </summary>
      <div className="space-y-2 border-t border-line px-4 py-3 text-sm">
        <p className="text-ink-soft">{item.description}</p>
        <p className="text-ink"><span className="font-semibold">Evidence: </span>{item.evidence}</p>
        {item.nextAction && <p className="text-ink"><span className="font-semibold">Next: </span>{item.nextAction}</p>}
        <p className="text-xs text-ink-faint">
          {areaTitle ? `${areaTitle} · ` : ""}weight {item.weight} · <code>{item.id}</code>
        </p>
      </div>
    </details>
  );
}

export function LaunchReadinessDashboard({ data, view, area }: { data: ReadinessDataset; view: ReadinessFilter; area: string | null }) {
  const summary = computeReadiness(data);
  const areaTitle = Object.fromEntries(data.categories.map((c) => [c.id, c.title]));
  const launchItems = data.items.filter(inLaunchScope);
  const postLaunch = data.items.filter((i) => !inLaunchScope(i));
  const openBlockers = sortForDisplay(launchItems.filter(isOpenBlocker));
  const recent = recentlyCompleted(launchItems, 8);
  const shown = filterItems(launchItems, view, area);
  const validArea = area && areaTitle[area] ? area : null;

  return (
    <div className="space-y-8">
      {/* Headline: percentage and blockers side by side, never one without the other. */}
      <section className="rounded-card border border-line bg-paper p-5 shadow-soft">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-ink-muted">Launch readiness</p>
            <p className="font-display text-5xl font-bold text-ink">{summary.percent}%</p>
          </div>
          <div className={"rounded-card border px-4 py-3 text-right " + (summary.openBlockers > 0 ? "border-rose-300 bg-rose-50" : "border-emerald-300 bg-emerald-50")}>
            <p className={"font-display text-3xl font-bold " + (summary.openBlockers > 0 ? "text-rose-600" : "text-emerald-700")}>{summary.openBlockers}</p>
            <p className="text-sm font-semibold text-ink-soft">Launch blockers</p>
          </div>
        </div>
        <ProgressBar percent={summary.percent} className="mt-4 h-3" />
        {summary.openBlockers > 0 ? (
          <p className="mt-4 rounded-lg bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700">
            Launch blockers remain. OneShetland is not ready to launch, whatever the percentage says.
          </p>
        ) : (
          <p className="mt-4 rounded-lg bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700">No open launch blockers.</p>
        )}
        <p className="mt-3 text-xs text-ink-muted">
          Weighted across {summary.totalLaunchItems} launch items: complete {STATUS_CONTRIBUTION.complete * 100}%,
          needs verification {STATUS_CONTRIBUTION.needs_verification * 100}%, in progress {STATUS_CONTRIBUTION.in_progress * 100}%,
          blocked and not started 0%. Rounded down. Post-launch items excluded. Last updated {formatDate(summary.lastUpdated)}.
        </p>
      </section>

      {summary.issues.length > 0 && (
        <section className="rounded-card border border-amber-300 bg-amber-50 p-4 text-sm text-amber-800">
          <p className="font-bold">The readiness data has {summary.issues.length} problem{summary.issues.length === 1 ? "" : "s"}. Fix lib/launch-readiness-data.ts:</p>
          <ul className="mt-1 list-disc pl-5">{summary.issues.map((m) => <li key={m}>{m}</li>)}</ul>
        </section>
      )}

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4 xl:grid-cols-7">
        <SummaryCard label="Overall readiness" value={`${summary.percent}%`} />
        <SummaryCard label="Complete" value={summary.counts.complete} />
        <SummaryCard label="In progress" value={summary.counts.in_progress} />
        <SummaryCard label="Needs verification" value={summary.counts.needs_verification} />
        <SummaryCard label="Blocked" value={summary.counts.blocked} alert={summary.counts.blocked > 0} />
        <SummaryCard label="Not started" value={summary.counts.not_started} />
        <SummaryCard label="Launch blockers" value={summary.openBlockers} alert={summary.openBlockers > 0} />
      </section>

      <div className="grid gap-8 lg:grid-cols-5">
        <section className="lg:col-span-3">
          <h2 className="mb-3 font-display text-xl font-bold text-ink">Current launch blockers</h2>
          {openBlockers.length === 0 ? (
            <p className="text-sm text-ink-muted">None.</p>
          ) : (
            <ul className="divide-y divide-line rounded-card border border-rose-200 bg-paper shadow-soft">
              {openBlockers.map((i) => (
                <li key={i.id} className="flex flex-wrap items-start gap-x-3 gap-y-1 px-4 py-3">
                  <StatusBadge status={i.status} />
                  <div className="min-w-0 flex-1 basis-60">
                    <p className="font-semibold text-ink">{i.title} <span className="text-xs font-normal text-ink-faint">· {areaTitle[i.area] ?? i.area}</span></p>
                    {i.nextAction && <p className="text-sm text-ink-muted">{i.nextAction}</p>}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="lg:col-span-2">
          <h2 className="mb-3 font-display text-xl font-bold text-ink">Recently completed</h2>
          {recent.length === 0 ? (
            <p className="text-sm text-ink-muted">Nothing completed yet.</p>
          ) : (
            <ul className="divide-y divide-line rounded-card border border-line bg-paper shadow-soft">
              {recent.map((i) => (
                <li key={i.id} className="flex items-baseline justify-between gap-3 px-4 py-2.5">
                  <span className="min-w-0 text-sm font-semibold text-ink">{i.title}</span>
                  <span className="shrink-0 text-xs text-ink-faint">{formatDate(i.lastUpdated)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <section>
        <div className="mb-3 flex flex-wrap items-center gap-2">
          {FILTERS.map((f) => (
            <Link key={f} href={hrefFor(f, validArea)}
              className={"rounded-pill px-4 py-1.5 text-sm font-semibold " + (view === f ? "bg-rose-600 text-white" : "border border-line-strong text-ink-soft hover:bg-sand")}>
              {FILTER_LABEL[f]}
            </Link>
          ))}
        </div>
        <div className="mb-5 flex flex-wrap gap-1.5">
          <Link href={hrefFor(view, null)} className={"rounded-pill px-3 py-1 text-xs font-semibold " + (!validArea ? "bg-navy text-white" : "bg-sand text-ink-soft hover:bg-line")}>All areas</Link>
          {data.categories.map((c) => (
            <Link key={c.id} href={hrefFor(view, c.id)}
              className={"rounded-pill px-3 py-1 text-xs font-semibold " + (validArea === c.id ? "bg-navy text-white" : "bg-sand text-ink-soft hover:bg-line")}>
              {c.title}
            </Link>
          ))}
        </div>

        {shown.length === 0 ? (
          <p className="rounded-card border border-dashed border-line bg-paper/60 px-6 py-10 text-center text-sm text-ink-muted">No items match this filter.</p>
        ) : (
          <div className="space-y-8">
            {data.categories.map((c) => {
              const inArea = shown.filter((i) => i.area === c.id);
              if (inArea.length === 0) return null;
              const all = launchItems.filter((i) => i.area === c.id);
              const areaSummary = computeReadiness({ categories: data.categories, items: all });
              return (
                <div key={c.id}>
                  <div className="mb-2 flex flex-wrap items-center gap-3">
                    <h3 className="font-display text-lg font-bold text-ink">{c.title}</h3>
                    <span className="text-xs font-semibold text-ink-muted">
                      {areaSummary.counts.complete}/{all.length} complete · {areaSummary.percent}%
                      {areaSummary.openBlockers > 0 && <span className="text-rose-600"> · {areaSummary.openBlockers} blocker{areaSummary.openBlockers === 1 ? "" : "s"}</span>}
                    </span>
                    <ProgressBar percent={areaSummary.percent} className="h-1.5 max-w-40 flex-1" />
                  </div>
                  <div className="space-y-2">
                    {sortForDisplay(inArea).map((i) => <ItemRow key={i.id} item={i} />)}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {postLaunch.length > 0 && (
        <section>
          <h2 className="mb-1 font-display text-xl font-bold text-ink">Post-launch</h2>
          <p className="mb-3 text-sm text-ink-muted">Deliberately out of launch scope. Not counted in the percentage or blocker count.</p>
          <div className="space-y-2">
            {postLaunch.map((i) => <ItemRow key={i.id} item={i} areaTitle={areaTitle[i.area]} />)}
          </div>
        </section>
      )}
    </div>
  );
}

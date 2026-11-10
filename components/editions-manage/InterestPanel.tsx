import { Panel } from "./kit";

export type Metric = { metric: string; value: number | null; masked: boolean };
const LABEL: Record<string, string> = { page_views: "Page views", programme_views: "Programme views", ticket_clicks: "Ticket link clicks", calendar_downloads: "Calendar downloads", saves: "People following", plan_additions: "Items added to plans", partners_taking_part: "Partners taking part", partners_waiting: "Partners waiting for an answer", sessions: "Programme sessions" };
const ORDER = ["page_views", "programme_views", "ticket_clicks", "saves", "plan_additions", "calendar_downloads", "partners_taking_part", "partners_waiting", "sessions"];

/** "How it is going": totals only. A count under 5 is hidden by the database so a tiny audience can never be identified; no person, device or address is ever shown. */
export function InterestPanel({ metrics, days }: { metrics: Metric[]; days: number }) {
  const by = new Map(metrics.map((m) => [m.metric, m]));
  return (
    <Panel title="How it is going" sub={`Visits in the last ${days} days. Totals only: counts under 5 are hidden to protect privacy.`}>
      <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
        {ORDER.filter((k) => by.has(k)).map((k) => { const m = by.get(k)!; return (
          <div key={k}><dt className="text-ink-muted">{LABEL[k]}</dt><dd className="font-display text-2xl font-bold tabular-nums text-ink">{m.masked ? <span className="text-base font-semibold text-ink-muted" title="Fewer than 5">under 5</span> : m.value}</dd></div>); })}
      </dl>
    </Panel>
  );
}

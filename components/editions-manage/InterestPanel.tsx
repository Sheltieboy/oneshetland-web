import { Panel } from "./kit";

export type Metric = { metric: string; value: number | null; masked: boolean };
const LABEL: Record<string, string> = { page_views: "Page views", programme_views: "Programme views", listing_clicks: "Clicks to businesses on OneShetland", website_clicks: "Clicks to outside websites", ticket_clicks: "Ticket link clicks", calendar_downloads: "Calendar downloads", saves: "People following", plan_additions: "Items added to plans", partners_taking_part: "Partners taking part", partners_waiting: "Partners waiting for an answer", sessions: "Programme sessions" };
/** What each number does and does not mean, in the organiser's own terms. */
const HINT: Record<string, string> = {
  page_views: "Times a page of your Edition was opened. Not the number of people.",
  programme_views: "Times a programme item was opened.",
  listing_clicks: "Times somebody followed a link from your Edition to a business, Hub or listing on OneShetland.",
  website_clicks: "Times somebody followed a link from your Edition to a website outside OneShetland. We count the click, never what happened next.",
  ticket_clicks: "Times an external ticket link was followed.",
  calendar_downloads: "Times a calendar file was downloaded.",
  saves: "People who saved your Edition.",
  plan_additions: "Times somebody added one of your programme items to their plan.",
};
const ORDER = ["page_views", "programme_views", "listing_clicks", "website_clicks", "ticket_clicks", "saves", "plan_additions", "calendar_downloads", "partners_taking_part", "partners_waiting", "sessions"];

/** "How it is going": totals only. A count under 5 is hidden by the database so a tiny audience can never be identified; no person, device or address is ever shown. */
export function InterestPanel({ metrics, days }: { metrics: Metric[]; days: number }) {
  const by = new Map(metrics.map((m) => [m.metric, m]));
  return (
    <Panel title="How it is going" sub={`The last ${days} days. Totals only, and only for visitors who accepted analytics — so every number is a floor, not a full count. Anything under 5 is hidden so a small audience can never be identified.`}>
      <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
        {ORDER.filter((k) => by.has(k)).map((k) => { const m = by.get(k)!; return (
          <div key={k}>
            <dt className="text-ink-muted">{LABEL[k]}</dt>
            <dd className="font-display text-2xl font-bold tabular-nums text-ink">{m.masked ? <span className="text-base font-semibold text-ink-muted" title="Fewer than 5">under 5</span> : m.value}</dd>
            {HINT[k] && <dd className="mt-0.5 text-xs leading-snug text-ink-muted">{HINT[k]}</dd>}
          </div>); })}
      </dl>
    </Panel>
  );
}

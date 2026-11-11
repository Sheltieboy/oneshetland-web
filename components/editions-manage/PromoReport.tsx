import { KIND_TEXT, REPORT_NOTE, runText, type ReportRow } from "@/lib/editions/promo";
import { EmptyState, Pill } from "./kit";

const n = (v: number) => v.toLocaleString("en-GB");

/** Per booking: the dates and what they brought. Cards, so it reads at phone width without sideways scrolling. */
export function PromoReport({ rows }: { rows: ReportRow[] }) {
  if (rows.length === 0) return <EmptyState>There is nothing to report yet. A report appears once you have scheduled promotion.</EmptyState>;
  return (
    <div className="space-y-4">
      <p role="note" className="rounded-xl bg-sand px-4 py-3 text-sm text-ink-soft">{REPORT_NOTE}</p>
      <ul className="grid gap-4 sm:grid-cols-2">
        {rows.map((r) => (
          <li key={r.booking_id} className="rounded-card border border-line bg-paper p-4 shadow-soft">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="font-display text-lg font-bold text-ink">{KIND_TEXT[r.kind]}</h3>
              {r.status === "cancelled" && <Pill label="Cancelled" tone="gray" />}
            </div>
            <p className="text-sm text-ink-soft">{runText(r.starts_on, r.ends_on)}</p>
            <dl className="mt-3 grid grid-cols-2 gap-3 text-sm">
              {([["Times shown", r.shown], ["Taps", r.taps], ["Page views", r.views], ["Saves", r.saves], ["Added to a plan", r.plan_adds]] as const).map(([k, v]) => (
                <div key={k}><dt className="text-ink-muted">{k}</dt><dd className="text-xl font-bold tabular-nums text-ink">{n(v)}</dd></div>
              ))}
            </dl>
          </li>
        ))}
      </ul>
    </div>
  );
}

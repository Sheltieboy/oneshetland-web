import Link from "next/link";
import { getTradeDemand } from "@/lib/trades-data";
import { TRADE_LABEL } from "@/lib/trades";

/**
 * The waiting list, on its own page so it can be linked and sent to people.
 *
 * This is the most valuable thing the whole feature produces. It is the pitch
 * to every trade not listed yet, the argument for apprentice places at the
 * college, and a story worth printing. Demand is the only leverage anybody has
 * on supply, and until now nobody in Shetland had the number.
 *
 * Aggregate only — it comes from trade_demand_summary(), which exposes counts
 * and nothing else, so it's readable signed out without showing a soul's job.
 */

export const dynamic = "force-dynamic";

export const metadata = {
  title: "What Shetland is waiting for",
  description: "Open jobs across Shetland that nobody has taken on yet, by trade.",
};

const ACCENT = "#2a8b5c";

export default async function WaitingPage() {
  const demand = await getTradeDemand();
  const total = demand.reduce((n, d) => n + d.waiting, 0);
  const unanswered = demand.reduce((n, d) => n + d.unanswered, 0);

  return (
    <main className="mx-auto max-w-4xl px-5 py-14">
      <p className="eyebrow" style={{ color: ACCENT }}>Get it done</p>
      <h1 className="mt-2 font-display text-4xl font-bold text-navy">What Shetland is waiting for</h1>

      {total === 0 ? (
        <p className="mt-4 text-lg text-ink-soft">
          Nothing waiting just now. When folk post jobs that nobody picks up, they show here —
          it&apos;s how we make the case for more trades.{" "}
          <Link href="/get-it-done" className="font-semibold underline">Post a job</Link>.
        </p>
      ) : (
        <>
          <p className="mt-4 text-lg text-ink-soft">
            <strong className="text-ink">{total}</strong> open {total === 1 ? "job" : "jobs"} across
            the isles{unanswered > 0 ? <>, <strong className="text-ink">{unanswered}</strong> of them with nobody signed up yet.</> : "."}
          </p>

          <div className="mt-8 overflow-x-auto">
            <table className="w-full min-w-[30rem] text-left">
              <thead>
                <tr className="border-b border-line text-sm text-ink-muted">
                  <th className="pb-2 font-semibold">Trade</th>
                  <th className="pb-2 text-right font-semibold">Waiting</th>
                  <th className="pb-2 text-right font-semibold">No answer</th>
                  <th className="pb-2 text-right font-semibold">Avg wait</th>
                </tr>
              </thead>
              <tbody>
                {demand.map((d) => (
                  <tr key={d.trade} className="border-b border-line/60">
                    <td className="py-3 font-semibold text-ink">{TRADE_LABEL[d.trade] ?? d.trade}</td>
                    <td className="py-3 text-right font-bold" style={{ color: ACCENT }}>{d.waiting}</td>
                    <td className="py-3 text-right text-ink-soft">{d.unanswered}</td>
                    <td className="py-3 text-right text-ink-soft">{d.avgDaysWaiting} days</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      <div className="mt-10 rounded-xl border border-line bg-sand/40 p-6">
        <p className="font-display text-lg font-bold text-ink">If you&apos;re a tradesperson</p>
        <p className="mt-2 text-ink-soft">
          This is work nobody is doing. Claim your listing, say what you cover and whether
          you have room, and the jobs come to you — you&apos;ll get your first few each month
          for nothing. We never charge to be seen sooner: the order is set by who has room
          and who answers.
        </p>
        <Link href="/for-businesses" className="mt-4 inline-block rounded-pill px-5 py-2.5 font-bold text-white" style={{ background: ACCENT }}>
          Claim your listing
        </Link>
      </div>
    </main>
  );
}

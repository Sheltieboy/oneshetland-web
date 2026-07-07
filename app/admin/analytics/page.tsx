import { requireAdmin } from "@/lib/admin-data.server";
import {
  getAnalyticsOverview, getAnalyticsRevenue, getAnalyticsTopSearches,
} from "@/lib/analytics-admin.server";
import { AdminHeader, StatCard, Card } from "@/components/admin/AdminUI";

export const dynamic = "force-dynamic";

const gbp = (pence: number) =>
  new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format((pence ?? 0) / 100);
const num = (n: number) => new Intl.NumberFormat("en-GB").format(n ?? 0);

export default async function AnalyticsDashboard() {
  await requireAdmin();
  const [overview, revenue, searches] = await Promise.all([
    getAnalyticsOverview(30),
    getAnalyticsRevenue(30),
    getAnalyticsTopSearches(30),
  ]);

  const t = overview?.totals;
  const maxDay = Math.max(1, ...(overview?.by_day ?? []).map((d) => d.events));
  const grossTotal = (revenue?.streams ?? []).reduce((s, r) => s + (r.gross_pence ?? 0), 0);
  const feesTotal = (revenue?.streams ?? []).reduce((s, r) => s + (r.fees_pence ?? 0), 0);
  const maxEvent = Math.max(1, ...(overview?.top_events ?? []).map((e) => e.count));

  return (
    <>
      <AdminHeader title="Analytics" sub="Behaviour, conversions and revenue across OneShetland — last 30 days." />

      {!overview ? (
        <Card><p className="text-sm text-ink/60">No analytics data yet, or the analytics RPCs aren&apos;t deployed. Use the app to generate events, then refresh.</p></Card>
      ) : (
        <>
          {/* Headline numbers */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            <StatCard label="Events" value={t?.events ?? 0} />
            <StatCard label="Conversions" value={t?.conversions ?? 0} />
            <StatCard label="Sign-ups" value={t?.signups ?? 0} />
            <StatCard label="Visitors" value={t?.unique_visitors ?? 0} />
            <StatCard label="Signed-in users" value={t?.unique_users ?? 0} />
            <StatCard label="Revenue (gross)" value={Math.round(grossTotal / 100)} />
          </div>

          {/* Activity by day */}
          <h2 className="mb-3 mt-10 font-display text-xl font-bold text-ink">Activity by day</h2>
          <Card>
            <div className="flex h-40 items-end gap-1">
              {(overview.by_day ?? []).map((d) => (
                <div key={d.day} className="group relative flex-1" title={`${d.day}: ${d.events} events, ${d.conversions} conversions`}>
                  <div className="w-full rounded-t bg-navy/15" style={{ height: `${(d.events / maxDay) * 100}%` }} />
                  <div className="absolute bottom-0 w-full rounded-t bg-navy" style={{ height: `${(d.conversions / maxDay) * 100}%` }} />
                </div>
              ))}
              {(overview.by_day ?? []).length === 0 && <p className="text-sm text-ink/50">No activity yet.</p>}
            </div>
            <p className="mt-2 text-xs text-ink/50">Light = all events · Dark = conversions</p>
          </Card>

          <div className="mt-6 grid gap-6 lg:grid-cols-2">
            {/* Conversions by category */}
            <div>
              <h2 className="mb-3 font-display text-xl font-bold text-ink">Conversions by category</h2>
              <Card>
                {(overview.by_category ?? []).filter((c) => c.conversions > 0).length === 0 ? (
                  <p className="text-sm text-ink/50">No conversions yet.</p>
                ) : (
                  <ul className="space-y-2">
                    {overview.by_category.filter((c) => c.conversions > 0).sort((a, b) => b.conversions - a.conversions).map((c) => (
                      <li key={c.category} className="flex items-center justify-between text-sm">
                        <span className="capitalize text-ink/80">{c.category.replace(/_/g, " ")}</span>
                        <span className="font-semibold text-ink">{num(c.conversions)}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </Card>
            </div>

            {/* Content views by type */}
            <div>
              <h2 className="mb-3 font-display text-xl font-bold text-ink">Content views</h2>
              <Card>
                {(overview.top_content ?? []).length === 0 ? (
                  <p className="text-sm text-ink/50">No content views yet.</p>
                ) : (
                  <ul className="space-y-2">
                    {overview.top_content.map((c) => (
                      <li key={c.object_type} className="flex items-center justify-between text-sm">
                        <span className="capitalize text-ink/80">{c.object_type}</span>
                        <span className="text-ink"><span className="font-semibold">{num(c.count)}</span> <span className="text-ink/50">views · {num(c.distinct_items)} items</span></span>
                      </li>
                    ))}
                  </ul>
                )}
              </Card>
            </div>
          </div>

          {/* Top events */}
          <h2 className="mb-3 mt-10 font-display text-xl font-bold text-ink">Top events</h2>
          <Card>
            <ul className="space-y-1.5">
              {(overview.top_events ?? []).map((e) => (
                <li key={e.event_name} className="flex items-center gap-3 text-sm">
                  <span className="w-56 shrink-0 font-mono text-xs text-ink/80">{e.event_name}{e.is_conversion && <span className="ml-1 text-green-600">●</span>}</span>
                  <span className="h-2 rounded bg-navy" style={{ width: `${(e.count / maxEvent) * 100}%`, minWidth: 4 }} />
                  <span className="ml-auto font-semibold text-ink">{num(e.count)}</span>
                </li>
              ))}
            </ul>
            <p className="mt-2 text-xs text-ink/50">Green ● = conversion event</p>
          </Card>

          {/* Revenue by stream (from ledgers) */}
          <h2 className="mb-3 mt-10 font-display text-xl font-bold text-ink">Revenue by stream <span className="text-sm font-normal text-ink/50">(from order ledgers)</span></h2>
          <Card>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-ink/10 text-left text-xs uppercase text-ink/50">
                  <th className="pb-2">Stream</th>
                  <th className="pb-2 text-right">Orders</th>
                  <th className="pb-2 text-right">Gross</th>
                  <th className="pb-2 text-right">Platform fees</th>
                </tr>
              </thead>
              <tbody>
                {(revenue?.streams ?? []).map((r) => (
                  <tr key={r.stream} className="border-b border-ink/5">
                    <td className="py-2 text-ink/80">{r.stream}</td>
                    <td className="py-2 text-right text-ink">{num(r.orders)}</td>
                    <td className="py-2 text-right font-medium text-ink">{gbp(r.gross_pence)}</td>
                    <td className="py-2 text-right text-ink/70">{r.fees_pence ? gbp(r.fees_pence) : "—"}</td>
                  </tr>
                ))}
                <tr className="font-bold text-ink">
                  <td className="py-2">Total</td>
                  <td className="py-2 text-right">{num((revenue?.streams ?? []).reduce((s, r) => s + r.orders, 0))}</td>
                  <td className="py-2 text-right">{gbp(grossTotal)}</td>
                  <td className="py-2 text-right">{gbp(feesTotal)}</td>
                </tr>
              </tbody>
            </table>
            <p className="mt-2 text-xs text-ink/50">Wallet top-ups are stored float, not platform revenue. Donations/ticket gross flow to hubs/organisers minus platform fees.</p>
          </Card>

          {/* Top searches */}
          <h2 className="mb-3 mt-10 font-display text-xl font-bold text-ink">Top searches <span className="text-sm font-normal text-ink/50">(demand signal)</span></h2>
          <Card>
            {searches.length === 0 ? (
              <p className="text-sm text-ink/50">No searches captured yet (search instrumentation lands next).</p>
            ) : (
              <ul className="space-y-1.5">
                {searches.map((s, i) => (
                  <li key={i} className="flex items-center justify-between text-sm">
                    <span className="text-ink/80">{s.query} {s.section && <span className="text-ink/40">· {s.section}</span>}</span>
                    <span className="text-ink">{num(s.searches)} {s.zero_result > 0 && <span className="ml-1 rounded bg-amber-100 px-1.5 py-0.5 text-xs text-amber-700">{s.zero_result} no-result</span>}</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <p className="mt-8 text-xs text-ink/40">Generated {overview.generated_at ? new Date(overview.generated_at).toLocaleString("en-GB") : ""}.</p>
        </>
      )}
    </>
  );
}

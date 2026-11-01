import { requireAdmin } from "@/lib/admin-data.server";
import {
  getAnalyticsOverview, getAnalyticsRevenue, getAnalyticsTopSearches,
} from "@/lib/analytics-admin.server";
import { AdminHeader, StatCard, Card } from "@/components/admin/AdminUI";
import { gbp, num, salesTotals, streamNet, isWalletFloat, KPI_DEFINITIONS, excludedTotal } from "@/lib/analytics-format";

export const dynamic = "force-dynamic";

export default async function AnalyticsDashboard() {
  await requireAdmin();
  const [overview, revenue, searches] = await Promise.all([
    getAnalyticsOverview(30),
    getAnalyticsRevenue(30),
    getAnalyticsTopSearches(30),
  ]);

  const t = overview?.totals;
  const maxDay = Math.max(1, ...(overview?.by_day ?? []).map((d) => d.events));
  // Sales only: wallet top-ups are customer funds, never revenue (an older database may still return them as a stream).
  const salesStreams = (revenue?.streams ?? []).filter((r) => !isWalletFloat(r));
  const sales = salesTotals(salesStreams);
  const excluded = excludedTotal(overview?.excluded);
  const maxEvent = Math.max(1, ...(overview?.top_events ?? []).map((e) => e.count));

  return (
    <>
      <AdminHeader title="Analytics" sub="Behaviour, conversions and revenue across OneShetland — last 30 days. Administrator and test activity is excluded; nothing is deleted." />

      {!overview ? (
        <Card><p className="text-sm text-ink/60">No analytics data yet, or the analytics RPCs aren&apos;t deployed. Use the app to generate events, then refresh.</p></Card>
      ) : (
        <>
          {/* Headline numbers (each one is defined under "How these figures are measured" at the foot of the page) */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            <StatCard label="Events" value={t?.events ?? 0} />
            <StatCard label="Conversions" value={t?.conversions ?? 0} />
            <StatCard label="New registrations" value={t?.signups ?? 0} hint={t?.signups_confirmed !== undefined ? `${num(t.signups_confirmed)} confirmed` : undefined} />
            <StatCard label="Signed-in members" value={t?.unique_users ?? 0} hint="opted in to analytics" />
            <StatCard label="Anonymous visitors" value={t?.unique_visitors ?? 0} hint="opted in, never signed in" />
            <StatCard label="Gross sales" value={Math.round(sales.gross / 100)} display={gbp(sales.gross)} hint={`${gbp(sales.net)} after refunds`} />
          </div>
          {excluded > 0 && (
            <p className="mt-2 text-xs text-ink/50">
              {num(excluded)} of {num(overview.excluded?.raw_events ?? 0)} recorded events are left out of these figures: {num(overview.excluded?.internal_or_test ?? 0)} internal/test activity,{" "}
              {num(overview.excluded?.unmatched_ledger ?? 0)} purchase records whose order no longer exists, {num(overview.excluded?.duplicate_ledger ?? 0)} repeats. They remain stored.
            </p>
          )}

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

          {/* Sales by stream (from the order ledgers) */}
          <h2 className="mb-3 mt-10 font-display text-xl font-bold text-ink">Sales by stream <span className="text-sm font-normal text-ink/50">(from the order records, internal/test purchases excluded)</span></h2>
          <Card>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-ink/10 text-left text-xs uppercase text-ink/50">
                    <th className="pb-2">Stream</th>
                    <th className="pb-2 text-right">Orders</th>
                    <th className="pb-2 text-right">Gross</th>
                    <th className="pb-2 text-right">Refunded</th>
                    <th className="pb-2 text-right">Net</th>
                    <th className="pb-2 text-right">OneShetland keeps</th>
                  </tr>
                </thead>
                <tbody>
                  {salesStreams.map((r) => (
                    <tr key={r.stream} className="border-b border-ink/5">
                      <td className="py-2 text-ink/80">{r.stream}</td>
                      <td className="py-2 text-right text-ink">{num(r.orders)}</td>
                      <td className="py-2 text-right font-medium text-ink">{gbp(r.gross_pence)}</td>
                      <td className="py-2 text-right text-ink/70">{r.refunded_pence ? gbp(r.refunded_pence) : "—"}</td>
                      <td className="py-2 text-right font-medium text-ink">{gbp(streamNet(r))}</td>
                      <td className="py-2 text-right text-ink/70">{r.platform_pence === null || r.platform_pence === undefined ? "—" : gbp(r.platform_pence)}</td>
                    </tr>
                  ))}
                  <tr className="font-bold text-ink">
                    <td className="py-2">Total</td>
                    <td className="py-2 text-right">{num(sales.orders)}</td>
                    <td className="py-2 text-right">{gbp(sales.gross)}</td>
                    <td className="py-2 text-right">{sales.refunded ? gbp(sales.refunded) : "—"}</td>
                    <td className="py-2 text-right">{gbp(sales.net)}</td>
                    <td className="py-2 text-right">{gbp(sales.platform)}{sales.platformUnknown ? "*" : ""}</td>
                  </tr>
                </tbody>
              </table>
            </div>
            {sales.platformUnknown && <p className="mt-2 text-xs text-ink/50">* A dash means that stream does not record OneShetland&apos;s share, so the total shows only what is recorded.</p>}
            {revenue?.totals && revenue.totals.excluded_internal_orders > 0 && (
              <p className="mt-1 text-xs text-ink/50">Left out: {num(revenue.totals.excluded_internal_orders)} administrator/test purchases worth {gbp(revenue.totals.excluded_internal_gross_pence)}.</p>
            )}
          </Card>

          {/* Wallet funds: customer money, not sales */}
          {revenue?.wallet && (
            <>
              <h2 className="mb-3 mt-10 font-display text-xl font-bold text-ink">Wallet funds <span className="text-sm font-normal text-ink/50">(customer money — not sales, not revenue)</span></h2>
              <Card>
                <ul className="grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-4">
                  <li><span className="block text-ink/50">Topped up</span><span className="font-semibold text-ink">{gbp(revenue.wallet.topups_pence)}</span> <span className="text-ink/50">({num(revenue.wallet.topups)})</span></li>
                  <li><span className="block text-ink/50">Spent</span><span className="font-semibold text-ink">{gbp(revenue.wallet.spent_pence)}</span> <span className="text-ink/50">({num(revenue.wallet.spends)})</span></li>
                  <li><span className="block text-ink/50">Refunded to wallets</span><span className="font-semibold text-ink">{gbp(revenue.wallet.refunded_to_wallet_pence)}</span></li>
                  <li><span className="block text-ink/50">Administrator adjustments</span><span className="font-semibold text-ink">{gbp(revenue.wallet.adjustments_pence)}</span></li>
                </ul>
                <p className="mt-2 text-xs text-ink/50">{KPI_DEFINITIONS.wallet}</p>
              </Card>
            </>
          )}

          {/* Subscriptions: plan state, not invoices */}
          {revenue?.subscriptions && (
            <>
              <h2 className="mb-3 mt-10 font-display text-xl font-bold text-ink">Business subscriptions <span className="text-sm font-normal text-ink/50">(estimate from plan state)</span></h2>
              <Card>
                <p className="text-sm text-ink/80">
                  <span className="font-semibold text-ink">{num(revenue.subscriptions.paying)}</span> paying ({num(revenue.subscriptions.paying_pro)} Pro, {num(revenue.subscriptions.paying_premium)} Premium) — estimated{" "}
                  <span className="font-semibold text-ink">{gbp(revenue.subscriptions.est_mrr_pence)}</span> a month. {num(revenue.subscriptions.complimentary)} on complimentary launch access (no income).
                </p>
                <p className="mt-2 text-xs text-ink/50">{KPI_DEFINITIONS.subscriptions}</p>
              </Card>
            </>
          )}

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

          <h2 className="mb-3 mt-10 font-display text-xl font-bold text-ink">How these figures are measured</h2>
          <Card>
            <dl className="space-y-2 text-sm">
              {([["Events", "events"], ["Conversions", "conversions"], ["New registrations", "registrations"], ["Confirmed", "confirmed"], ["Signed-in members", "signedIn"], ["Anonymous visitors", "anonymous"], ["Gross sales", "gross"], ["Net sales", "net"], ["OneShetland keeps", "platform"]] as const).map(([name, key]) => (
                <div key={key}><dt className="inline font-semibold text-ink">{name}.</dt> <dd className="inline text-ink/70">{KPI_DEFINITIONS[key]}</dd></div>
              ))}
            </dl>
          </Card>

          <p className="mt-8 text-xs text-ink/40">Generated {overview.generated_at ? new Date(overview.generated_at).toLocaleString("en-GB") : ""}.</p>
        </>
      )}
    </>
  );
}

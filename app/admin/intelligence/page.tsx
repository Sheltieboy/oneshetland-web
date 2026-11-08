import Link from "next/link";
import { requireAdmin } from "@/lib/admin-data.server";
import { getAdminIntelOverview, getUsefulActions } from "@/lib/admin-intel.server";
import { getAnalyticsRevenue } from "@/lib/analytics-admin.server";
import { AdminHeader, Card } from "@/components/admin/AdminUI";
import { Freshness, OverviewView, MembersView, BusinessView, ContentView, CommercialView, HealthView } from "@/components/admin/IntelViews";
import { METRIC_DEFINITIONS, PERIODS, VIEWS, parsePeriod, parseView } from "@/lib/admin-intel";

export const dynamic = "force-dynamic";
export const metadata = { title: "Admin Intelligence" };

const href = (view: string, days: number) => `/admin/intelligence?view=${view}&days=${days}`;

export default async function IntelligencePage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireAdmin();
  const sp = await searchParams;
  const days = parsePeriod(sp.days);
  const view = parseView(sp.view);
  const [o, actions, revenue] = await Promise.all([getAdminIntelOverview(days), getUsefulActions(), view === "commercial" ? getAnalyticsRevenue(days) : Promise.resolve(null)]);

  return (
    <>
      <AdminHeader title="Admin Intelligence" sub="How OneShetland is doing, what members and businesses are doing, and what to do next." />

      {/* Controls: report tabs scroll sideways on a phone; the period applies to every report */}
      <div className="sticky top-0 z-20 -mx-5 mb-5 border-b border-line bg-cream/95 px-5 py-2 backdrop-blur">
        <nav aria-label="Reports" className="flex gap-1.5 overflow-x-auto pb-1 [scrollbar-width:none]">
          {VIEWS.map((v) => (
            <Link key={v.key} href={href(v.key, days)} aria-current={view === v.key ? "page" : undefined}
              className={"min-h-[44px] shrink-0 rounded-pill px-4 text-sm font-bold leading-[44px] " + (view === v.key ? "bg-navy text-paper" : "bg-paper text-ink-soft ring-1 ring-line hover:bg-sand")}>{v.label}</Link>
          ))}
        </nav>
        <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1">
          <div role="group" aria-label="Period" className="flex items-center gap-1 text-sm">
            <span className="mr-1 text-ink-muted">Last</span>
            {PERIODS.map((p) => <Link key={p} href={href(view, p)} aria-current={days === p ? "true" : undefined} className={"inline-flex min-h-[36px] min-w-[44px] items-center justify-center rounded-pill px-2 font-bold " + (days === p ? "bg-teal/20 text-ink ring-1 ring-teal" : "text-ink-soft hover:bg-sand")}>{p}d</Link>)}
          </div>
          {o && <Freshness o={o} />}
        </div>
      </div>

      {!o ? (
        <Card>
          <p className="font-bold text-ink">The intelligence reports are not available yet.</p>
          <p className="mt-1 text-sm text-ink-soft">The database functions behind this page (migration <code>20261231000000_admin_intelligence</code>) have not been applied, or the read failed. Nothing is estimated in their place. The older <Link className="underline" href="/admin/analytics">Analytics</Link> page still works.</p>
        </Card>
      ) : view === "overview" ? <OverviewView o={o} actions={actions} /> :
        view === "members" ? <MembersView o={o} /> :
        view === "business" ? <BusinessView o={o} /> :
        view === "content" ? <ContentView o={o} /> :
        view === "commercial" ? <CommercialView o={o} days={days} revenue={revenue} /> :
        <HealthView o={o} />}

      {o && (
        <div className="mt-8 space-y-3">
          {o.unavailable.length > 0 && (
            <details className="rounded-card border border-line bg-paper p-4">
              <summary className="min-h-[44px] cursor-pointer font-bold text-ink">Not measured yet ({o.unavailable.length})</summary>
              <p className="mt-1 text-sm text-ink-soft">These are not shown because there is no reliable data. They are never estimated.</p>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-ink-soft">{o.unavailable.map((u) => <li key={u}>{u}</li>)}</ul>
            </details>
          )}
          <details className="rounded-card border border-line bg-paper p-4">
            <summary className="min-h-[44px] cursor-pointer font-bold text-ink">How these figures are measured</summary>
            <dl className="mt-2 space-y-2 text-sm">{METRIC_DEFINITIONS.map((d) => <div key={d.term}><dt className="font-bold text-ink">{d.term}</dt><dd className="text-ink-soft">{d.def}</dd></div>)}</dl>
          </details>
        </div>
      )}
    </>
  );
}


import Link from "next/link";
import { requireBusinessOwner } from "@/lib/business-server";
import { getBusinessAnalytics } from "@/lib/analytics-business.server";
import { AnalyticsUnlock } from "@/components/business/AnalyticsUnlock";

export const dynamic = "force-dynamic";
export const metadata = { title: "Analytics" };

const gbp = (p: number) => new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format((p ?? 0) / 100);
const num = (n: number) => new Intl.NumberFormat("en-GB").format(n ?? 0);
const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-card border border-line-strong bg-paper p-4">
      <div className="text-2xl font-bold text-ink">{value}</div>
      <div className="mt-1 text-xs uppercase tracking-wide text-ink-soft">{label}</div>
    </div>
  );
}

export default async function BusinessAnalyticsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { business } = await requireBusinessOwner(id);
  const base = `/business/${business.id}/manage`;
  const data = await getBusinessAnalytics(business.id, 30);

  const b = data?.basic;
  const f = data?.full ?? null;
  const maxDay = Math.max(1, ...(f?.views_by_day ?? []).map((d) => d.views));
  const maxDow = Math.max(1, ...(f?.busiest_dow ?? []).map((d) => d.views));

  return (
    <div className="mx-auto max-w-4xl px-5 py-10 sm:py-12">
      <Link href={base} className="text-sm font-semibold text-ink-soft hover:text-ink">← Manage business</Link>
      <h1 className="mt-4 font-display text-3xl font-bold text-ink">Analytics</h1>
      <p className="mt-1 text-ink-soft">How people are finding and engaging with {business.name} — last 30 days.</p>

      {data?.is_admin_view && (
        <div className="mt-4 rounded-card border border-amber-300 bg-amber-50 px-4 py-2 text-sm text-amber-800">
          Admin view — showing full analytics regardless of add-on status.
        </div>
      )}

      {/* Free teaser — always shown */}
      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Profile views" value={num(b?.profile_views ?? 0)} />
        <Stat label="Unique viewers" value={num(b?.unique_viewers ?? 0)} />
        <Stat label="Followers" value={num(b?.followers ?? 0)} />
        <Stat label="Contact taps" value={num(b?.contacts ?? 0)} />
      </div>

      {f ? (
        <>
          {/* Views by day */}
          <h2 className="mb-3 mt-10 font-display text-xl font-bold text-ink">Profile views by day</h2>
          <div className="rounded-card border border-line-strong bg-paper p-4">
            <div className="flex h-36 items-end gap-1">
              {f.views_by_day.length === 0
                ? <p className="text-sm text-ink-soft">No views in this period yet.</p>
                : f.views_by_day.map((d) => (
                    <div key={d.day} className="flex-1 rounded-t bg-navy" style={{ height: `${(d.views / maxDay) * 100}%`, minHeight: 2 }} title={`${d.day}: ${d.views}`} />
                  ))}
            </div>
          </div>

          {/* Engagement funnel + contacts */}
          <div className="mt-6 grid gap-6 sm:grid-cols-2">
            <div>
              <h2 className="mb-3 font-display text-xl font-bold text-ink">Customer interest</h2>
              <div className="space-y-3 rounded-card border border-line-strong bg-paper p-4">
                <Row label="Profile views" value={num(b?.profile_views ?? 0)} />
                <Row label="Saved you" value={num(f.saves)} />
                <Row label="Tapped to contact" value={num(b?.contacts ?? 0)} />
                {f.contacts_by_method.map((c) => (
                  <Row key={c.method} label={`  ↳ ${c.method}`} value={num(c.count)} muted />
                ))}
                <Row label="Offer redemptions" value={num(f.offer_redemptions)} />
                <Row label="Loyalty stamps given" value={num(f.loyalty_stamps)} />
                <Row label="Loyalty rewards claimed" value={num(f.loyalty_rewards)} />
              </div>
            </div>

            <div>
              <h2 className="mb-3 font-display text-xl font-bold text-ink">Busiest days</h2>
              <div className="rounded-card border border-line-strong bg-paper p-4">
                {f.busiest_dow.length === 0 ? (
                  <p className="text-sm text-ink-soft">Not enough data yet.</p>
                ) : (
                  <div className="space-y-2">
                    {[...f.busiest_dow].sort((a, c) => a.dow - c.dow).map((d) => (
                      <div key={d.dow} className="flex items-center gap-3 text-sm">
                        <span className="w-10 text-ink-soft">{DOW[d.dow]}</span>
                        <span className="h-2.5 rounded bg-navy" style={{ width: `${(d.views / maxDow) * 100}%`, minWidth: 4 }} />
                        <span className="ml-auto font-semibold text-ink">{num(d.views)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Sales & revenue */}
          <h2 className="mb-3 mt-10 font-display text-xl font-bold text-ink">Sales <span className="text-sm font-normal text-ink-soft">(from your orders)</span></h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="Bookings" value={num(f.bookings)} />
            <Stat label="Booking deposits" value={gbp(f.booking_revenue_pence)} />
            <Stat label="Passes/units sold" value={num(f.unit_sales)} />
            <Stat label="Unit revenue" value={gbp(f.unit_revenue_pence)} />
            <Stat label="Tickets sold" value={num(f.tickets_sold)} />
            <Stat label="Ticket revenue" value={gbp(f.ticket_revenue_pence)} />
            <Stat label="Job applications" value={num(f.job_applications)} />
            <Stat label="Shift applications" value={num(f.shift_applications)} />
          </div>
        </>
      ) : (
        /* Upsell — full analytics behind the £10 add-on */
        <div className="mt-8 rounded-card border-2 border-navy bg-navy/[0.03] p-6 text-center">
          <h2 className="font-display text-2xl font-bold text-ink">Unlock full analytics</h2>
          <p className="mx-auto mt-2 max-w-md text-ink-soft">
            See views over time, your customer-interest funnel, busiest days, contact breakdown,
            sales &amp; revenue, loyalty performance and application numbers — everything you need to
            grow on OneShetland.
          </p>
          <p className="mt-4 text-3xl font-bold text-ink">£10<span className="text-base font-normal text-ink-soft">/month</span> <span className="text-sm font-normal text-ink-soft">· any plan, including free</span></p>
          <AnalyticsUnlock businessId={business.id} />
        </div>
      )}
    </div>
  );
}

function Row({ label, value, muted }: { label: string; value: string | number; muted?: boolean }) {
  return (
    <div className={"flex items-center justify-between text-sm " + (muted ? "text-ink-soft" : "text-ink")}>
      <span className="whitespace-pre">{label}</span>
      <span className="font-semibold">{value}</span>
    </div>
  );
}

import Link from "next/link";
import type { AnalyticsRevenue } from "@/lib/analytics-admin.server";
import { gbp, salesTotals, isWalletFloat } from "@/lib/analytics-format";
import { Card, Empty, StatusPill } from "@/components/admin/AdminUI";
import { IntelKpi, MiniBars, BarList, Panel, Facts } from "@/components/admin/IntelUI";
import { UsefulActions } from "@/components/admin/UsefulActions";
import { ago, isStale, num, pct, trendText, type Overview, type UsefulActionsPayload } from "@/lib/admin-intel";

/** The Admin Intelligence report bodies. Pure presentation of an Overview; data is fetched by the page. */

export function Freshness({ o }: { o: Overview }) {
  const stale = isStale(o.engagement.last_event_at, 72);
  return (
    <p className="text-xs text-ink-muted">
      Updated {ago(o.generated_at)}
      <span className="mx-1.5">·</span>
      Last analytics event {ago(o.engagement.last_event_at)}{stale && <> <StatusPill label="Quiet" tone="amber" /></>}
    </p>
  );
}

export function OverviewView({ o, actions }: { o: Overview; actions: UsefulActionsPayload | null }) {
  const d = o.days, m = o.members, b = o.businesses, e = o.engagement, c = o.content;
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <IntelKpi label="Members" value={m.total} hint={`${num(m.new_today)} today · ${num(m.new_7d)} this week · ${num(m.new_30d)} this month`} />
        <IntelKpi label={`New members (${d}d)`} value={m.new_period} cur={m.new_period} prev={m.new_prev} days={d} />
        <IntelKpi label="Active listings" value={b.active} hint={`${num(b.claimed)} claimed · ${num(b.unclaimed)} unclaimed (${pct(b.claimed, b.active)})`} />
        <IntelKpi label={`Listings claimed (${d}d)`} value={b.claimed_period} cur={b.claimed_period} prev={b.claimed_prev} days={d} />
        <IntelKpi label="Paid plans" value={o.commercial.paid_active} hint={`${num(o.commercial.claimed_free)} claimed businesses on free`} />
        <IntelKpi label="Upcoming events" value={c.events.upcoming} hint={`${num(c.events.next_14d)} in the next 14 days`} />
        <IntelKpi label="Open jobs" value={c.jobs.open} hint={`${num(c.jobs.new_period)} posted in ${d}d (${trendText(c.jobs.new_period, c.jobs.new_prev, d)})`} />
        <IntelKpi label="Active in the last week" value={e.wau} hint="tracked people who accepted analytics" />
      </div>

      {actions ? <UsefulActions actions={actions.actions} history={actions.history} generatedAt={actions.generated_at} showHistory initial={3} /> : (
        <Card><p className="text-sm text-ink-soft">Useful Actions are unavailable right now (the database functions are not applied or the read failed).</p></Card>
      )}

      <div className="grid gap-5 lg:grid-cols-2">
        <Panel title="Is OneShetland growing?" sub={`New members per day, last ${Math.min(d, 90)} days (UK days)`}>
          <MiniBars label="New members per day" data={m.signups_by_day.map((x) => ({ label: x.day.slice(5), value: x.n }))} />
          <p className="mt-2 text-sm font-semibold text-ink-soft">{num(m.new_period)} new members — {trendText(m.new_period, m.new_prev, d)}</p>
        </Panel>
        <Panel title="Are members coming back?" sub="Tracked activity only: people who accepted analytics, administrators excluded">
          <Facts rows={[
            { label: "Active today", value: num(e.dau) },
            { label: "Active this week", value: num(e.wau) },
            { label: "Active this month", value: num(e.mau) },
            { label: "Returning (this week and the one before)", value: num(e.returning_7d) },
            { label: "Stickiness (today ÷ month)", value: pct(e.dau, e.mau), note: "A rough guide while consent-based counts are small" },
          ]} />
        </Panel>
      </div>
    </div>
  );
}

export function MembersView({ o }: { o: Overview }) {
  const d = o.days, m = o.members, e = o.engagement, s = o.saved;
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <IntelKpi label="Members" value={m.total} hint={`${pct(m.verified_email, m.total)} verified their email`} />
        <IntelKpi label={`New (${d}d)`} value={m.new_period} cur={m.new_period} prev={m.new_prev} days={d} />
        <IntelKpi label={`Signed in (${d}d)`} value={m.signed_in_period} hint="a lower bound; see definitions" />
        <IntelKpi label="With push enabled" value={m.with_push} hint={pct(m.with_push, m.total) + " of members"} />
      </div>
      <Panel title="Registrations" sub="New members per day (UK days)"><MiniBars label="New members per day" data={m.signups_by_day.map((x) => ({ label: x.day.slice(5), value: x.n }))} /></Panel>
      <div className="grid gap-5 lg:grid-cols-2">
        <Panel title="What people look at" sub={`Content views (consented analytics), last ${d} days vs the previous ${d}`}>
          {e.content_views.length === 0 ? <Empty>No content views recorded in this period.</Empty> : (
            <ul className="divide-y divide-line">
              {e.content_views.map((v) => (
                <li key={v.type} className="py-2 text-sm"><div className="flex justify-between gap-3"><span className="font-semibold capitalize text-ink">{v.type.replace(/_/g, " ")}</span><span className="font-bold text-ink">{num(v.cur)}</span></div><p className="text-xs text-ink-muted">{trendText(v.cur, v.prev, d)}</p></li>
              ))}
            </ul>
          )}
        </Panel>
        <Panel title="Actions members take" sub="Tracked events only">
          <Facts rows={[
            { label: "Contact clicks (call, email, website)", value: num(e.contact_clicks.cur), note: trendText(e.contact_clicks.cur, e.contact_clicks.prev, d) },
            { label: "Searches", value: num(e.searches.cur), note: trendText(e.searches.cur, e.searches.prev, d) },
            { label: "Job applications", value: num(o.content.jobs.applications_period), note: trendText(o.content.jobs.applications_period, o.content.jobs.applications_prev, d) },
            { label: "Offers redeemed", value: num(o.content.offers.redemptions_period), note: trendText(o.content.offers.redemptions_period, o.content.offers.redemptions_prev, d) },
          ]} />
          <p className="mt-2 text-xs text-ink-muted">Web vs app: {Object.entries(e.by_platform).map(([k, v]) => `${k} ${num(v)}`).join(" · ") || "no events"}.</p>
        </Panel>
      </div>
      <Panel title="My Saved" sub="Counts only. No member, and no list of who saved what, is available here.">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <IntelKpi label="Members using it" value={s.members_with_saves} hint={s.adoption_pct === null ? undefined : `${s.adoption_pct}% of members`} />
          <IntelKpi label="Using it repeatedly" value={s.members_with_2plus} hint="2 or more saves" />
          <IntelKpi label="Total saves" value={s.total_saves} />
          <IntelKpi label={`New saves (${d}d)`} value={s.new_saves_period} cur={s.new_saves_period} prev={s.new_saves_prev} days={d} />
        </div>
        <div className="mt-3"><BarList rows={Object.entries(s.by_type).map(([k, v]) => ({ label: k, value: v })).sort((a, b) => b.value - a.value)} empty="Nothing saved yet." /></div>
      </Panel>
    </div>
  );
}

export function BusinessView({ o }: { o: Overview }) {
  const d = o.days, b = o.businesses, cp = b.completeness;
  const tiers = Object.entries(b.tiers).map(([label, value]) => ({ label, value })).sort((a, b2) => b2.value - a.value);
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <IntelKpi label="Active listings" value={b.active} hint={`${num(b.new_period)} new in ${d}d (${trendText(b.new_period, b.new_prev, d)})`} />
        <IntelKpi label="Claimed" value={b.claimed} hint={pct(b.claimed, b.active) + " of listings"} />
        <IntelKpi label="Unclaimed" value={b.unclaimed} />
        <IntelKpi label="Claims waiting" value={b.claims_pending} goodWhen="down" hint={`${num(b.claims_submitted_period)} sent · ${num(b.claims_approved_period)} approved · ${num(b.claims_rejected_period)} rejected (${d}d)`} />
      </div>
      <div className="grid gap-5 lg:grid-cols-2">
        <Panel title="Free vs paid" sub="All active listings, by plan"><BarList rows={tiers} /></Panel>
        <Panel title="Most represented categories"><BarList rows={b.categories.map((x) => ({ label: x.category.replace(/_/g, " "), value: x.n }))} /></Panel>
      </div>
      <Panel title="Listing completeness" sub={`Claimed listings only (${num(cp.total)}). “Complete” = a real description, a logo and a way to contact them.`}>
        <Facts rows={[
          { label: "Complete", value: `${num(cp.complete_all)} (${pct(cp.complete_all, cp.total)})` },
          { label: "Real description (40+ characters)", value: pct(cp.with_description, cp.total) },
          { label: "Logo", value: pct(cp.with_logo, cp.total) },
          { label: "Cover photo", value: pct(cp.with_cover, cp.total) },
          { label: "Contact route (phone, website or email)", value: pct(cp.with_contact, cp.total) },
          { label: "Opening hours", value: pct(cp.with_hours, cp.total) },
        ]} />
        <p className="mt-2 text-sm"><Link className="font-bold text-teal-700 underline" href="/admin/claims">Open the claims queue →</Link></p>
      </Panel>
      <Panel title="What businesses publish" sub={`Created in the last ${d} days`}>
        <Facts rows={[
          { label: "Events by businesses", value: num(b.published_by_businesses.events_period) },
          { label: "Offers", value: num(b.published_by_businesses.offers_period) },
          { label: "Jobs", value: num(b.published_by_businesses.jobs_period) },
          { label: "Businesses that published anything in 60 days", value: num(b.published_by_businesses.businesses_publishing_60d) },
        ]} />
      </Panel>
    </div>
  );
}

export function ContentView({ o }: { o: Overview }) {
  const d = o.days, c = o.content;
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <IntelKpi label="Upcoming events" value={c.events.upcoming} hint={`${num(c.events.new_period)} added in ${d}d (${trendText(c.events.new_period, c.events.new_prev, d)})`} />
        <IntelKpi label="Regular activities" value={c.activities.published} hint={`${num(c.activities.new_period)} new in ${d}d`} />
        <IntelKpi label="Open jobs" value={c.jobs.open} hint={`${num(c.jobs.closing_7d)} closing within 7 days · ${num(c.jobs.new_period)} posted in ${d}d`} />
        <IntelKpi label="Live notices" value={c.notices.live} hint={`${num(c.notices.new_period)} new in ${d}d`} />
        <IntelKpi label="Active hubs" value={c.hubs.active} hint={`${num(c.hubs.publishing_60d)} published in 60 days`} />
        <IntelKpi label="Active offers" value={c.offers.active} hint={`${num(c.offers.expiring_7d)} ending within 7 days`} />
        <IntelKpi label="Open shifts" value={c.shifts.open_upcoming} hint={c.shifts.positions_total > 0 ? `${pct(c.shifts.positions_filled, c.shifts.positions_total)} of positions filled (${d}d)` : undefined} />
        <IntelKpi label="Cancelled / postponed" value={c.events.cancelled_upcoming} goodWhen="down" hint="upcoming events" />
      </div>
      <div className="grid gap-5 lg:grid-cols-2">
        <Panel title="Upcoming events by category"><BarList rows={c.events.by_category.map((x) => ({ label: x.category.replace(/_/g, " "), value: x.n }))} empty="No upcoming events." /></Panel>
        <Panel title="Upcoming events by area" sub="From the event's stated locality; “unspecified” means none was given"><BarList rows={c.events.by_locality.map((x) => ({ label: x.locality, value: x.n }))} empty="No upcoming events." /></Panel>
        <Panel title="Notices by category"><BarList rows={c.notices.by_category.map((x) => ({ label: x.category.replace(/_/g, " "), value: x.n }))} empty="No live notices." /></Panel>
        <Panel title="Jobs and shifts" sub="Engagement is limited to what is recorded">
          <Facts rows={[
            { label: "Jobs posted", value: num(c.jobs.new_period), note: trendText(c.jobs.new_period, c.jobs.new_prev, d) },
            { label: "Applications", value: num(c.jobs.applications_period), note: trendText(c.jobs.applications_period, c.jobs.applications_prev, d) },
            { label: "Open past their expiry", value: num(c.jobs.expired_still_open) },
            { label: "Offer redemptions", value: num(c.offers.redemptions_period), note: trendText(c.offers.redemptions_period, c.offers.redemptions_prev, d) },
            { label: "Businesses with an active offer", value: num(c.offers.businesses_with_active_offer) },
            { label: "Event submissions awaiting review", value: num(c.events.submissions_pending) },
          ]} />
        </Panel>
      </div>
    </div>
  );
}

export function CommercialView({ o, days, revenue }: { o: Overview; days: number; revenue: AnalyticsRevenue | null }) {
  const k = o.commercial;
  const streams = (revenue?.streams ?? []).filter((r) => !isWalletFloat(r) && (r.orders ?? 0) > 0);
  const sales = revenue?.totals ?? null;
  const fallback = salesTotals(streams);
  const tiers = Object.entries(k.paid_by_tier).map(([label, value]) => ({ label, value }));
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <IntelKpi label="Paid plans" value={k.paid_active} />
        <IntelKpi label="Ending soon" value={k.cancelling} goodWhen="down" hint="cancelled; end at period close" />
        <IntelKpi label="Free, claimed" value={k.claimed_free} hint="the conversion pool" />
        <IntelKpi label="Free → paid" display={pct(k.paid_active, k.paid_active + k.claimed_free)} hint="paid ÷ (paid + claimed free), today" />
      </div>
      <Panel title="Plans" sub="Counts from each business's current plan"><BarList rows={tiers} empty="No paid plans." /></Panel>
      <Panel title={`Sales, last ${days} days`} sub="From the payment ledgers. Gross is what customers paid; net is after refunds. Wallet top-ups are customer funds, not revenue.">
        {!revenue ? <p className="text-sm text-ink-muted">Revenue could not be read.</p> : (
          <Facts rows={[
            { label: "Gross sales", value: gbp(sales?.gross_pence ?? fallback.gross) },
            { label: "Refunded", value: gbp(sales?.refunded_pence ?? fallback.refunded) },
            { label: "Net sales", value: gbp(sales?.net_pence ?? fallback.net) },
            { label: "Orders", value: num(sales?.orders ?? fallback.orders) },
            ...(revenue.subscriptions ? [{ label: "Estimated monthly subscription revenue", value: gbp(revenue.subscriptions.est_mrr_pence), note: "At list price; excludes complimentary plans and discounts" }] : []),
          ]} />
        )}
        <p className="mt-2 text-sm"><Link className="font-bold text-teal-700 underline" href="/admin/analytics">Full revenue breakdown →</Link></p>
      </Panel>
      <Card>
        <p className="text-sm font-bold text-ink">Not available: upgrades, downgrades and churn over time.</p>
        <p className="mt-1 text-sm text-ink-soft">The database stores only each business&apos;s current plan, with no history of changes, so these cannot be measured without inventing figures. See the Useful Actions list for plans ending soon.</p>
      </Card>
      {k.lapsed_unreconciled > 0 && <Card><p className="text-sm font-bold text-rose-700">{k.lapsed_unreconciled} business(es) show a paid plan whose period ended over 2 days ago. Check Stripe and the webhook.</p></Card>}
    </div>
  );
}

export function HealthView({ o }: { o: Overview }) {
  const h = o.health, d = o.days;
  const sync = h.job_sync_last;
  const syncBad = sync && (!sync.ok || isStale(sync.ran_at, 8));
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <IntelKpi label="Claims waiting" value={h.pending_claims} goodWhen="down" />
        <IntelKpi label="Event submissions waiting" value={h.pending_event_submissions} goodWhen="down" />
        <IntelKpi label="Open reports" value={h.open_reports} goodWhen="down" />
        <IntelKpi label="Failed emails" value={h.email_failed_period} goodWhen="down" hint={`of ${num(h.email_sent_period + h.email_failed_period)} sent in ${d}d`} />
      </div>
      <Panel title="Systems" sub="Only signals that are actually logged">
        <Facts rows={[
          { label: "Council jobs sync", value: sync ? `${sync.ok ? "OK" : "FAILED"} · ${ago(sync.ran_at)}` : "no runs recorded", note: syncBad ? "Overdue or failed: check it" : `${num(h.job_sync_failed_7d)} failed run(s) in 7 days` },
          { label: "Push notifications", value: `${num(h.push_sent_period)} sent · ${num(h.push_errors_period)} errors`, note: `last ${d} days` },
          { label: "Emails", value: `${num(h.email_sent_period)} sent · ${num(h.email_failed_period)} failed or bounced`, note: `last ${d} days` },
          { label: "Analytics events", value: ago(o.engagement.last_event_at), note: isStale(o.engagement.last_event_at, 72) ? "No recent events: check the consent banner and ingestion" : "Receiving events" },
        ]} />
      </Panel>
      <Card><p className="text-sm text-ink-soft">Not monitored here yet: failed publishing operations, import failures and errors inside user journeys. They are not logged anywhere this dashboard can read, so no alert is shown for them.</p></Card>
    </div>
  );
}

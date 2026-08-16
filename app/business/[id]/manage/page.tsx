import Link from "next/link";
import { requireBusinessOwner } from "@/lib/business-server";
import { getMyManagedBusinesses } from "@/lib/business-data.server";
import { BIZ, TIER_LABELS, tierMeets } from "@/lib/business-data";
import { getDashboardData } from "@/lib/business-dashboard.server";
import { DashboardTop, AvailabilityChip } from "@/components/business/DashboardTop";

export const dynamic = "force-dynamic";
export const metadata = { title: "Manage business" };

/**
 * Twenty tiles in one flat list is a menu, not a dashboard — everything looked
 * equally important, so nothing was. They're grouped by what you came to do:
 * serving somebody now, money, being found, selling, hiring.
 */
type Group = "Serving" | "Money" | "Being found" | "Selling" | "People";
type Tile = { href: string; icon: string; title: string; desc: string; group: Group; locked?: boolean; built?: boolean };

const GROUP_ORDER: Group[] = ["Serving", "Money", "Being found", "Selling", "People"];

export default async function ManageBusinessPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { business, account } = await requireBusinessOwner(id);
  const dashboard = await getDashboardData(business.id);
  const mine = await getMyManagedBusinesses(account.id);
  const base = `/business/${business.id}/manage`;
  const pro = tierMeets(business.subscription_tier, "pro");
  const premium = tierMeets(business.subscription_tier, "premium");

  const tiles: Tile[] = [
    // Serving comes before managing — it's the thing done many times a day.
    { href: `${base}/counter`, group: "Serving", icon: "🧾", title: "Counter mode", desc: "Full-screen serving view · lockable with a staff PIN", built: true },
    { href: `${base}/billing`, group: "Money", icon: "💳", title: "Plan, payments & payouts", desc: "Subscription, business card & bank, NFC", built: true },
    { href: `${base}/profile`, group: "Being found", icon: "🏪", title: "Profile & branding", desc: "Name, description, photos, hours, links", built: true },
    { href: `${base}/analytics`, group: "Being found", icon: "📊", title: "Analytics", desc: "Views, engagement & revenue", locked: !pro, built: true },
    { href: `${base}/offers`, group: "Being found", icon: "🏷️", title: "Offers", desc: "Time-limited deals", locked: !pro, built: true },
    { href: `${base}/loyalty`, group: "Serving", icon: "📇", title: "Loyalty programme", desc: "Stamps or points", locked: !pro, built: true },
    { href: `${base}/wallet`, group: "Money", icon: "💷", title: "Local Wallet", desc: "Accept payments, cashback, receipts", locked: !pro, built: true },
    { href: `${base}/transactions`, group: "Money", icon: "📒", title: "Money & transactions", desc: "Full statement · export for accounts", built: true },
    { href: `${base}/alerts`, group: "Being found", icon: "📣", title: "Urgent alerts", desc: "Broadcast across OneShetland · approval needed", locked: !premium, built: true },
    { href: `${base}/bookings`, group: "Serving", icon: "📅", title: "Bookings", desc: "Incoming appointments", locked: !premium, built: true },
    { href: `${base}/services`, group: "Serving", icon: "✂️", title: "Services", desc: "What people can book", locked: !premium, built: true },
    { href: `${base}/schedule`, group: "Serving", icon: "🗓️", title: "Availability", desc: "Weekly hours & overrides", locked: !premium, built: true },
    { href: `${base}/passes`, group: "Selling", icon: "🎟️", title: "Passes & packs", desc: "Coffee cards, class packs, day passes", locked: !premium, built: true },
    { href: `${base}/products`, group: "Selling", icon: "🛍️", title: "Products", desc: "Sell across OneShetland — 5% per sale", locked: !premium, built: true },
    { href: `${base}/orders`, group: "Selling", icon: "📦", title: "Shop orders", desc: "Incoming orders — accept, post, complete", locked: !premium, built: true },
    { href: `${base}/jobs`, group: "People", icon: "💼", title: "Jobs", desc: "Post roles, take applications", built: true },
    // Deliberately NOT tier-locked. A free listing that never rings is why
    // nobody claims theirs, and the trades most worth reaching are the ones
    // nobody has heard of — locking them out would defeat the whole point.
    { href: `${base}/leads`, group: "People", icon: "🔧", title: "Job leads", desc: "Folk looking for a tradesperson · say what you cover and when", built: true },
    { href: `${base}/events`, group: "Selling", icon: "🎫", title: "Events", desc: "Create & manage ticketed events", built: true },
    { href: `/directory/${business.slug || business.id}`, icon: "👁️", title: "View public profile", desc: "See your listing as customers do", group: "Being found", built: true },
  ];

  return (
    <div className="mx-auto max-w-6xl px-5 py-10 sm:py-12">
      <Link href="/account" className="text-sm font-semibold text-ink-soft hover:text-ink">← Account</Link>

      {mine.length > 1 && (
        <div className="mt-4 -mx-5 flex gap-2 overflow-x-auto px-5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {mine.map((b) => (
            <Link key={b.id} href={`/business/${b.id}/manage`} className={"shrink-0 rounded-pill px-4 py-2 text-sm font-semibold transition " + (b.id === business.id ? "text-white" : "border border-line-strong text-ink-soft hover:bg-sand")} style={b.id === business.id ? { background: BIZ } : undefined}>{b.name}</Link>
          ))}
        </div>
      )}

      <div className="mt-4 mb-8 flex items-center gap-4">
        {business.logo_url
          ? <img src={business.logo_url} alt="" className="h-14 w-14 rounded-xl object-cover" />
          : <span className="grid h-14 w-14 place-items-center rounded-xl text-2xl text-white" style={{ background: BIZ }}>{business.name[0]}</span>}
        <div>
          <h1 className="font-display text-3xl font-bold sm:text-4xl">{business.name}</h1>
          <p className="mt-0.5 text-sm font-semibold" style={{ color: BIZ }}>{TIER_LABELS[business.subscription_tier]} plan{business.is_verified ? " · Verified ✓" : ""}</p>
        </div>
        <div className="ml-auto"><AvailabilityChip data={dashboard} base={base} /></div>
      </div>

      {/* The dashboard proper: what needs you, how the week went, the code. */}
      <div className="mb-8"><DashboardTop data={dashboard} base={base} /></div>

      {!premium && (
        <div className="mb-8 flex flex-wrap items-center justify-between gap-3 rounded-card border-2 p-5 shadow-soft" style={{ borderColor: `${BIZ}33`, background: `${BIZ}08` }}>
          <div>
            <p className="font-display text-lg font-bold text-ink">
              {business.subscription_tier === "free" ? "Unlock more with Pro or Premium" : "Go Premium for the full toolkit"}
            </p>
            <p className="mt-0.5 text-sm text-ink-soft">
              {business.subscription_tier === "free"
                ? "Add offers, a loyalty card, Local Wallet payments, bookings and a featured homepage spot."
                : "Add in-app bookings, sell passes & tickets, and a featured spot on the home screen."}
            </p>
          </div>
          <Link href={`${base}/billing`} className="shrink-0 rounded-pill px-5 py-2.5 text-sm font-bold text-white shadow-soft transition hover:brightness-110" style={{ background: BIZ }}>
            {business.subscription_tier === "free" ? "See plans & upgrade" : "Upgrade to Premium"}
          </Link>
        </div>
      )}

      {GROUP_ORDER.map((group) => {
        const inGroup = tiles.filter((t) => t.group === group);
        if (inGroup.length === 0) return null;
        return (
          <section key={group} className="mb-8">
            <h2 className="eyebrow mb-2 text-ink-muted">{group}</h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {inGroup.map((t) => {
                const dim = t.locked || !t.built;
                const inner = (
                  <div className={"flex h-full items-start gap-3 rounded-card border border-line bg-paper p-4 shadow-soft transition " + (dim ? "opacity-60" : "hover:-translate-y-0.5 hover:shadow-lift")}>
                    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg text-xl" style={{ background: `${BIZ}1a` }}>{t.icon}</span>
                    <div className="min-w-0">
                      <p className="font-bold text-ink">{t.title} {t.locked && <span className="rounded-pill bg-sand px-2 py-0.5 text-[11px] font-semibold text-ink-muted align-middle">{business.subscription_tier === "free" ? "Pro" : "Premium"}</span>}</p>
                      <p className="text-sm text-ink-muted">{t.desc}{!t.built && !t.locked ? " · coming soon" : ""}</p>
                    </div>
                  </div>
                );
                return t.built && !t.locked
                  ? <Link key={t.title} href={t.href} className="block">{inner}</Link>
                  : <div key={t.title}>{t.locked ? <Link href={`${base}/billing`} className="block">{inner}</Link> : inner}</div>;
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}

import Link from "next/link";
import { requireBusinessOwner } from "@/lib/business-server";
import { getMyManagedBusinesses, getBusinessAddons } from "@/lib/business-data.server";
import { BIZ, TIER_LABELS, tierMeets } from "@/lib/business-data";

export const dynamic = "force-dynamic";
export const metadata = { title: "Manage business · OneShetland" };

type Tile = { href: string; icon: string; title: string; desc: string; locked?: boolean; built?: boolean };

export default async function ManageBusinessPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { business, account } = await requireBusinessOwner(id);
  const [mine, addons] = await Promise.all([getMyManagedBusinesses(account.id), getBusinessAddons(business.id)]);
  const base = `/business/${business.id}/manage`;
  const enabled = (k: string) => addons.find((a) => a.addon_key === k)?.enabled;
  const pro = tierMeets(business.subscription_tier, "pro");
  const premium = tierMeets(business.subscription_tier, "premium");

  const tiles: Tile[] = [
    { href: `${base}/billing`, icon: "💳", title: "Plan, payments & payouts", desc: "Subscription, business card & bank, NFC", built: true },
    { href: `${base}/profile`, icon: "🏪", title: "Profile & branding", desc: "Name, description, photos, hours, links", built: true },
    { href: `${base}/addons`, icon: "🧩", title: "Add-ons & features", desc: "Turn features on and off", built: true },
    { href: `${base}/offers`, icon: "🏷️", title: "Offers", desc: "Time-limited deals", locked: !pro, built: true },
    { href: `${base}/loyalty`, icon: "📇", title: "Loyalty programme", desc: "Stamps or points", locked: !pro, built: true },
    { href: `${base}/wallet`, icon: "💷", title: "Local Wallet", desc: "Accept payments, cashback, receipts", locked: !pro, built: true },
    { href: `${base}/alerts`, icon: "📣", title: "Urgent alerts", desc: "Broadcast across OneShetland", built: true },
    { href: `${base}/bookings`, icon: "📅", title: "Bookings", desc: "Services & appointments", locked: !premium, built: true },
    { href: "/jobs/new", icon: "💼", title: "Jobs", desc: "Post roles, take applications", built: !!enabled("jobs") },
    { href: `/directory/${business.slug || business.id}`, icon: "👁️", title: "View public profile", desc: "See your listing as customers do", built: true },
  ];

  return (
    <div className="mx-auto max-w-4xl px-5 py-10 sm:py-12">
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
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {tiles.map((t) => {
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
    </div>
  );
}

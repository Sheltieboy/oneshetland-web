import Link from "next/link";
import { getAccount } from "@/lib/auth";
import { getMyBusinessesBasic } from "@/lib/account-data.server";

export const dynamic = "force-dynamic";

export default async function AccountOverview() {
  const account = (await getAccount())!; // layout guarantees signed-in
  const p = account.profile;
  const businesses = await getMyBusinessesBasic(account.id);

  // Profile completeness
  const fields = [p?.display_name || p?.full_name, p?.bio, p?.location_area, p?.avatar_url];
  const filled = fields.filter(Boolean).length;
  const pct = Math.round((filled / fields.length) * 100);

  const cards = [
    { href: "/account/profile", title: "Edit profile", desc: "Name, bio, photo, area and games handle" },
    { href: "/account/notifications", title: "Notifications", desc: "Choose what you're told about, and quiet hours" },
    { href: "/account/security", title: "Security", desc: "Email and password" },
    { href: "/account/memberships", title: "Memberships", desc: "Your digital hub membership cards" },
    { href: "/account/hubs", title: "My hubs", desc: "Groups and committees you run or belong to" },
    { href: "/games/stats", title: "Game stats", desc: "Your XP, streaks and leaderboard places" },
  ];

  return (
    <div className="space-y-8">
      <h1 className="font-display text-3xl font-bold text-ink">Overview</h1>

      {/* Completeness */}
      {pct < 100 && (
        <Link href="/account/profile" className="block rounded-card border border-line bg-paper p-5 shadow-soft transition hover:shadow-lift">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="font-display font-bold text-ink">Finish your profile</p>
              <p className="text-sm text-ink-muted">A complete profile helps employers, hubs and neighbours recognise you.</p>
            </div>
            <span className="font-display text-2xl font-bold text-ink">{pct}%</span>
          </div>
          <div className="mt-3 h-2 overflow-hidden rounded-pill bg-sand"><div className="h-full rounded-pill bg-navy" style={{ width: `${pct}%` }} /></div>
        </Link>
      )}

      {/* Quick cards */}
      <div className="grid gap-3 sm:grid-cols-2">
        {cards.map((c) => (
          <Link key={c.href} href={c.href} className="rounded-card border border-line bg-paper p-5 shadow-soft transition hover:-translate-y-0.5 hover:shadow-lift">
            <p className="font-display font-bold text-ink">{c.title}</p>
            <p className="mt-0.5 text-sm text-ink-muted">{c.desc}</p>
          </Link>
        ))}
      </div>

      {/* Businesses */}
      {businesses.length > 0 && (
        <section>
          <h2 className="mb-3 font-display text-xl font-bold text-ink">Your businesses</h2>
          <div className="space-y-2">
            {businesses.map((b) => (
              <Link key={b.id} href={`/business/${b.id}/manage`} className="flex items-center gap-3 rounded-card border border-line bg-paper px-4 py-3 shadow-soft transition hover:bg-sand">
                <div className="h-9 w-9 overflow-hidden rounded-lg bg-sand">{b.logo_url && <img src={b.logo_url} alt="" className="h-full w-full object-cover" />}</div>
                <span className="flex-1 font-semibold text-ink">{b.name}</span>
                <span className="text-sm font-semibold text-ink-faint">Manage →</span>
              </Link>
            ))}
            <Link href="/directory/new" className="inline-block text-sm font-semibold text-ink-soft hover:underline">+ Add another business</Link>
          </div>
        </section>
      )}

      {/* Payments & banking — central card + payout setup */}
      <Link href="/account/payments" className="block rounded-card border border-line bg-paper p-5 shadow-soft transition hover:shadow-lift">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-display text-xl font-bold text-ink">Payments & banking</h2>
          <span className="text-ink-faint">Manage →</span>
        </div>
        <p className="mt-1 text-sm text-ink-muted">
          One card for everything you pay for, one bank account for everything you&apos;re paid.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <span className="rounded-pill bg-sand px-3 py-1 text-sm font-semibold text-ink-soft">Payment card: {(p as { has_payment_method?: boolean })?.has_payment_method ? "added ✓" : "not set up"}</span>
          <span className="rounded-pill bg-sand px-3 py-1 text-sm font-semibold text-ink-soft">Payouts: {(p as { stripe_payouts_enabled?: boolean })?.stripe_payouts_enabled ? "connected ✓" : "not connected"}</span>
        </div>
      </Link>
    </div>
  );
}

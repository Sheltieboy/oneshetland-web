import Link from "next/link";
import { getAdminStats } from "@/lib/admin-data.server";
import { AdminHeader, StatCard } from "@/components/admin/AdminUI";

export const dynamic = "force-dynamic";

const QUEUES = [
  { href: "/admin/drivers", label: "Driver approvals", key: "pendingDrivers", desc: "Review pending driver applications" },
  { href: "/admin/events", label: "Event approvals", key: "pendingEvents", desc: "Approve hub events for the islands calendar" },
  { href: "/admin/claims", label: "Business claims", key: "pendingClaims", desc: "Verify directory ownership claims" },
  { href: "/admin/vessel-photos", label: "Vessel photos", key: "pendingVesselPhotos", desc: "Approve community photos for boat galleries" },
  { href: "/admin/boats", label: "New boats", key: "pendingVesselSubmissions", desc: "Approve community-submitted boats (hulls)" },
  { href: "/admin/alerts", label: "Alert access", key: "pendingAlerts", desc: "Approve urgent-alert add-on requests" },
  { href: "/admin/spik", label: "Spik suggestions", key: "pendingSpik", desc: "Review community dictionary suggestions" },
] as const;

const TOOLS = [
  { href: "/admin/analytics", label: "Analytics", desc: "Behaviour, conversions and revenue across the platform" },
  { href: "/admin/operations", label: "Operations", desc: "Delivery requests, runs, payments, disputes" },
  { href: "/admin/compliance", label: "Compliance log", desc: "Search a user's consent & verification record" },
  { href: "/admin/email", label: "Email centre", desc: "Templates, footer and the delivery log" },
  { href: "/admin/config", label: "Configuration", desc: "Fees, Stripe price IDs, feature flags" },
  { href: "/admin/regions", label: "Regions", desc: "Manage Shetland delivery areas" },
];

export default async function AdminDashboard() {
  const s = await getAdminStats();
  const counts: Record<string, number> = s as unknown as Record<string, number>;

  return (
    <>
      <AdminHeader title="Dashboard" sub="Everything that needs your attention across OneShetland." />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Total users" value={s.users} />
        <StatCard label="Pending drivers" value={s.pendingDrivers} alert />
        <StatCard label="Open requests" value={s.openRequests} />
        <StatCard label="Active runs" value={s.activeRuns} />
      </div>

      <h2 className="mb-3 mt-10 font-display text-xl font-bold text-ink">Needs review</h2>
      <div className="grid gap-3 sm:grid-cols-2">
        {QUEUES.map((q) => {
          const n = counts[q.key] ?? 0;
          return (
            <Link key={q.href} href={q.href} className="flex items-center gap-4 rounded-card border border-line bg-paper p-4 shadow-soft transition hover:-translate-y-0.5 hover:shadow-lift">
              <span className={"grid h-11 w-11 shrink-0 place-items-center rounded-full font-display text-lg font-bold " + (n > 0 ? "bg-rose-100 text-rose-700" : "bg-sand text-ink-muted")}>{n}</span>
              <div className="min-w-0 flex-1">
                <p className="font-display font-bold text-ink">{q.label}</p>
                <p className="text-sm text-ink-muted">{q.desc}</p>
              </div>
              <span className="text-ink-faint">→</span>
            </Link>
          );
        })}
      </div>

      <h2 className="mb-3 mt-10 font-display text-xl font-bold text-ink">Tools</h2>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {TOOLS.map((t) => (
          <Link key={t.href} href={t.href} className="rounded-card border border-line bg-paper p-4 shadow-soft transition hover:-translate-y-0.5 hover:shadow-lift">
            <p className="font-display font-bold text-ink">{t.label}</p>
            <p className="mt-0.5 text-sm text-ink-muted">{t.desc}</p>
          </Link>
        ))}
      </div>
    </>
  );
}

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV: { group: string; items: { href: string; label: string; badgeKey?: string }[] }[] = [
  { group: "Overview", items: [{ href: "/admin", label: "Dashboard" }] },
  { group: "Fetch", items: [
    { href: "/admin/drivers", label: "Driver approvals", badgeKey: "pendingDrivers" },
    { href: "/admin/operations", label: "Operations" },
  ] },
  { group: "Community", items: [
    { href: "/admin/events", label: "Event approvals", badgeKey: "pendingEvents" },
    { href: "/admin/claims", label: "Business claims", badgeKey: "pendingClaims" },
    { href: "/admin/reports", label: "Reports", badgeKey: "openReports" },
    { href: "/admin/vessel-photos", label: "Vessel photos", badgeKey: "pendingVesselPhotos" },
    { href: "/admin/alerts", label: "Alerts", badgeKey: "pendingAlerts" },
    { href: "/admin/spik", label: "Spik suggestions", badgeKey: "pendingSpik" },
  ] },
  { group: "Platform", items: [
    { href: "/admin/homepage", label: "Homepage" },
    { href: "/admin/compliance", label: "Compliance log" },
    { href: "/admin/email", label: "Email centre" },
    { href: "/admin/config", label: "Configuration" },
    { href: "/admin/regions", label: "Regions" },
  ] },
];

export function AdminSidebar({ badges }: { badges: Record<string, number> }) {
  const path = usePathname();
  return (
    <nav className="space-y-6">
      {NAV.map((g) => (
        <div key={g.group}>
          <p className="mb-2 px-3 text-xs font-bold uppercase tracking-widest text-ink-faint">{g.group}</p>
          <div className="space-y-0.5">
            {g.items.map((it) => {
              const active = path === it.href || (it.href !== "/admin" && path.startsWith(it.href));
              const n = it.badgeKey ? badges[it.badgeKey] ?? 0 : 0;
              return (
                <Link key={it.href} href={it.href}
                  className={"flex items-center justify-between rounded-lg px-3 py-2 text-sm font-semibold transition " + (active ? "bg-rose-600 text-white" : "text-ink-soft hover:bg-sand")}>
                  <span>{it.label}</span>
                  {n > 0 && <span className={"ml-2 rounded-pill px-2 py-0.5 text-xs font-bold " + (active ? "bg-white/25 text-white" : "bg-rose-100 text-rose-700")}>{n}</span>}
                </Link>
              );
            })}
          </div>
        </div>
      ))}
    </nav>
  );
}

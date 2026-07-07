import Link from "next/link";
import { requireAdmin, getAdminStats } from "@/lib/admin-data.server";
import { AdminSidebar } from "@/components/admin/AdminSidebar";

export const dynamic = "force-dynamic";
export const metadata = { title: "Admin · OneShetland" };

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin();
  const stats = await getAdminStats();
  const badges: Record<string, number> = {
    pendingDrivers: stats.pendingDrivers, pendingEvents: stats.pendingEvents,
    pendingClaims: stats.pendingClaims, pendingAlerts: stats.pendingAlerts, pendingSpik: stats.pendingSpik,
    openReports: stats.openReports, pendingVesselPhotos: stats.pendingVesselPhotos,
  };

  return (
    <div className="min-h-screen bg-cream">
      <div className="border-b border-line bg-navy">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-3">
          <div className="flex items-center gap-2">
            <span className="rounded-pill bg-rose-600 px-2.5 py-1 text-xs font-bold text-white">ADMIN</span>
            <span className="font-display text-lg font-bold text-white">OneShetland control</span>
          </div>
          <Link href="/account" className="text-sm font-semibold text-white/80 hover:text-white">← Back to account</Link>
        </div>
      </div>
      <div className="mx-auto max-w-6xl gap-8 px-5 py-8 lg:flex">
        <aside className="mb-6 shrink-0 lg:mb-0 lg:w-60">
          <AdminSidebar badges={badges} />
        </aside>
        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </div>
  );
}

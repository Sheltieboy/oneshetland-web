import Link from "next/link";
import { requireBusinessOwner } from "@/lib/business-server";
import { getAlertAccess, getBusinessAlerts } from "@/lib/business-data.server";
import { AlertsManager } from "@/components/business/AlertsManager";

export const dynamic = "force-dynamic";
export const metadata = { title: "Urgent alerts" };

export default async function AlertsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { business } = await requireBusinessOwner(id);
  const [access, alerts] = await Promise.all([getAlertAccess(business.id), getBusinessAlerts(business.id)]);
  return (
    <div className="mx-auto max-w-2xl px-5 py-10 sm:py-12">
      <Link href={`/business/${business.id}/manage`} className="text-sm font-semibold text-ink-soft hover:text-ink">← {business.name}</Link>
      <h1 className="mt-3 mb-6 font-display text-3xl font-bold sm:text-4xl">Urgent alerts</h1>
      <AlertsManager businessId={business.id} businessName={business.name} access={access} alerts={alerts} />
    </div>
  );
}

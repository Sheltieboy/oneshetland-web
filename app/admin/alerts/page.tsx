import { getAlertRequests, getLiveAlerts } from "@/lib/admin-data.server";
import { AdminHeader } from "@/components/admin/AdminUI";
import { AlertsManager } from "@/components/admin/AlertsManager";

export const dynamic = "force-dynamic";

export default async function Page() {
  const [requests, alerts] = await Promise.all([getAlertRequests(), getLiveAlerts()]);
  return (
    <>
      <AdminHeader title="Alerts" sub="Approve urgent-alert access and oversee live partner alerts." />
      <AlertsManager requests={requests as never[]} alerts={alerts as never[]} />
    </>
  );
}

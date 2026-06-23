import { getAdminConfig } from "@/lib/admin-data.server";
import { AdminHeader, Empty } from "@/components/admin/AdminUI";
import { ConfigEditor } from "@/components/admin/ConfigEditor";

export const dynamic = "force-dynamic";

export default async function Page() {
  const rows = await getAdminConfig();
  return (
    <>
      <AdminHeader title="Configuration" sub="Non-secret platform settings — fees, Stripe price IDs and feature flags." />
      {rows.length === 0 ? <Empty>No editable configuration found.</Empty> : <ConfigEditor rows={rows as never[]} />}
    </>
  );
}

import { getPendingDrivers } from "@/lib/admin-data.server";
import { AdminHeader, Empty } from "@/components/admin/AdminUI";
import { DriverApprovals } from "@/components/admin/DriverApprovals";

export const dynamic = "force-dynamic";

export default async function Page() {
  const rows = await getPendingDrivers();
  return (
    <>
      <AdminHeader title="Driver approvals" sub={`${rows.length} application${rows.length === 1 ? "" : "s"} awaiting review.`} />
      {rows.length === 0 ? <Empty>No pending driver applications. 🎉</Empty> : <DriverApprovals rows={rows as never[]} />}
    </>
  );
}

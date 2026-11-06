import { getPendingDrivers } from "@/lib/admin-data.server";
import { AdminHeader, Empty } from "@/components/admin/AdminUI";
import { DriverApprovals } from "@/components/admin/DriverApprovals";
import { fetchIsOpen } from "@/lib/fetch-paused";

export const dynamic = "force-dynamic";

export default async function Page() {
  const [rows, open] = await Promise.all([getPendingDrivers(), fetchIsOpen()]);
  return (
    <>
      <AdminHeader title="Driver approvals" sub={`${rows.length} application${rows.length === 1 ? "" : "s"} awaiting review.`} />
      {!open && <p role="status" className="mb-4 rounded-card border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950"><strong>Fetch is paused.</strong> Approving a driver is blocked by the database until Fetch is deliberately reopened. Applications are kept; you can still reject or leave them pending.</p>}
      {rows.length === 0 ? <Empty>No pending driver applications. 🎉</Empty> : <DriverApprovals rows={rows as never[]} approvalsPaused={!open} />}
    </>
  );
}

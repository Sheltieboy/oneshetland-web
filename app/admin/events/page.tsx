import { getPendingEvents } from "@/lib/admin-data.server";
import { AdminHeader, Empty } from "@/components/admin/AdminUI";
import { EventApprovals } from "@/components/admin/EventApprovals";

export const dynamic = "force-dynamic";

export default async function Page() {
  const rows = await getPendingEvents();
  return (
    <>
      <AdminHeader title="Event approvals" sub="Hub events waiting to go on the islands-wide calendar." />
      {rows.length === 0 ? <Empty>No events awaiting approval.</Empty> : <EventApprovals rows={rows as never[]} />}
    </>
  );
}

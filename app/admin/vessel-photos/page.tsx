import Link from "next/link";
import { getPendingVesselPhotos } from "@/lib/admin-data.server";
import { AdminHeader, Empty } from "@/components/admin/AdminUI";
import { VesselPhotoApprovals } from "@/components/admin/VesselPhotoApprovals";

export const dynamic = "force-dynamic";

const FILTERS = ["pending", "approved", "rejected"] as const;
type Filter = (typeof FILTERS)[number];

export default async function Page({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const { status } = await searchParams;
  const filter: Filter = FILTERS.includes(status as never) ? (status as Filter) : "pending";
  const rows = await getPendingVesselPhotos(filter);

  return (
    <>
      <AdminHeader title="Vessel photos" sub="Community photos submitted from a boat's discussion. Approve to add them to her gallery." />
      <div className="mb-5 flex flex-wrap gap-2">
        {FILTERS.map((k) => (
          <Link key={k} href={`/admin/vessel-photos?status=${k}`}
            className={"rounded-pill px-4 py-1.5 text-sm font-semibold capitalize " + (filter === k ? "bg-rose-600 text-white" : "border border-line-strong text-ink-soft hover:bg-sand")}>{k}</Link>
        ))}
      </div>
      {rows.length === 0 ? <Empty>No {filter} vessel photos.</Empty> : <VesselPhotoApprovals rows={rows as never[]} />}
    </>
  );
}

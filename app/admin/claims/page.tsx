import Link from "next/link";
import { getBusinessClaims } from "@/lib/admin-data.server";
import { AdminHeader, Empty } from "@/components/admin/AdminUI";
import { ClaimsManager } from "@/components/admin/ClaimsManager";

export const dynamic = "force-dynamic";

export default async function Page({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const { status } = await searchParams;
  const filter = (status === "approved" || status === "all" ? status : "pending") as "pending" | "approved" | "all";
  const rows = await getBusinessClaims(filter);
  const tabs: [string, string][] = [["pending", "Pending"], ["approved", "Approved"], ["all", "All"]];
  return (
    <>
      <AdminHeader title="Business claims" sub="Verify who owns each directory listing." />
      <div className="mb-5 flex gap-2">
        {tabs.map(([k, label]) => (
          <Link key={k} href={`/admin/claims?status=${k}`} className={"rounded-pill px-4 py-1.5 text-sm font-semibold " + (filter === k ? "bg-rose-600 text-white" : "border border-line-strong text-ink-soft hover:bg-sand")}>{label}</Link>
        ))}
      </div>
      {rows.length === 0 ? <Empty>No claims here.</Empty> : <ClaimsManager rows={rows as never[]} />}
    </>
  );
}

import Link from "next/link";
import { getNfcQueue } from "@/lib/admin-data.server";
import { AdminHeader, Empty } from "@/components/admin/AdminUI";
import { NfcQueue } from "@/components/admin/NfcQueue";

export const dynamic = "force-dynamic";

export default async function Page({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const { status } = await searchParams;
  const filter = (status === "dispatched" || status === "active" || status === "all" ? status : "requested") as
    "requested" | "dispatched" | "active" | "all";
  const rows = await getNfcQueue(filter);
  const tabs: [string, string][] = [
    ["requested", "To post"],
    ["dispatched", "Posted"],
    ["active", "In use"],
    ["all", "All"],
  ];
  return (
    <>
      <AdminHeader title="NFC tiles" sub="Who is owed a tap-to-stamp tile, and who has one." />
      <div className="mb-5 flex flex-wrap gap-2">
        {tabs.map(([k, label]) => (
          <Link key={k} href={`/admin/nfc?status=${k}`} className={"rounded-pill px-4 py-1.5 text-sm font-semibold " + (filter === k ? "bg-rose-600 text-white" : "border border-line-strong text-ink-soft hover:bg-sand")}>{label}</Link>
        ))}
      </div>
      {rows.length === 0
        ? <Empty>{filter === "requested" ? "Nothing waiting to be posted." : "Nothing here."}</Empty>
        : <NfcQueue rows={rows as never[]} />}
    </>
  );
}

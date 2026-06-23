import Link from "next/link";
import { getSpikSuggestions } from "@/lib/admin-data.server";
import { AdminHeader, Empty } from "@/components/admin/AdminUI";
import { SpikSuggestions } from "@/components/admin/SpikSuggestions";

export const dynamic = "force-dynamic";

export default async function Page({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const { status } = await searchParams;
  const filter = (status === "reviewed" || status === "all" ? status : "pending") as "pending" | "reviewed" | "all";
  const rows = await getSpikSuggestions(filter);
  const tabs: [string, string][] = [["pending", "Pending"], ["reviewed", "Reviewed"], ["all", "All"]];
  return (
    <>
      <AdminHeader title="Spik suggestions" sub="Community edits for the dialect dictionary — copy into WordPress, then mark reviewed." />
      <div className="mb-5 flex gap-2">
        {tabs.map(([k, label]) => (
          <Link key={k} href={`/admin/spik?status=${k}`} className={"rounded-pill px-4 py-1.5 text-sm font-semibold " + (filter === k ? "bg-rose-600 text-white" : "border border-line-strong text-ink-soft hover:bg-sand")}>{label}</Link>
        ))}
      </div>
      {rows.length === 0 ? <Empty>Nothing here.</Empty> : <SpikSuggestions rows={rows as never[]} />}
    </>
  );
}

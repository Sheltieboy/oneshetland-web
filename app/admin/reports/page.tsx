import Link from "next/link";
import { getContentReports } from "@/lib/admin-data.server";
import { AdminHeader, Empty } from "@/components/admin/AdminUI";
import { ReportsManager } from "@/components/admin/ReportsManager";

export const dynamic = "force-dynamic";

const FILTERS = ["open", "reviewing", "actioned", "dismissed", "all"] as const;
type Filter = (typeof FILTERS)[number];

export default async function Page({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const { status } = await searchParams;
  const filter: Filter = FILTERS.includes(status as never) ? (status as Filter) : "open";
  const rows = await getContentReports(filter);

  return (
    <>
      <AdminHeader title="Reports" sub="Reported content and users. Act on objectionable content within 24 hours." />
      <div className="mb-5 flex flex-wrap gap-2">
        {FILTERS.map((k) => (
          <Link key={k} href={`/admin/reports?status=${k}`}
            className={"rounded-pill px-4 py-1.5 text-sm font-semibold capitalize " + (filter === k ? "bg-rose-600 text-white" : "border border-line-strong text-ink-soft hover:bg-sand")}>{k}</Link>
        ))}
      </div>
      {rows.length === 0 ? <Empty>No {filter === "all" ? "" : filter + " "}reports.</Empty> : <ReportsManager rows={rows as never[]} />}
    </>
  );
}

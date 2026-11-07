import Link from "next/link";
import { AdminHeader, Empty } from "@/components/admin/AdminUI";
import { loadChangeQueue } from "@/lib/event-submissions-admin.server";
import { EventChangesQueue } from "@/components/admin/EventChangesQueue";
import { PAGE_NOT_AVAILABLE_YET } from "@/lib/contributor-copy";

export const dynamic = "force-dynamic";
export const metadata = { title: "Event change requests", robots: { index: false, follow: false } };

export default async function Page({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const sp = await searchParams;
  const status = sp.status === "auto_approved" ? "auto_approved" : "pending";
  const res = await loadChangeQueue(status);
  return (
    <>
      <AdminHeader title="Event change requests" sub="Changes organisers have asked for on their community events. Waiting ones need a decision; automatic ones are for you to look over." />
      <p className="mb-4"><Link href="/admin/events" className="text-sm font-semibold text-navy underline">Back to event approvals</Link> · <Link href="/admin/events/submissions" className="text-sm font-semibold text-navy underline">Event submissions</Link></p>
      <nav aria-label="Change status" className="mb-5 flex flex-wrap gap-2">
        {([["pending", "Waiting"], ["auto_approved", "Applied automatically"]] as const).map(([s, l]) => (
          <Link key={s} href={`/admin/events/changes?status=${s}`} aria-current={s === status ? "page" : undefined}
            className={`inline-flex min-h-11 items-center rounded-pill px-4 text-sm font-bold ${s === status ? "bg-navy text-white" : "border border-line-strong bg-paper text-ink"}`}>
            {l}{res.ok && res.data.counts ? ` (${s === "pending" ? res.data.counts.pending : res.data.counts.auto_approved_7d})` : ""}
          </Link>
        ))}
      </nav>
      {!res.ok ? <Empty>{res.error.kind === "unavailable" ? PAGE_NOT_AVAILABLE_YET : res.error.message}</Empty>
        : res.data.items.length === 0 ? <Empty>Nothing here.</Empty>
        : <EventChangesQueue items={res.data.items} />}
    </>
  );
}

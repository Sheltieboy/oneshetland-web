import Link from "next/link";
import { AdminHeader, Empty } from "@/components/admin/AdminUI";
import { loadSubmissionQueue } from "@/lib/event-submissions-admin.server";
import { isSubmissionStatus, type SubmissionStatus } from "@/lib/event-submissions-client";
import { EventSubmissionsQueue } from "@/components/admin/EventSubmissionsQueue";
import { PAGE_NOT_AVAILABLE_YET } from "@/lib/contributor-copy";

export const dynamic = "force-dynamic";
export const metadata = { title: "Event submissions", robots: { index: false, follow: false } };

const TABS: { status: SubmissionStatus; label: string }[] = [
  { status: "pending", label: "Waiting" }, { status: "changes_requested", label: "Sent back" }, { status: "approved", label: "Approved" },
  { status: "rejected", label: "Rejected" }, { status: "withdrawn", label: "Withdrawn" },
];

/** Admin only (the admin layout enforces it). Community submissions: approve publishes a community event credited to the named organiser. */
export default async function Page({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const sp = await searchParams;
  const status: SubmissionStatus = isSubmissionStatus(sp.status) ? sp.status : "pending";
  const res = await loadSubmissionQueue(status);
  return (
    <>
      <AdminHeader title="Event submissions" sub="Events sent in by members for a community group. Approving publishes the event as a community event credited to the organiser the member named, never as OneShetland's." />
      <p className="mb-4"><Link href="/admin/events" className="text-sm font-semibold text-navy underline">Back to event approvals</Link> · <Link href="/admin/events/changes" className="text-sm font-semibold text-navy underline">Change requests</Link></p>
      <nav aria-label="Submission status" className="mb-5 flex flex-wrap gap-2">
        {TABS.map((t) => (
          <Link key={t.status} href={`/admin/events/submissions?status=${t.status}`} aria-current={t.status === status ? "page" : undefined}
            className={`inline-flex min-h-11 items-center rounded-pill px-4 text-sm font-bold ${t.status === status ? "bg-navy text-white" : "border border-line-strong bg-paper text-ink"}`}>
            {t.label}{res.ok && res.data.counts && t.status === "pending" ? ` (${res.data.counts.pending})` : ""}{res.ok && res.data.counts && t.status === "changes_requested" ? ` (${res.data.counts.changes_requested})` : ""}
          </Link>
        ))}
      </nav>
      {!res.ok ? <Empty>{res.error.kind === "unavailable" ? PAGE_NOT_AVAILABLE_YET : res.error.message}</Empty>
        : res.data.items.length === 0 ? <Empty>Nothing here.</Empty>
        : <EventSubmissionsQueue items={res.data.items} />}
    </>
  );
}

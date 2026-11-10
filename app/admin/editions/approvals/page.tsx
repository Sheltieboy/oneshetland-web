import Link from "next/link";
import { AdminHeader, Card, Empty, StatusPill } from "@/components/admin/AdminUI";
import { EditionsTabs, ErrorNote, FlagPill, ParentPill, day, when } from "@/components/admin/EditionsAdminParts";
import { KIND_LABEL, type EditionKind } from "@/lib/editions/types";
import { one } from "../helpers";
import { reviewCounts, reviewQueue, type ReviewRow } from "../queries";
import { DECISION_DONE, QUEUE_TABS, parseQueueTab, waitingText, type Decision } from "./review";

export const dynamic = "force-dynamic";
export const metadata = { title: "Edition approvals · Admin" };

const STATE_PILL: Record<string, { label: string; tone: "green" | "red" | "amber" }> = { approved: { label: "Approved", tone: "green" }, rejected: { label: "Rejected", tone: "red" }, changes_requested: { label: "Changes requested", tone: "amber" } };

/** Admin → Edition approvals. Same feel as Event approvals: oldest first, one card per Edition, one tap into the review. Reads run as the signed-in administrator. */
export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const tab = parseQueueTab(sp.tab);
  const done = one(sp.done), doneTitle = one(sp.title).slice(0, 80);
  const [counts, q] = await Promise.all([reviewCounts(), reviewQueue(tab)]);
  const current = QUEUE_TABS.find((t) => t.key === tab)!;
  return (
    <>
      <AdminHeader title="Edition approvals" sub="Every Edition is checked here before it can go public. Approving also records that you checked who runs it." />
      <EditionsTabs active="approvals" waiting={counts.waiting} />
      {Object.hasOwn(DECISION_DONE, done) && (
        <p role="status" className="mb-4 rounded-card border border-emerald-200 bg-emerald-50 p-3 text-sm font-semibold text-emerald-900">
          {doneTitle ? `“${doneTitle}” ` : "The Edition "}was {DECISION_DONE[done as Decision]}. The organiser has been told.
        </p>
      )}
      <nav aria-label="Approval lists" className="mb-4 flex flex-wrap gap-2">
        {QUEUE_TABS.map((t) => {
          const n = t.key === "waiting" ? counts.waiting : t.key === "changes" ? counts.changes : 0;
          return (
            <Link key={t.key} href={`/admin/editions/approvals?tab=${t.key}`} aria-current={tab === t.key ? "page" : undefined}
              className={"inline-flex min-h-11 items-center rounded-pill px-4 text-sm font-bold transition " + (tab === t.key ? "bg-ink text-white" : "border border-line-strong text-ink-soft hover:bg-sand")}>
              {t.label}{n > 0 && <span className={"ml-2 rounded-pill px-2 py-0.5 text-xs " + (tab === t.key ? "bg-white/25 text-white" : "bg-rose-100 text-rose-700")}>{n}</span>}
            </Link>
          );
        })}
      </nav>
      {q.error ? <ErrorNote>{q.error}</ErrorNote> : !q.rows.length ? <Empty>{current.empty}</Empty> : (
        <ul className="space-y-3" aria-label={current.label}>
          {q.rows.map((r) => <li key={r.edition_id}><QueueCard r={r} tab={tab} /></li>)}
        </ul>
      )}
    </>
  );
}

function QueueCard({ r, tab }: { r: ReviewRow; tab: string }) {
  const dates = r.starts_on === r.ends_on ? day(r.starts_on) : `${day(r.starts_on)} to ${day(r.ends_on)}`;
  return (
    <Card className={r.reserved && r.first_edition ? "border-amber-500" : ""}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h2 className="break-words font-display text-lg font-bold text-ink">{r.title}</h2>
          <p className="mt-0.5 text-sm text-ink-muted">{KIND_LABEL[r.kind as EditionKind] ?? r.kind} · {dates}</p>
          <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-ink-soft">Run by {r.parent_name ?? r.organiser_name} <ParentPill kind={r.parent_kind} /></p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {r.first_edition && <FlagPill>First Edition: identity not checked yet</FlagPill>}
            {r.material && <FlagPill>Material change</FlagPill>}
            {r.reserved && <FlagPill>Reserved name: check carefully</FlagPill>}
            {tab !== "waiting" && STATE_PILL[r.review_state] && <StatusPill label={STATE_PILL[r.review_state].label} tone={STATE_PILL[r.review_state].tone} />}
          </div>
          <p className="mt-2 text-xs text-ink-muted">
            {tab === "waiting" ? <>{waitingText(r.waiting_days)}{r.submitted_at ? ` (submitted ${when(r.submitted_at)})` : ""}</>
              : tab === "edited" ? `Edited after approval${r.decided_at ? `; approved ${when(r.decided_at)}` : ""}`
              : r.decided_at ? `${r.review_state === "approved" ? "Approved" : r.review_state === "rejected" ? "Rejected" : "Changes requested"} ${when(r.decided_at)}` : ""}
          </p>
        </div>
        <Link href={`/admin/editions/approvals/${r.edition_id}`} className="inline-flex min-h-11 w-full items-center justify-center rounded-pill bg-navy px-5 text-sm font-bold text-white hover:bg-navy-dark sm:w-auto sm:shrink-0">
          {tab === "waiting" ? "Review" : "Open"}
        </Link>
      </div>
    </Card>
  );
}

import Link from "next/link";
import { requireBusinessOwner } from "@/lib/business-server";
import { getBusinessShifts } from "@/lib/jobs-data.server";
import { SHIFTS, EmptyState } from "@/components/jobs/JobsUI";
import { EmployerShiftManager } from "@/components/jobs/EmployerShiftManager";

export const dynamic = "force-dynamic";
export const metadata = { title: "Shifts" };

/**
 * Business → Manage → Shifts.
 *
 * The same manager /shifts/manage uses, filtered to this business. It is a
 * second DOOR, not a second management system: one component, one data path,
 * one set of rules about who may cancel or boost.
 *
 * Two gates, deliberately. requireBusinessOwner keeps non-owners out of the
 * business area at all, and getBusinessShifts then narrows to shifts this
 * account actually employs on. Being the business owner is not by itself
 * permission to manage somebody else's shift.
 */
export default async function BusinessShiftsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { business, account } = await requireBusinessOwner(id);
  const shifts = await getBusinessShifts(business.id, account.id);

  return (
    <div className="mx-auto max-w-3xl px-5 py-10 sm:py-12">
      <Link href={`/business/${business.id}/manage`} className="text-sm font-semibold text-ink-soft hover:text-ink">← {business.name}</Link>
      <div className="mt-3 mb-2 flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-3xl font-bold sm:text-4xl">Shifts</h1>
        <Link href="/shifts/new" className="rounded-pill px-5 py-2.5 text-sm font-semibold text-paper shadow-soft transition hover:brightness-95" style={{ background: SHIFTS }}>
          + Post a shift
        </Link>
      </div>
      <p className="mb-6 text-ink-soft">
        Short, same-day work posted as {business.name} — applicants, check-in and boosting.
      </p>

      {shifts.length === 0 ? (
        <EmptyState
          icon="⚡"
          title={`No shifts posted as ${business.name} yet`}
          body="Post a shift to reach available local workers in minutes. Choose this business when you post and it will appear here."
          cta={{ label: "Post a shift", href: "/shifts/new", color: SHIFTS }}
        />
      ) : (
        <EmployerShiftManager
          shifts={shifts.map((s) => ({
            id: s.id, title: s.title, start_at: s.start_at, status: s.status,
            positions_filled: s.positions_filled, positions_total: s.positions_total,
            pending_count: s.pending_count, total_apps: s.total_apps, checked_out_count: s.checked_out_count,
            posted_as_business_id: s.posted_as_business_id, boosted_until: s.boosted_until,
          }))}
        />
      )}

      <p className="mt-8 text-sm text-ink-muted">
        Shifts you posted under your own name live in{" "}
        <Link href="/shifts/manage" className="font-semibold underline">My posted shifts</Link>.
      </p>
    </div>
  );
}

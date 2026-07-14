import Link from "next/link";
import { redirect } from "next/navigation";
import { getAccount } from "@/lib/auth";
import { getEmployerShifts } from "@/lib/jobs-data.server";
import { SHIFTS, EmptyState } from "@/components/jobs/JobsUI";
import { EmployerShiftManager } from "@/components/jobs/EmployerShiftManager";

export const dynamic = "force-dynamic";
export const metadata = { title: "Manage shifts" };

export default async function ManageShiftsPage() {
  const account = await getAccount();
  if (!account) redirect("/sign-in?next=/shifts/manage");

  const shifts = await getEmployerShifts(account.id);

  return (
    <div className="mx-auto max-w-3xl px-5 py-10 sm:py-14">
      <Link href="/work" className="text-sm font-semibold text-ink-soft hover:text-ink">← My work</Link>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-4xl font-bold">Manage shifts</h1>
        <Link href="/work-profile/employer" className="rounded-pill border border-line-strong px-4 py-2 text-sm font-semibold text-ink hover:bg-sand">Business profile</Link>
      </div>
      <p className="mt-2 text-ink-soft">Review applicants and keep your posted shifts up to date.</p>

      <div className="mt-8">
        {shifts.length === 0 ? (
          <EmptyState icon="⚡" title="No shifts posted yet" body="Post your first shift to start receiving applications from local workers." cta={{ label: "Post a shift", href: "/shifts/new", color: SHIFTS }} />
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
      </div>
    </div>
  );
}

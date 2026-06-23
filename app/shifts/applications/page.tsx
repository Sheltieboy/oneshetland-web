import Link from "next/link";
import { getAccount } from "@/lib/auth";
import { getMyShiftApplications } from "@/lib/jobs-data.server";
import { SHIFTS, EmptyState } from "@/components/jobs/JobsUI";
import { ShiftApplicationRow } from "@/components/jobs/ShiftApplicationRow";

export const dynamic = "force-dynamic";
export const metadata = { title: "My shift applications · OneShetland" };

export default async function MyShiftApplicationsPage() {
  const account = await getAccount();
  const apps = account ? await getMyShiftApplications(account.id) : [];

  return (
    <div className="mx-auto max-w-3xl px-5 py-10 sm:py-14">
      <Link href="/jobs?tab=shifts" className="text-sm font-semibold text-ink-soft hover:text-ink">← Shifts</Link>
      <h1 className="mt-4 font-display text-4xl font-bold">My shift applications</h1>
      <p className="mt-2 text-ink-soft">Confirmed shifts show a check-in once the start time is near.</p>

      <div className="mt-8 space-y-4">
        {!account ? (
          <div className="rounded-card border border-line bg-paper p-8 text-center shadow-soft">
            <p className="font-display text-xl font-bold">Sign in to see your shifts</p>
            <a href="/sign-in?next=/shifts/applications" className="mt-5 inline-block rounded-pill px-6 py-3 font-semibold text-paper hover:brightness-95" style={{ background: SHIFTS }}>Sign in</a>
          </div>
        ) : apps.length === 0 ? (
          <EmptyState icon="⚡" title="No shift applications yet" body="Register interest in a shift and it'll appear here." cta={{ label: "Browse shifts", href: "/jobs?tab=shifts", color: SHIFTS }} />
        ) : (
          apps.map((a) => <ShiftApplicationRow key={a.id} app={a} />)
        )}
      </div>
    </div>
  );
}

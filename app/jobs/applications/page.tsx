import Link from "next/link";
import { getAccount } from "@/lib/auth";
import { getMyJobApplications } from "@/lib/jobs-data.server";
import { JOBS, EmptyState } from "@/components/jobs/JobsUI";
import { JobApplicationRow } from "@/components/jobs/JobApplicationRow";

export const dynamic = "force-dynamic";
export const metadata = { title: "My job applications" };

export default async function MyJobApplicationsPage() {
  const account = await getAccount();
  const apps = account ? await getMyJobApplications(account.id) : [];

  return (
    <div className="mx-auto max-w-3xl px-5 py-10 sm:py-14">
      <Link href="/work" className="text-sm font-semibold text-ink-soft hover:text-ink">← My work</Link>
      <h1 className="mt-4 font-display text-4xl font-bold">My job applications</h1>
      <p className="mt-2 text-ink-soft">Track where each application is in the employer's pipeline.</p>

      <div className="mt-8 space-y-4">
        {!account ? (
          <div className="rounded-card border border-line bg-paper p-8 text-center shadow-soft">
            <p className="font-display text-xl font-bold">Sign in to see your applications</p>
            <a href="/sign-in?next=/jobs/applications" className="mt-5 inline-block rounded-pill px-6 py-3 font-semibold text-paper hover:brightness-95" style={{ background: JOBS }}>Sign in</a>
          </div>
        ) : apps.length === 0 ? (
          <EmptyState icon="📋" title="No applications yet" body="When you apply for jobs, they'll appear here so you can track progress." cta={{ label: "Browse jobs", href: "/jobs", color: JOBS }} />
        ) : (
          apps.map((a) => <JobApplicationRow key={a.id} app={a} />)
        )}
      </div>
    </div>
  );
}

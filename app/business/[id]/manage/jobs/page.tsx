import Link from "next/link";
import { requireBusinessOwner } from "@/lib/business-server";
import { getBusinessJobs } from "@/lib/jobs-data.server";
import { JOBS } from "@/components/jobs/JobsUI";
import { BusinessJobsManager } from "@/components/jobs/BusinessJobsManager";

export const dynamic = "force-dynamic";
export const metadata = { title: "Jobs" };

export default async function BusinessJobsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { business } = await requireBusinessOwner(id);
  const jobs = await getBusinessJobs(business.id);

  return (
    <div className="mx-auto max-w-2xl px-5 py-10 sm:py-12">
      <Link href={`/business/${business.id}/manage`} className="text-sm font-semibold text-ink-soft hover:text-ink">← {business.name}</Link>
      <div className="mt-3 mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-3xl font-bold sm:text-4xl">Jobs</h1>
        <Link href="/jobs/new" className="rounded-pill px-5 py-2.5 text-sm font-semibold text-paper shadow-soft transition hover:brightness-95" style={{ background: JOBS }}>
          + Post a job
        </Link>
      </div>
      <BusinessJobsManager jobs={jobs} />
    </div>
  );
}

import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getAccount } from "@/lib/auth";
import { getJob } from "@/lib/jobs-data";
import { getJobApplicants } from "@/lib/jobs-data.server";
import { JOBS, EmptyState } from "@/components/jobs/JobsUI";
import { ApplicantPipeline } from "@/components/jobs/ApplicantPipeline";

export const dynamic = "force-dynamic";
export const metadata = { title: "Applicants" };

export default async function ApplicantsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const account = await getAccount();
  if (!account) redirect(`/sign-in?next=/jobs/${id}/applicants`);

  const job = await getJob(id);
  if (!job) notFound();
  if (job.employer_id !== account.id) {
    return (
      <div className="mx-auto max-w-2xl px-5 py-16 text-center">
        <p className="font-display text-2xl font-bold">Not your job</p>
        <p className="mt-2 text-ink-soft">Only the employer who posted this role can view applicants.</p>
        <Link href={`/jobs/${id}`} className="mt-5 inline-block rounded-pill px-5 py-2.5 font-semibold text-paper" style={{ background: JOBS }}>View the job</Link>
      </div>
    );
  }

  const applicants = await getJobApplicants(id);

  return (
    <div className="mx-auto max-w-3xl px-5 py-10 sm:py-14">
      <Link href={`/jobs/${id}`} className="text-sm font-semibold text-ink-soft hover:text-ink">← {job.title}</Link>
      <h1 className="mt-4 font-display text-4xl font-bold">Applicants</h1>
      <p className="mt-2 text-ink-soft">{applicants.length} application{applicants.length === 1 ? "" : "s"} for {job.title}.</p>

      <div className="mt-8">
        {applicants.length === 0 ? (
          <EmptyState icon="📭" title="No applicants yet" body="When people apply, they'll appear here and you can move them through your hiring pipeline." />
        ) : (
          <ApplicantPipeline applicants={applicants} />
        )}
      </div>
    </div>
  );
}

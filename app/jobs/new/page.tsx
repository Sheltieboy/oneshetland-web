import Link from "next/link";
import { getAccount } from "@/lib/auth";
import { getJob } from "@/lib/jobs-data";
import { getMyBusinesses } from "@/lib/jobs-data.server";
import { JobPostForm } from "@/components/jobs/JobPostForm";
import { JOBS } from "@/components/jobs/JobsUI";

export const dynamic = "force-dynamic";
export const metadata = { title: "Post a job · OneShetland" };

export default async function NewJobPage({ searchParams }: { searchParams: Promise<{ jobId?: string }> }) {
  const { jobId } = await searchParams;
  const account = await getAccount();
  const businesses = account ? await getMyBusinesses(account.id) : [];
  const existing = jobId && account ? await getJob(jobId) : null;
  const canEdit = !!existing && existing.employer_id === account?.id;

  return (
    <div className="mx-auto max-w-2xl px-5 py-10 sm:py-14">
      <Link href="/jobs" className="text-sm font-semibold text-ink-soft hover:text-ink">← Work</Link>
      <div className="mt-6">
        <p className="text-xs font-bold uppercase tracking-widest" style={{ color: JOBS }}>OneShetland · Jobs</p>
        <h1 className="mt-1 font-display text-4xl font-bold">{canEdit ? "Edit job" : "Post a job"}</h1>
        <p className="mt-3 text-lg text-ink-soft">Free to post. Reach the whole of Shetland and manage applicants in one place.</p>
      </div>
      <div className="mt-8">
        <JobPostForm
          isLoggedIn={!!account}
          businesses={businesses}
          existing={canEdit && existing ? {
            id: existing.id,
            posted_as_business_id: existing.posted_as_business_id,
            title: existing.title, description: existing.description ?? "",
            category: existing.category ?? "", contract_type: existing.contract_type,
            remote_mode: existing.remote_mode, location: existing.location ?? "",
            pay_hidden: existing.pay_hidden, pay_min: existing.pay_min, pay_max: existing.pay_max,
            pay_period: existing.pay_period ?? "year", pay_text: existing.pay_text ?? "",
            relocation_support: existing.relocation_support, housing_available: existing.housing_available,
            is_seasonal: existing.is_seasonal, season_label: existing.season_label ?? "",
            apply_url: existing.apply_url ?? "", apply_email: existing.apply_email ?? "",
          } : null}
        />
      </div>
    </div>
  );
}

import Link from "next/link";
import { notFound } from "next/navigation";
import { getAccount } from "@/lib/auth";
import { getJob, formatJobPay, CONTRACT_LABELS, REMOTE_LABELS } from "@/lib/jobs-data";
import { hasAppliedToJob, getSavedJobIds, getWorkerProfile } from "@/lib/jobs-data.server";
import { JOBS } from "@/components/jobs/JobsUI";
import { JobApplyPanel } from "@/components/jobs/JobApplyPanel";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const j = await getJob(id);
  return { title: j ? `${j.title} · Jobs · OneShetland` : "Job" };
}

export default async function JobDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const job = await getJob(id);
  if (!job) notFound();

  const account = await getAccount();
  const [applied, savedIds, profile] = account
    ? await Promise.all([hasAppliedToJob(id, account.id), getSavedJobIds(), getWorkerProfile(account.id)])
    : [false, new Set<string>(), null];

  const biz = job.business;
  const isOwner = !!account && job.employer_id === account.id;

  const facts: { label: string; value: string }[] = [
    { label: "Pay", value: formatJobPay(job) },
    { label: "Contract", value: CONTRACT_LABELS[job.contract_type] ?? job.contract_type },
    { label: "Working", value: REMOTE_LABELS[job.remote_mode] },
    ...(job.location ? [{ label: "Location", value: job.location }] : []),
    ...(job.category ? [{ label: "Sector", value: job.category }] : []),
    ...(job.is_seasonal ? [{ label: "Seasonal", value: job.season_label || "Yes" }] : []),
    ...(job.relocation_support ? [{ label: "Relocation", value: "Supported" }] : []),
    ...(job.housing_available ? [{ label: "Housing", value: "Available" }] : []),
  ];

  return (
    <>
      {/* Hero */}
      <section className="relative isolate overflow-hidden" style={{ background: JOBS }}>
        <div className="absolute inset-0" style={{ background: `linear-gradient(160deg,${JOBS}f0 30%,${JOBS}c0)` }} />
        <div className="relative mx-auto max-w-4xl px-5 py-10 sm:py-12">
          <Link href="/jobs" className="text-sm font-semibold text-white/80 hover:text-white">← Jobs</Link>
          <div className="mt-4 flex items-start gap-4">
            <div className="h-16 w-16 shrink-0 overflow-hidden rounded-2xl border border-white/30 bg-white/10">
              {biz?.logo_url
                ? <img src={biz.logo_url} alt="" className="h-full w-full object-cover" />
                : <div className="grid h-full w-full place-items-center font-display text-2xl font-bold text-white">{(biz?.name ?? "?").slice(0, 1)}</div>}
            </div>
            <div className="min-w-0">
              {job.is_featured && <span className="inline-block rounded-pill bg-white/20 px-2.5 py-0.5 text-xs font-bold text-white">★ Featured</span>}
              <h1 className="mt-1 font-display text-3xl font-bold leading-tight text-white sm:text-4xl">{job.title}</h1>
              <p className="mt-1 text-white/85">{biz?.name ?? "Employer"}{biz?.is_verified ? " ✓" : ""}{job.location ? ` · ${job.location}` : ""}</p>
            </div>
          </div>
        </div>
      </section>

      <div className="mx-auto grid max-w-4xl gap-8 px-5 py-10 sm:py-12 lg:grid-cols-[1fr_300px]">
        <div className="space-y-8">
          {/* Facts */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {facts.map((f) => (
              <div key={f.label} className="rounded-card border border-line bg-paper p-3 shadow-soft">
                <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">{f.label}</p>
                <p className="mt-0.5 font-display font-bold text-ink">{f.value}</p>
              </div>
            ))}
          </div>

          {/* Description */}
          {job.description && (
            <section>
              <h2 className="font-display text-2xl font-bold text-ink">About the role</h2>
              <p className="mt-3 whitespace-pre-wrap text-ink-soft leading-relaxed">{job.description}</p>
            </section>
          )}

          {/* Other ways to apply */}
          {(job.apply_url || job.apply_email) && (
            <section className="rounded-card border border-line bg-paper p-5 shadow-soft">
              <h2 className="font-display text-lg font-bold text-ink">Other ways to apply</h2>
              <div className="mt-3 flex flex-wrap gap-3">
                {job.apply_url && <a href={job.apply_url} target="_blank" rel="noopener noreferrer" className="rounded-pill border border-line-strong px-4 py-2 text-sm font-semibold text-ink hover:bg-sand">Apply on employer site ↗</a>}
                {job.apply_email && <a href={`mailto:${job.apply_email}`} className="rounded-pill border border-line-strong px-4 py-2 text-sm font-semibold text-ink hover:bg-sand">Email {job.apply_email}</a>}
              </div>
            </section>
          )}
        </div>

        {/* Apply panel */}
        <aside className="lg:sticky lg:top-24 lg:self-start">
          {isOwner ? (
            <div className="rounded-card border border-line bg-paper p-5 shadow-soft">
              <p className="font-display font-bold text-ink">You posted this job</p>
              <Link href={`/jobs/${job.id}/applicants`} className="mt-3 block rounded-pill px-4 py-2.5 text-center text-sm font-semibold text-paper transition hover:brightness-95" style={{ background: JOBS }}>
                View applicants →
              </Link>
              <Link href={`/jobs/new?jobId=${job.id}`} className="mt-2 block rounded-pill border border-line-strong px-4 py-2.5 text-center text-sm font-semibold text-ink hover:bg-sand">
                Edit job
              </Link>
            </div>
          ) : (
            <JobApplyPanel
              jobId={job.id}
              isLoggedIn={!!account}
              alreadyApplied={applied}
              isSaved={savedIds.has(job.id)}
              snapshot={profile ? {
                headline: profile.headline, summary: profile.summary,
                skills: profile.skills, qualifications: profile.qualifications,
                willing_to_relocate: profile.willing_to_relocate,
              } : null}
            />
          )}
        </aside>
      </div>
    </>
  );
}

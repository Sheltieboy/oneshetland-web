import Link from "next/link";
import { redirect } from "next/navigation";
import { getAccount } from "@/lib/auth";
import { getSavedJobs } from "@/lib/jobs-data.server";
import { JobCard, EmptyState, JOBS } from "@/components/jobs/JobsUI";
import { getSavedEnabled } from "@/lib/saved.server";

export const dynamic = "force-dynamic";
export const metadata = { title: "Saved jobs" };

export default async function SavedJobsPage() {
  const account = await getAccount();
  if (!account) redirect("/sign-in?next=/jobs/saved");

  const jobs = await getSavedJobs();
  const savedOn = await getSavedEnabled();

  return (
    <div className="mx-auto max-w-6xl px-5 py-10 sm:py-14">
      <Link href="/work" className="text-sm font-semibold text-ink-soft hover:text-ink">← My work</Link>
      <h1 className="mt-4 font-display text-4xl font-bold">Saved jobs</h1>
      <p className="mt-2 text-ink-soft">Jobs you've bookmarked — come back to them any time.</p>
      {savedOn && <p className="mt-2 text-sm"><Link href="/account/saved" className="font-semibold text-ink underline underline-offset-2">See everything in My Saved</Link></p>}

      <div className="mt-8">
        {jobs.length === 0 ? (
          <EmptyState
            icon="🔖"
            title="No saved jobs yet"
            body="Tap the bookmark on any job to save it here for later."
            cta={{ label: "Browse jobs", href: "/jobs", color: JOBS }}
          />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {jobs.map((j) => <JobCard key={j.id} job={j} />)}
          </div>
        )}
      </div>
    </div>
  );
}

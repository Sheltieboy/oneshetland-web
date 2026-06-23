import Link from "next/link";
import { getAccount } from "@/lib/auth";
import { getWorkerProfile } from "@/lib/jobs-data.server";
import { WorkProfileForm } from "@/components/jobs/WorkProfileForm";
import { JOBS } from "@/components/jobs/JobsUI";

export const dynamic = "force-dynamic";
export const metadata = { title: "My work profile · OneShetland" };

export default async function WorkProfilePage() {
  const account = await getAccount();
  const profile = account ? await getWorkerProfile(account.id) : null;

  return (
    <div className="mx-auto max-w-2xl px-5 py-10 sm:py-14">
      <Link href="/jobs" className="text-sm font-semibold text-ink-soft hover:text-ink">← Work</Link>
      <div className="mt-6">
        <p className="text-xs font-bold uppercase tracking-widest" style={{ color: JOBS }}>OneShetland · Work</p>
        <h1 className="mt-1 font-display text-4xl font-bold">My work profile</h1>
        <p className="mt-3 text-lg text-ink-soft">One profile employers see when you apply for jobs or shifts.</p>
      </div>
      <div className="mt-8">
        {account ? (
          <WorkProfileForm
            initial={profile ? {
              headline: profile.headline ?? "", summary: profile.summary ?? "",
              skills: (profile.skills ?? []).join(", "), qualifications: (profile.qualifications ?? []).join(", "),
              desired_pay_text: profile.desired_pay_text ?? "",
              willing_to_relocate: profile.willing_to_relocate, is_diaspora: profile.is_diaspora,
            } : null}
          />
        ) : (
          <div className="rounded-card border border-line bg-paper p-8 text-center shadow-soft">
            <p className="font-display text-xl font-bold">Sign in to build your profile</p>
            <a href="/sign-in?next=/work-profile" className="mt-5 inline-block rounded-pill px-6 py-3 font-semibold text-paper hover:brightness-95" style={{ background: JOBS }}>Sign in or create account</a>
          </div>
        )}
      </div>
    </div>
  );
}

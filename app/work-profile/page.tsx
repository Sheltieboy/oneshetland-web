import Link from "next/link";
import { getAccount } from "@/lib/auth";
import { getWorkerProfile, getShiftAlert } from "@/lib/jobs-data.server";
import { WorkProfileForm } from "@/components/jobs/WorkProfileForm";
import { JOBS } from "@/components/jobs/JobsUI";

export const dynamic = "force-dynamic";
export const metadata = { title: "My work profile" };

export default async function WorkProfilePage() {
  const account = await getAccount();
  const [profile, alert] = account
    ? await Promise.all([getWorkerProfile(account.id), getShiftAlert(account.id)])
    : [null, null];

  return (
    <div className="mx-auto max-w-2xl px-5 py-10 sm:py-14">
      <Link href="/work" className="text-sm font-semibold text-ink-soft hover:text-ink">← My work</Link>
      <div className="mt-6">
        <p className="text-xs font-bold uppercase tracking-widest" style={{ color: JOBS }}>OneShetland · Work</p>
        <h1 className="mt-1 font-display text-4xl font-bold">My work profile</h1>
        <p className="mt-3 text-lg text-ink-soft">This is your one work profile — what employers see whether you apply for a <strong>job</strong> or a <strong>shift</strong>. Fill it out once.</p>
      </div>
      <div className="mt-8">
        {account ? (
          <WorkProfileForm
            initial={{
              headline: profile?.headline ?? "", summary: profile?.summary ?? "",
              skills: (profile?.skills ?? []).join(", "), qualifications: (profile?.qualifications ?? []).join(", "),
              desired_pay_text: profile?.desired_pay_text ?? "",
              willing_to_relocate: profile?.willing_to_relocate ?? false, is_diaspora: profile?.is_diaspora ?? false,
              experience_summary: profile?.experience_summary ?? "",
              hourly_rate_min: profile?.hourly_rate_min != null ? String(profile.hourly_rate_min) : "",
              hourly_rate_max: profile?.hourly_rate_max != null ? String(profile.hourly_rate_max) : "",
              alertActive: alert?.is_active ?? false,
              alertCategories: alert?.categories ?? [],
              alertUrgency: alert?.urgency ?? [],
              alertMinPay: alert?.min_pay != null ? String(alert.min_pay) : "",
            }}
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

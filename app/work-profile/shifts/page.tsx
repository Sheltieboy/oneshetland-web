import Link from "next/link";
import { getAccount } from "@/lib/auth";
import { getShiftWorkerProfile } from "@/lib/jobs-data.server";
import { ShiftWorkerProfileForm } from "@/components/jobs/ShiftWorkerProfileForm";

const SHIFTS = "#e8a020";

export const dynamic = "force-dynamic";
export const metadata = { title: "My shift profile · OneShetland" };

export default async function ShiftWorkProfilePage() {
  const account = await getAccount();
  const profile = account ? await getShiftWorkerProfile(account.id) : null;

  return (
    <div className="mx-auto max-w-2xl px-5 py-10 sm:py-14">
      <Link href="/work-profile" className="text-sm font-semibold text-ink-soft hover:text-ink">← Work profile</Link>
      <div className="mt-6">
        <p className="text-xs font-bold uppercase tracking-widest" style={{ color: SHIFTS }}>OneShetland · Shifts</p>
        <h1 className="mt-1 font-display text-4xl font-bold">My shift profile</h1>
        <p className="mt-3 text-lg text-ink-soft">What employers see when you apply for a shift — your experience, skills and pay expectation.</p>
      </div>
      <div className="mt-8">
        {account ? (
          <ShiftWorkerProfileForm
            initial={profile ? {
              bio: profile.bio ?? "",
              experience_summary: profile.experience_summary ?? "",
              skills: (profile.skills ?? []).join(", "),
              qualifications: (profile.qualifications ?? []).join(", "),
              hourly_rate_min: profile.hourly_rate_min != null ? String(profile.hourly_rate_min) : "",
              hourly_rate_max: profile.hourly_rate_max != null ? String(profile.hourly_rate_max) : "",
              is_open_to_work: profile.is_open_to_work ?? false,
              open_to_categories: profile.open_to_categories ?? [],
            } : null}
          />
        ) : (
          <div className="rounded-card border border-line bg-paper p-8 text-center shadow-soft">
            <p className="font-display text-xl font-bold">Sign in to build your shift profile</p>
            <a href="/sign-in?next=/work-profile/shifts" className="mt-5 inline-block rounded-pill px-6 py-3 font-semibold text-paper hover:brightness-95" style={{ background: SHIFTS }}>Sign in or create account</a>
          </div>
        )}
      </div>
    </div>
  );
}

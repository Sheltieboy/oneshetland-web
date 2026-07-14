import Link from "next/link";
import { redirect } from "next/navigation";
import { getAccount } from "@/lib/auth";
import { getEmployerProfile } from "@/lib/jobs-data.server";
import { EmployerProfileForm } from "@/components/jobs/EmployerProfileForm";
import { SHIFTS } from "@/components/jobs/JobsUI";

export const dynamic = "force-dynamic";
export const metadata = { title: "Business profile" };

export default async function EmployerProfilePage() {
  const account = await getAccount();
  if (!account) redirect("/sign-in?next=/work-profile/employer");

  const profile = await getEmployerProfile(account.id);

  return (
    <div className="mx-auto max-w-2xl px-5 py-10 sm:py-14">
      <Link href="/work" className="text-sm font-semibold text-ink-soft hover:text-ink">← My work</Link>
      <div className="mt-6">
        <p className="text-xs font-bold uppercase tracking-widest" style={{ color: SHIFTS }}>OneShetland · Shifts</p>
        <h1 className="mt-1 font-display text-4xl font-bold">Business profile</h1>
        <p className="mt-3 text-lg text-ink-soft">The business workers see when you post shifts and they apply.</p>
      </div>
      <div className="mt-8">
        <EmployerProfileForm
          initial={profile ? { business_name: profile.business_name ?? "", description: profile.description ?? "" } : null}
          fallbackName={account.profile?.full_name ?? ""}
        />
      </div>
    </div>
  );
}

import Link from "next/link";
import { getAccount } from "@/lib/auth";
import { getMyBusinesses } from "@/lib/jobs-data.server";
import { ShiftPostForm } from "@/components/jobs/ShiftPostForm";
import { SHIFTS } from "@/components/jobs/JobsUI";

export const dynamic = "force-dynamic";
export const metadata = { title: "Post a shift" };

export default async function NewShiftPage() {
  const account = await getAccount();
  const businesses = account ? await getMyBusinesses(account.id) : [];
  return (
    <div className="mx-auto max-w-2xl px-5 py-10 sm:py-14">
      <Link href="/jobs?tab=shifts" className="text-sm font-semibold text-ink-soft hover:text-ink">← Shifts</Link>
      <div className="mt-6">
        <p className="text-xs font-bold uppercase tracking-widest" style={{ color: SHIFTS }}>OneShetland · Shifts</p>
        <h1 className="mt-1 font-display text-4xl font-bold">Post a shift</h1>
        <p className="mt-3 text-lg text-ink-soft">Need cover at short notice? Reach available local workers in minutes.</p>
      </div>
      <div className="mt-8">
        <ShiftPostForm isLoggedIn={!!account} businesses={businesses} defaultName={account?.profile?.full_name ?? ""} />
      </div>
    </div>
  );
}

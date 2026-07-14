import Link from "next/link";
import { redirect } from "next/navigation";
import { getAccount } from "@/lib/auth";
import { FETCH } from "@/lib/fetch-data";
import { getDriverProfile, isApprovedDriver, isBankConnected, getRegions } from "@/lib/fetch-data.server";
import { RunComposer } from "@/components/fetch/RunComposer";

export const dynamic = "force-dynamic";
export const metadata = { title: "Create a run · Fetch" };

export default async function NewRunPage() {
  const account = await getAccount();
  if (!account) redirect("/sign-in?next=/fetch/runs/new");
  const dp = await getDriverProfile(account.id);
  if (!isApprovedDriver(dp)) redirect("/fetch?tab=driver");
  const regions = await getRegions();

  return (
    <div className="mx-auto max-w-2xl px-5 py-10 sm:py-14">
      <Link href="/fetch?tab=driver" className="text-sm font-semibold text-ink-soft hover:text-ink">← Driver dashboard</Link>
      <div className="mt-4 mb-8">
        <p className="text-xs font-bold uppercase tracking-widest" style={{ color: FETCH }}>OneShetland · Fetch</p>
        <h1 className="mt-1 font-display text-4xl font-bold">Create a run</h1>
        <p className="mt-2 text-lg text-ink-soft">Tell customers where you&apos;re heading and when — matched requests appear on your dashboard.</p>
      </div>
      <RunComposer canCreate={isBankConnected(dp)} regions={regions} />
    </div>
  );
}

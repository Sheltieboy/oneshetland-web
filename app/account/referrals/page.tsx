import Link from "next/link";
import { redirect } from "next/navigation";
import { getAccount } from "@/lib/auth";
import { ReferralsClient } from "./ReferralsClient";

export const dynamic = "force-dynamic";
export const metadata = { title: "Invite friends" };

export default async function ReferralsPage() {
  const account = await getAccount();
  if (!account) redirect("/sign-in?next=/account/referrals");

  return (
    <div className="space-y-6">
      <div>
        <Link href="/account" className="text-sm font-semibold text-ink-soft hover:underline">← My account</Link>
        <h1 className="mt-2 font-display text-3xl font-bold text-ink">Invite friends</h1>
        <p className="mt-1 text-sm text-ink-muted">
          Give £5, get £5 — when a friend joins with your code and makes their first purchase.
        </p>
      </div>

      <ReferralsClient />
    </div>
  );
}

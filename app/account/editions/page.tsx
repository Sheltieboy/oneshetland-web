import Link from "next/link";
import { redirect } from "next/navigation";
import { getAccount } from "@/lib/auth";
import { getMyPartnerships } from "@/lib/editions/data.server";
import { PartnershipInbox } from "@/components/editions-manage/PartnershipInbox";

export const dynamic = "force-dynamic";
export const metadata = { title: "Festival invitations" };

/** Everything an Edition has asked of anything you control (hub events and activities included). Business owners also get a scoped copy under their business. */
export default async function Page() {
  const account = await getAccount();
  if (!account) redirect(`/sign-in?next=${encodeURIComponent("/account/editions")}`);
  const all = await getMyPartnerships();
  return (
    <div className="mx-auto max-w-3xl px-5 py-8">
      <Link href="/account" className="text-sm font-semibold text-ink-soft hover:text-ink">← Account</Link>
      <h1 className="mt-3 font-display text-3xl font-bold text-ink">Festival invitations</h1>
      <div className="mt-6"><PartnershipInbox partnerships={all} /></div>
    </div>
  );
}

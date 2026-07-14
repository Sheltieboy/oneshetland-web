import Link from "next/link";
import { redirect } from "next/navigation";
import { getAccount } from "@/lib/auth";
import { FollowingClient } from "./FollowingClient";

export const dynamic = "force-dynamic";
export const metadata = { title: "Following" };

export default async function FollowingPage() {
  const account = await getAccount();
  if (!account) redirect("/sign-in?next=/account/following");

  return (
    <div className="space-y-6">
      <div>
        <Link href="/account" className="text-sm font-semibold text-ink-soft hover:underline">← My account</Link>
        <h1 className="mt-2 font-display text-3xl font-bold text-ink">Following</h1>
        <p className="mt-1 text-sm text-ink-muted">
          Shetland businesses you follow — tap through for their latest offers, events and loyalty.
        </p>
      </div>

      <FollowingClient />
    </div>
  );
}

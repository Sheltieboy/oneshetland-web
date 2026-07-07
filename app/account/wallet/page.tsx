import Link from "next/link";
import { redirect } from "next/navigation";
import { getAccount } from "@/lib/auth";
import { WalletClient } from "./WalletClient";

export const dynamic = "force-dynamic";
export const metadata = { title: "My wallet · OneShetland" };

export default async function WalletPage() {
  const account = await getAccount();
  if (!account) redirect("/sign-in?next=/account/wallet");

  return (
    <div className="space-y-6">
      <div>
        <Link href="/account" className="text-sm font-semibold text-ink-soft hover:underline">← My account</Link>
        <h1 className="mt-2 font-display text-3xl font-bold text-ink">My wallet</h1>
        <p className="mt-1 text-sm text-ink-muted">
          One balance to spend at participating Shetland businesses.
        </p>
      </div>

      <WalletClient isLoggedIn />
    </div>
  );
}

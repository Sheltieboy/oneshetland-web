import Link from "next/link";
import { redirect } from "next/navigation";
import { getAccount } from "@/lib/auth";
import { LoyaltyClient } from "./LoyaltyClient";

export const dynamic = "force-dynamic";
export const metadata = { title: "Loyalty cards" };

export default async function LoyaltyPage() {
  const account = await getAccount();
  if (!account) redirect("/sign-in?next=/account/loyalty");

  return (
    <div className="space-y-6">
      <div>
        <Link href="/account" className="text-sm font-semibold text-ink-soft hover:underline">← My account</Link>
        <h1 className="mt-2 font-display text-3xl font-bold text-ink">Loyalty cards</h1>
        <p className="mt-1 text-sm text-ink-muted">
          Stamps and points you&apos;ve collected at participating Shetland businesses.
        </p>
      </div>

      <LoyaltyClient />
    </div>
  );
}

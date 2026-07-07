import Link from "next/link";
import { redirect } from "next/navigation";
import { getAccount } from "@/lib/auth";
import { PassesClient } from "./PassesClient";

export const dynamic = "force-dynamic";
export const metadata = { title: "Passes & vouchers · OneShetland" };

export default async function PassesPage() {
  const account = await getAccount();
  if (!account) redirect("/sign-in?next=/account/passes");

  return (
    <div className="space-y-6">
      <div>
        <Link href="/account" className="text-sm font-semibold text-ink-soft hover:underline">← My account</Link>
        <h1 className="mt-2 font-display text-3xl font-bold text-ink">Passes &amp; vouchers</h1>
        <p className="mt-1 text-sm text-ink-muted">
          Day passes, class packs and vouchers you&apos;ve bought from Shetland businesses.
        </p>
      </div>

      <PassesClient />
    </div>
  );
}

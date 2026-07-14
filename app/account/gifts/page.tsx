import Link from "next/link";
import { redirect } from "next/navigation";
import { getAccount } from "@/lib/auth";
import { GiftsClient } from "./GiftsClient";

export const dynamic = "force-dynamic";
export const metadata = { title: "Gifts received" };

export default async function GiftsPage() {
  const account = await getAccount();
  if (!account) redirect("/sign-in?next=/account/gifts");

  return (
    <div className="space-y-6">
      <div>
        <Link href="/account" className="text-sm font-semibold text-ink-soft hover:underline">← My account</Link>
        <h1 className="mt-2 font-display text-3xl font-bold text-ink">Gifts received</h1>
        <p className="mt-1 text-sm text-ink-muted">
          Gifts sent to you through OneShetland. Booking gifts wait here until you pick a time.
        </p>
      </div>

      <GiftsClient />
    </div>
  );
}

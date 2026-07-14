import Link from "next/link";
import { redirect } from "next/navigation";
import { getAccount } from "@/lib/auth";
import { BookingsClient } from "./BookingsClient";

export const dynamic = "force-dynamic";
export const metadata = { title: "My bookings" };

export default async function BookingsPage() {
  const account = await getAccount();
  if (!account) redirect("/sign-in?next=/account/bookings");

  return (
    <div className="space-y-6">
      <div>
        <Link href="/account" className="text-sm font-semibold text-ink-soft hover:underline">← My account</Link>
        <h1 className="mt-2 font-display text-3xl font-bold text-ink">My bookings</h1>
        <p className="mt-1 text-sm text-ink-muted">
          Appointments you&apos;ve booked with Shetland businesses.
        </p>
      </div>

      <BookingsClient />
    </div>
  );
}

import Link from "next/link";
import { redirect } from "next/navigation";
import { getAccount } from "@/lib/auth";
import { getMyHubMemberships } from "@/lib/hubs-server";
import { isMembershipActive } from "@/lib/hubs-data";
import { MembershipCard } from "@/components/hubs/MembershipCard";

export const dynamic = "force-dynamic";
export const metadata = { title: "My memberships" };

export default async function MembershipsPage() {
  const account = await getAccount();
  if (!account) redirect("/sign-in?next=/account/memberships");

  const memberships = (await getMyHubMemberships()).filter(isMembershipActive);

  return (
    <>
      <section className="bg-navy text-paper">
        <div className="mx-auto max-w-3xl px-5 py-10 sm:py-12">
          <Link href="/account" className="text-sm font-semibold text-paper/80 hover:text-paper">← My account</Link>
          <h1 className="mt-3 font-display text-4xl font-bold">My memberships</h1>
          <p className="mt-2 text-paper/85">Your digital membership cards — show the QR code at the door.</p>
        </div>
      </section>

      <div className="mx-auto max-w-3xl px-5 py-10 sm:py-12">
        {memberships.length === 0 ? (
          <div className="rounded-xl border border-line bg-paper p-12 text-center shadow-soft">
            <h2 className="font-display text-xl font-bold">No memberships yet</h2>
            <p className="mx-auto mt-2 max-w-md text-ink-soft">Join a hub to get your digital membership card.</p>
            <Link href="/hubs" className="mt-6 inline-block rounded-pill bg-navy px-5 py-3 font-semibold text-paper hover:bg-navy-dark">Browse hubs</Link>
          </div>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2">
            {memberships.map((m) => (
              <MembershipCard key={m.id} m={m} />
            ))}
          </div>
        )}
      </div>
    </>
  );
}

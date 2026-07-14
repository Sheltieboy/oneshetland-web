import Link from "next/link";
import { redirect } from "next/navigation";
import { getAccount } from "@/lib/auth";
import { FETCH } from "@/lib/fetch-data";
import { getMyPreviousRequests } from "@/lib/fetch-data.server";
import { RequestCard, EmptyState } from "@/components/fetch/FetchUI";

export const dynamic = "force-dynamic";
export const metadata = { title: "Previous deliveries · Fetch" };

export default async function PreviousRequestsPage() {
  const account = await getAccount();
  if (!account) redirect("/sign-in?next=/fetch/previous");
  const requests = await getMyPreviousRequests(account.id);

  return (
    <div className="mx-auto max-w-4xl px-5 py-10 sm:py-14">
      <Link href="/fetch" className="text-sm font-semibold text-ink-soft hover:text-ink">← Fetch</Link>
      <div className="mt-4 mb-8">
        <p className="text-xs font-bold uppercase tracking-widest" style={{ color: FETCH }}>OneShetland · Fetch</p>
        <h1 className="mt-1 font-display text-4xl font-bold">Previous deliveries</h1>
      </div>
      {requests.length === 0 ? (
        <EmptyState icon="📋" title="No past deliveries yet" body="Your completed and cancelled deliveries will be listed here." cta={{ label: "Request a delivery", href: "/fetch/new" }} />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {requests.map((r) => <RequestCard key={r.id} req={r} href={`/fetch/${r.id}`} />)}
        </div>
      )}
    </div>
  );
}

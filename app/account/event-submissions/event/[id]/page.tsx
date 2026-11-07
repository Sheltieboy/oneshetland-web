import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { gateFeatureSignedIn, serverSb } from "@/lib/event-submissions-access.server";
import { loadContributorView } from "@/lib/event-submissions-client";
import { PAGE_NOT_AVAILABLE_YET } from "@/lib/contributor-copy";
import { ContributorEvent } from "@/components/events/contributor/ContributorEvent";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Look after your event", robots: { index: false, follow: false } };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** HIDDEN with the rest of the feature. Only the person who submitted the approved event sees anything here; everyone else gets a 404. */
export default async function ManageCommunityEventPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const { account } = await gateFeatureSignedIn(`/account/event-submissions/event/${id}`);
  const res = await loadContributorView(await serverSb(), account.id, id);
  if (res.ok && !res.data) notFound();

  return (
    <div>
      <p><Link href="/account/event-submissions" className="inline-flex min-h-11 items-center text-base font-semibold text-navy underline">Back to my events &amp; submissions</Link></p>
      {!res.ok ? (
        <p role="status" className="mt-6 rounded-2xl border border-line-strong bg-cream p-5 text-lg text-ink">{res.error.kind === "unavailable" ? PAGE_NOT_AVAILABLE_YET : res.error.message}</p>
      ) : (
        <ContributorEvent eventId={id} view={res.data!} />
      )}
    </div>
  );
}

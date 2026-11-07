import Link from "next/link";
import type { Metadata } from "next";
import { gateFeatureSignedIn, serverSb } from "@/lib/event-submissions-access.server";
import { listMySubmissions } from "@/lib/event-submissions-client";
import { viewSubmission } from "@/lib/event-submissions-shape";
import { PAGE_NOT_AVAILABLE_YET } from "@/lib/contributor-copy";
import { loadMyOrganisers } from "@/lib/event-organisers.server";
import { shouldSuggestHub } from "@/lib/event-ownership";
import { HubSuggestion } from "@/components/events/front-door/HubSuggestion";
import { MySubmissionsList } from "@/components/events/contributor/MySubmissionsList";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "My event submissions", robots: { index: false, follow: false } };

/** HIDDEN with the rest of the community-event feature: a 404 unless it is switched on (or an admin is previewing). Not in any navigation. */
export default async function MyEventSubmissionsPage() {
  const { account } = await gateFeatureSignedIn("/account/event-submissions");
  const sb = await serverSb();
  const res = await listMySubmissions(sb, account.id);
  // Which approved events have since been cancelled. A read that fails or returns nothing just leaves the list as it was.
  const cancelled = new Set<string>();
  if (res.ok) {
    const ids = res.data.flatMap((s) => (s.event_id ? [s.event_id] : []));
    if (ids.length) {
      try {
        const { data } = await sb.from("events").select("id, status").in("id", ids);
        for (const r of (data ?? []) as { id: string; status: string }[]) if (r.status === "cancelled") cancelled.add(r.id);
      } catch { /* leave the list as it was */ }
    }
  }

  // A gentle suggestion only: three or more of their own submissions that they have not withdrawn, and we know they run no hub yet.
  let suggestHub = false;
  if (res.ok) {
    const loaded = await loadMyOrganisers(account.id).catch(() => null);
    suggestHub = shouldSuggestHub({ statuses: res.data.map((s) => s.status), managesHub: loaded ? loaded.managesHub : null });
  }

  return (
    <div>
      <h1 className="font-display text-3xl font-bold text-ink">My event submissions</h1>
      <p className="mt-2 text-lg text-ink-soft">The events you have sent to us, and how each one is getting on.</p>
      {!res.ok ? (
        <p role="status" className="mt-6 rounded-2xl border border-line-strong bg-cream p-5 text-lg text-ink">
          {res.error.kind === "unavailable" ? PAGE_NOT_AVAILABLE_YET : res.error.message}
        </p>
      ) : res.data.length === 0 ? (
        <div className="mt-6 rounded-2xl border border-line-strong bg-cream p-5">
          <p className="text-lg text-ink">You haven&apos;t sent us an event yet.</p>
          <p className="mt-3"><Link href="/whats-on/add" className="inline-flex min-h-12 items-center rounded-pill bg-navy px-6 py-3 text-lg font-bold text-white">Tell us about an event</Link></p>
        </div>
      ) : (
        <MySubmissionsList items={res.data.map((s) => viewSubmission(s, s.event_id && cancelled.has(s.event_id) ? "cancelled" : null))} eventIds={Object.fromEntries(res.data.filter((s) => s.event_id).map((s) => [s.id, s.event_id!]))} />
      )}
      {suggestHub && <HubSuggestion />}
    </div>
  );
}

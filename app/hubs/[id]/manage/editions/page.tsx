import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getHub } from "@/lib/hubs-data";
import { isHubAdmin } from "@/lib/hubs-server";
import { getHubEditionsEntry, getMyHubEditions, getMyPartnerships } from "@/lib/editions/data.server";
import { HubEditionsPanel } from "@/components/editions-manage/HubEditionsPanel";
import { PartnershipInbox } from "@/components/editions-manage/PartnershipInbox";

export const dynamic = "force-dynamic";
export const metadata = { title: "Festivals & Editions", robots: { index: false, follow: false } };

/**
 * A Hub's Festivals & Editions page, for its owner and committee only (the same people who manage the Hub). Two things on one calm page: invitations from other Editions (answer,
 * choose what to show, step back), and running the Hub's own Editions. The underlying organiser link is never mentioned. While Editions ships dark the page does not exist
 * for anyone but platform staff and Hubs an administrator has linked.
 */
export default async function HubEditionsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const hub = await getHub(id);
  if (!hub) notFound();
  const admin = await isHubAdmin(hub.id);
  if (!admin.isAdmin) redirect(`/hubs/${hub.slug || hub.id}`);
  const entry = await getHubEditionsEntry(hub.id);
  if (!entry.show) notFound();
  const [mine, all] = await Promise.all([getMyHubEditions(), getMyPartnerships()]);
  const row = mine.find((h) => h.hub_id === hub.id) ?? null;
  const partnerships = all.filter((p) => p.kind === "hub" && p.subject_id === hub.id);
  const base = `/hubs/${hub.slug || hub.id}`;
  return (
    <div className="mx-auto max-w-3xl px-5 py-10 sm:py-12">
      <Link href={`${base}/manage`} className="text-sm text-ink-muted hover:underline">← Manage {hub.name}</Link>
      <h1 className="mt-2 font-display text-3xl font-bold text-ink">Festivals &amp; Editions</h1>
      <p className="mt-1 max-w-2xl text-ink-soft">Take part in other people&rsquo;s festivals, or run your own. You stay in charge of what is shown for {hub.name}, and your committee decides together.</p>
      <div className="mt-8 space-y-10">
        <HubEditionsPanel hubId={hub.id} hubName={hub.name} hubSlug={hub.slug ?? null} organiser={row?.organiser_slug ? { slug: row.organiser_slug, status: row.organiser_status ?? "pending", editions: row.edition_count } : null} />
        <PartnershipInbox partnerships={partnerships} hub={{ id: hub.id, name: hub.name }} />
        <p className="text-sm text-ink-muted">Invitations for one of your Hub&rsquo;s individual events or activities are on your <Link href="/account/editions" className="font-semibold text-ink underline underline-offset-[3px]">Festivals page</Link>.</p>
      </div>
    </div>
  );
}

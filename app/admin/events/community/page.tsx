import Link from "next/link";
import { AdminHeader, Empty } from "@/components/admin/AdminUI";
import { loadCommunityEvents } from "@/lib/event-submissions-admin.server";
import { COMMUNITY_LIMIT, COMMUNITY_TABS, STAFF_NOTE_LINE, STAFF_NO_NOTIFY_LINE, cleanSearch, parseCommunityTab } from "@/lib/event-community-admin";
import { CommunityEventsList } from "@/components/admin/CommunityEventsList";
import { PAGE_NOT_AVAILABLE_YET } from "@/lib/contributor-copy";

export const dynamic = "force-dynamic";
export const metadata = { title: "Community events", robots: { index: false, follow: false } };

/** Admin only (the admin layout enforces it). Published community events: find them, open them, cancel or restore a date or the whole event. */
export default async function Page({ searchParams }: { searchParams: Promise<{ tab?: string; q?: string }> }) {
  const sp = await searchParams;
  const tab = parseCommunityTab(sp.tab), q = cleanSearch(sp.q);
  const res = await loadCommunityEvents(tab, q);
  const href = (t: string) => `/admin/events/community?tab=${t}${q ? `&q=${encodeURIComponent(q)}` : ""}`;
  return (
    <>
      <AdminHeader title="Community events" sub="Events members sent in for community groups, once approved. Newest first." />
      <p className="mb-4"><Link href="/admin/events/submissions" className="text-sm font-semibold text-navy underline">Event submissions</Link> · <Link href="/admin/events/changes" className="text-sm font-semibold text-navy underline">Change requests</Link></p>
      <p className="mb-4 text-sm text-ink-soft">{STAFF_NO_NOTIFY_LINE} {STAFF_NOTE_LINE}</p>
      <nav aria-label="Event status" className="mb-4 flex flex-wrap gap-2">
        {COMMUNITY_TABS.map((t) => (
          <Link key={t.tab} href={href(t.tab)} aria-current={t.tab === tab ? "page" : undefined}
            className={`inline-flex min-h-11 items-center rounded-pill px-4 text-sm font-bold ${t.tab === tab ? "bg-navy text-white" : "border border-line-strong bg-paper text-ink"}`}>{t.label}</Link>
        ))}
      </nav>
      <form action="/admin/events/community" method="get" role="search" className="mb-5 flex flex-wrap items-end gap-3">
        <input type="hidden" name="tab" value={tab} />
        <div>
          <label htmlFor="ce-q" className="block text-sm font-semibold text-ink-soft">Search by event name</label>
          <input id="ce-q" name="q" type="search" defaultValue={q} maxLength={80} className="mt-1 block min-h-11 w-72 max-w-full rounded-xl border border-line-strong bg-paper px-3 text-base text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-navy" />
        </div>
        <button type="submit" className="inline-flex min-h-11 items-center rounded-pill bg-navy px-5 text-sm font-bold text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-navy">Search</button>
        {q && <Link href={`/admin/events/community?tab=${tab}`} className="inline-flex min-h-11 items-center text-sm font-semibold text-navy underline">Clear search</Link>}
      </form>
      {!res.ok ? <Empty>{res.error.kind === "unavailable" ? PAGE_NOT_AVAILABLE_YET : res.error.message}</Empty>
        : (<>
            <CommunityEventsList items={res.data} emptyText={q ? "No community events match that name." : "No community events here yet."} />
            {res.data.length >= COMMUNITY_LIMIT && <p className="mt-4 text-sm text-ink-soft">Showing the newest {COMMUNITY_LIMIT}. Search by name to find an older one.</p>}
          </>)}
    </>
  );
}

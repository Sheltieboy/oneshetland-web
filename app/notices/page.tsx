import Link from "next/link";
import { getAccount } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { callRpc } from "@/lib/notices-rpc";
import { getAreaOptions, getFuneralNotices, getMyAreas, getNoticesPage } from "@/lib/notices-data";
import {
  NOTICE_CATEGORIES, NOTICE_TABS, TAB_LABEL, areaArgForQuery, noticesHref, parseNoticesQuery,
  type NoticeCardModel, type NoticeTab,
} from "@/lib/notices-alerts";
import { NoticeCard } from "@/components/notices/NoticeCard";
import { FuneralCard } from "@/components/notices/FuneralNotice";
import { AreaFilter } from "@/components/notices/NoticesFilters";
import { Notice, NoticesHeader } from "@/components/notices/NoticesShell";

export const dynamic = "force-dynamic";
export const metadata = { title: "Notices", description: "Essential alerts, health and official notices, community notices and funeral announcements across Shetland." };

type SP = Promise<Record<string, string | string[] | undefined>>;

/** Public Notices page. URL state drives everything (?tab=&area=&cat=&page=) so any view can be shared. Server-rendered. */
export default async function NoticesPage({ searchParams }: { searchParams: SP }) {
  const q = parseNoticesQuery(await searchParams);
  const account = await getAccount();
  const myAreas = account ? await getMyAreas() : null;
  const hasMyAreas = !!myAreas && myAreas.length > 0;
  // "My areas" only applies to a member who has chosen some; for anyone else the link would be a no-op, so it is treated as no filter.
  const areaArg = areaArgForQuery(q.area, myAreas);

  const isFuneral = q.tab === "funeral";
  const [list, funeral] = await Promise.all([
    isFuneral ? null : getNoticesPage({ level: q.tab as Exclude<NoticeTab, "funeral">, areaIds: areaArg, category: q.category, page: q.page }),
    isFuneral ? getFuneralNotices({ areaIds: areaArg, page: q.page }) : null,
  ]);
  const options = await getAreaOptions(list && list.ok ? list.data.rows : []);

  // A signed-in member who belongs to a verified organisation is offered the publishing page.
  let canPublish = false;
  if (account) {
    const r = await callRpc<unknown>(await createClient(), "my_official_publishers");
    canPublish = r.ok && Array.isArray(r.data) && r.data.length > 0;
  }

  const tabHref = (t: NoticeTab) => noticesHref({ ...q, tab: t, page: 1 });
  const chip = (on: boolean) => "inline-flex min-h-[44px] shrink-0 items-center rounded-pill px-4 text-sm font-semibold transition " + (on ? "bg-navy text-paper shadow-soft" : "border border-line-strong text-ink-soft hover:bg-sand");
  const rows: NoticeCardModel[] = list && list.ok ? list.data.rows : [];
  const hasMore = list && list.ok ? list.data.hasMore : funeral && funeral.ok ? funeral.data.hasMore : false;
  const failed = (list && !list.ok ? list.error : null) ?? (funeral && !funeral.ok ? funeral.error : null);
  const activeFilters: { label: string; href: string }[] = [];
  if (q.area.mode !== "all") activeFilters.push({ label: q.area.mode === "my" ? "My areas" : q.area.mode === "wide" ? "Shetland-wide only" : q.area.ids.map((id) => options.find((o) => o.id === id)?.name ?? id).join(", "), href: noticesHref({ ...q, area: { mode: "all" }, page: 1 }) });
  if (q.category) activeFilters.push({ label: NOTICE_CATEGORIES.find((c) => c.id === q.category)?.label ?? q.category, href: noticesHref({ ...q, category: null, page: 1 }) });

  return (
    <>
      <NoticesHeader title="Notices" intro="Essential alerts, health and official information, community notices and funeral announcements from across the isles." />
      <div className="mx-auto max-w-6xl px-5 py-8 sm:py-10">
        <nav aria-label="Notice types" className="-mx-5 flex gap-2 overflow-x-auto px-5 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {NOTICE_TABS.map((t) => <Link key={t} href={tabHref(t)} className={chip(q.tab === t)} aria-current={q.tab === t ? "page" : undefined}>{TAB_LABEL[t]}</Link>)}
        </nav>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <AreaFilter options={options} query={q} hasMyAreas={hasMyAreas} />
          {activeFilters.map((f) => (
            <Link key={f.label} href={f.href} className="inline-flex min-h-[44px] items-center gap-2 rounded-pill bg-sand px-4 text-sm font-semibold text-ink-soft hover:bg-line">{f.label}<span aria-hidden>{"×"}</span><span className="sr-only">Remove filter</span></Link>
          ))}
          {account && !hasMyAreas && <Link href="/account/notifications" className="text-sm font-semibold text-navy-light underline">Choose your areas</Link>}
        </div>

        {!isFuneral && (
          <div className="-mx-5 mt-3 flex gap-2 overflow-x-auto px-5 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" role="group" aria-label="Category">
            <Link href={noticesHref({ ...q, category: null, page: 1 })} className={chip(!q.category)}>Any category</Link>
            {NOTICE_CATEGORIES.map((c) => <Link key={c.id} href={noticesHref({ ...q, category: c.id, page: 1 })} className={chip(q.category === c.id)} aria-current={q.category === c.id ? "true" : undefined}>{c.label}</Link>)}
          </div>
        )}

        <div className="mt-6">
          {failed && <Notice tone="error">Notices could not be loaded just now ({failed}). Please try again in a moment.</Notice>}

          {!failed && isFuneral && funeral && funeral.ok && (
            funeral.data.rows.length ? (
              <>
                <p className="mb-4 text-sm text-ink-muted">Announcements are checked with the family before they are published.</p>
                <ul className="grid auto-rows-fr grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {funeral.data.rows.map((v) => <li key={v.id} className="min-w-0"><FuneralCard v={v} /></li>)}
                </ul>
              </>
            ) : <Notice>There are no funeral announcements{q.area.mode === "all" ? "" : " for this area"} at the moment.</Notice>
          )}

          {!failed && !isFuneral && (
            rows.length ? (
              <ul className="space-y-4">{rows.map((n) => <li key={n.id}><NoticeCard n={n} variant="full" /></li>)}</ul>
            ) : <Notice>There are no {q.tab === "all" ? "" : TAB_LABEL[q.tab].toLowerCase() + " "}notices{q.area.mode !== "all" || q.category ? " matching these filters" : " at the moment"}. {activeFilters.length > 0 && <Link className="font-semibold underline" href={noticesHref({ tab: q.tab })}>Clear filters</Link>}</Notice>
          )}

          {hasMore && <div className="mt-6 text-center"><Link href={noticesHref({ ...q, page: q.page + 1 })} scroll={false} className="inline-flex min-h-[48px] items-center rounded-pill border border-line-strong bg-paper px-6 text-sm font-bold text-ink hover:bg-sand">Show more</Link></div>}
        </div>

        <div className="mt-10 flex flex-wrap gap-x-6 border-t border-line pt-4 text-sm">
          <Link href="/notices/funeral/submit" className="inline-flex min-h-[44px] items-center font-semibold text-navy-light underline">Submit a funeral announcement</Link>
          {account && <Link href="/account/notifications" className="inline-flex min-h-[44px] items-center font-semibold text-navy-light underline">Choose which notices you hear about</Link>}
          {canPublish && <Link href="/notices/publish" className="inline-flex min-h-[44px] items-center font-semibold text-navy-light underline">Publish as your organisation</Link>}
        </div>
      </div>
    </>
  );
}

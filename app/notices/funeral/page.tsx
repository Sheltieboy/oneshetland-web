import Link from "next/link";
import { getAccount } from "@/lib/auth";
import { getAreaOptions, getFuneralNotices, getMyAreas } from "@/lib/notices-data";
import { areaArgForQuery, noticesHref, parseNoticesQuery } from "@/lib/notices-alerts";
import { FuneralCard } from "@/components/notices/FuneralNotice";
import { AreaFilter } from "@/components/notices/NoticesFilters";
import { Notice, NoticesHeader } from "@/components/notices/NoticesShell";

export const dynamic = "force-dynamic";
export const metadata = { title: "Deaths & funeral notices", description: "Funeral announcements from across Shetland, checked with the family before publication." };

export default async function FuneralListPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const q = parseNoticesQuery({ ...(await searchParams), tab: "funeral" });
  const account = await getAccount();
  const myAreas = account ? await getMyAreas() : null;
  const [r, options] = await Promise.all([getFuneralNotices({ areaIds: areaArgForQuery(q.area, myAreas), page: q.page }), getAreaOptions()]);
  return (
    <>
      <NoticesHeader tone="quiet" title="Deaths & funeral notices" intro="Announcements are only published once we have checked the details with the family or their funeral director." />
      <div className="mx-auto max-w-6xl px-5 py-8 sm:py-10">
        <div className="flex flex-wrap items-center gap-3">
          <AreaFilter options={options} query={q} hasMyAreas={!!myAreas && myAreas.length > 0} base="/notices/funeral" />
          <Link href="/notices" className="inline-flex min-h-[44px] items-center text-sm font-semibold text-navy-light underline">All notices</Link>
        </div>
        <div className="mt-6">
          {!r.ok && <Notice tone="error">Funeral announcements could not be loaded just now ({r.error}). Please try again in a moment.</Notice>}
          {r.ok && r.data.rows.length === 0 && <Notice>There are no funeral announcements{q.area.mode === "all" ? "" : " for this area"} at the moment.</Notice>}
          {r.ok && r.data.rows.length > 0 && (
            <ul className="grid auto-rows-fr grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {r.data.rows.map((v) => <li key={v.id} className="min-w-0"><FuneralCard v={v} /></li>)}
            </ul>
          )}
          {r.ok && r.data.hasMore && <div className="mt-6 text-center"><Link href={noticesHref({ ...q, page: q.page + 1 }, "/notices/funeral")} scroll={false} className="inline-flex min-h-[48px] items-center rounded-pill border border-line-strong bg-paper px-6 text-sm font-bold text-ink hover:bg-sand">Show more</Link></div>}
        </div>
        <div className="mt-10 flex flex-wrap gap-x-6 border-t border-line pt-4 text-sm">
          <Link href="/notices/funeral/submit" className="inline-flex min-h-[44px] items-center font-semibold text-navy-light underline">Submit an announcement</Link>
          {account && <Link href="/notices/funeral/mine" className="inline-flex min-h-[44px] items-center font-semibold text-navy-light underline">My submissions</Link>}
        </div>
      </div>
    </>
  );
}

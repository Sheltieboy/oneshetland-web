import Link from "next/link";
import type { BoardItem, Run } from "@/lib/fetch-api";
import { boardWhen, matchLabel, pounds, sizeLabel } from "@/lib/fetch/present";

export { matchLabel };
import { FETCH_ACCENT, Notice } from "@/components/fetch/v2/ui";

export function BoardCard({ item, runs }: { item: BoardItem; runs: Run[] }) {
  const m = matchLabel(item, runs);
  const run = item.match === "your_run";
  return (
    <li>
      <Link href={`/fetch/board/${item.request_id}`}
        className={`block rounded-card border bg-paper p-4 shadow-soft hover:bg-sand/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#e0722a] ${run ? "border-2" : "border-line"}`}
        style={run ? { borderColor: FETCH_ACCENT } : undefined}>
        {m && (
          <p className={`mb-2 inline-block rounded-pill px-2.5 py-0.5 text-xs font-bold uppercase tracking-wide ${run ? "text-white" : item.match === "beyond_vehicle" ? "bg-sand text-ink-muted" : "bg-orange-50 text-ink"}`}
            style={run ? { background: FETCH_ACCENT } : undefined}>{run ? "★ " : ""}{m}</p>
        )}
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <p className="font-display text-lg font-bold text-ink">
            {item.pickup_area ? `${item.pickup_area}, ` : ""}{item.pickup_region} <span aria-hidden>→</span><span className="sr-only">to</span> {item.destination_area ? `${item.destination_area}, ` : ""}{item.destination_region}
          </p>
          <p className="text-right font-display text-lg font-bold text-ink"><span className="block font-sans text-xs font-normal text-ink-muted">You&apos;d receive</span>{pounds(item.driver_pay_pence)}</p>
        </div>
        <p className="text-ink">{item.item_description}</p>
        <p className="text-sm text-ink-soft">
          {sizeLabel(item.size_class)}{item.handling_flags.includes("heavy_two_person") ? " · two-person lift" : ""}{item.ferry_required ? " · ferry" : ""} · {boardWhen(item)}
          {item.matching_photo_ids.length > 0 ? " · photo" : ""}
        </p>
        {item.match_summary && item.match !== "other" && <p className="mt-1 text-xs font-semibold text-ink-soft">{item.match_summary}</p>}
      </Link>
    </li>
  );
}

export function BoardList({ items, runs, showAll, problem }: { items: BoardItem[]; runs: Run[]; showAll: boolean; problem: string | null }) {
  return (
    <div className="space-y-3">
      {problem && <Notice tone="warn">{problem} You can look, but can&apos;t accept a Fetch until it&apos;s sorted. <Link href="/fetch/driver/verification" className="font-semibold underline">Check your driver status</Link></Notice>}
      <nav aria-label="Which Fetches" className="flex gap-2 text-sm">
        <Link href="/fetch/board" aria-current={!showAll ? "page" : undefined} className={`rounded-pill px-3 py-1 font-semibold ${!showAll ? "bg-navy text-white" : "bg-sand text-ink"}`}>Suits you</Link>
        <Link href="/fetch/board?all=1" aria-current={showAll ? "page" : undefined} className={`rounded-pill px-3 py-1 font-semibold ${showAll ? "bg-navy text-white" : "bg-sand text-ink"}`}>Show all</Link>
      </nav>
      {items.length === 0 ? (
        <p className="rounded-card border border-dashed border-line p-6 text-center text-ink-soft">
          {showAll ? "No Fetches are waiting right now." : "Nothing suits your journeys or areas right now."}
          {" "}<Link href="/fetch/journeys/new" className="font-semibold underline">Tell us where you&apos;re going</Link>{!showAll && <> or <Link href="/fetch/board?all=1" className="font-semibold underline">show all</Link></>}.
        </p>
      ) : <ul className="space-y-3">{items.map((i) => <BoardCard key={i.request_id} item={i} runs={runs} />)}</ul>}
    </div>
  );
}

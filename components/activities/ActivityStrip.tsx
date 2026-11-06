import Link from "next/link";
import { activityHref, dayLabel, REGULAR_HREF, regularHref, timeRange, type ListingRow, type When } from "@/lib/activities";
import { REGULAR } from "./tokens";

const TITLE: Record<When, string> = { today: "Regular activities today", tomorrow: "Regular activities tomorrow", week: "Regular activities this week", fortnight: "Regular activities", month: "Regular activities this month" };

/**
 * The compact discovery strip on What's On (Events). It sits OUTSIDE the events mosaic, one card per ACTIVITY, and points to the Regular
 * activities tab. With no activities for the chosen period it renders nothing at all.
 */
export function ActivityStrip({ items, when, now }: { items: ListingRow[]; when: When; now?: Date }) {
  const live = items.filter((a) => a.next_starts_at && a.next_ends_at);
  if (items.length === 0) return null;
  const shown = (live.length ? live : items).slice(0, 3);
  return (
    <section aria-labelledby="regular-strip-h" className="mb-6 rounded-card border border-line bg-paper p-3 shadow-soft sm:mb-8 sm:p-4" data-activity-strip>
      <div className="flex items-baseline justify-between gap-3">
        <div className="min-w-0">
          <h2 id="regular-strip-h" className="truncate font-display text-base font-bold text-ink sm:text-lg">{TITLE[when]}</h2>
          <p className="hidden text-sm text-ink-soft sm:block">Classes, groups and weekly sessions that keep going.</p>
        </div>
        <Link href={when === "fortnight" ? REGULAR_HREF : regularHref({ when })} className="shrink-0 text-sm font-bold underline-offset-2 hover:underline" style={{ color: REGULAR }}>
          <span className="sm:hidden">See all →</span><span className="hidden sm:inline">See all regular activities →</span>
        </Link>
      </div>
      <ul className="-mx-3 mt-2.5 flex scroll-pl-3 snap-x snap-mandatory gap-3 overflow-x-auto px-3 pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:-mx-0 sm:mt-3 sm:grid sm:grid-cols-3 sm:overflow-visible sm:px-0">
        {shown.map((a) => (
          <li key={a.id} className="w-[15.5rem] shrink-0 snap-start sm:w-auto">
            <Link href={activityHref(a.slug)} className="flex min-h-[64px] flex-col justify-center rounded-xl border border-line bg-cream px-3 py-2 transition hover:bg-sand focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2">
              <span className="truncate font-display text-base font-bold leading-tight text-ink">{a.title}</span>
              <span className="truncate text-xs text-ink-soft">
                {a.next_starts_at && a.next_ends_at ? `${dayLabel(a.next_starts_at, now)} ${timeRange(a.next_starts_at, a.next_ends_at)}` : "Cancelled in this period"}
                {a.locality ? ` · ${a.locality}` : ""}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

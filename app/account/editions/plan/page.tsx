import Link from "next/link";
import { redirect } from "next/navigation";
import { getAccount } from "@/lib/auth";
import { getEditionsEnabled, getMyPlan } from "@/lib/editions/data.server";
import { groupPlan, planDays } from "@/lib/editions/plan";
import { timeLabel, dateRangeLabel } from "@/lib/editions/rules";
import { PlanRemoveButton } from "@/components/editions/PlanRemoveButton";

export const dynamic = "force-dynamic";
export const metadata = { title: "My plan" };

const dayLabel = (day: string) => new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", weekday: "long", day: "numeric", month: "long" }).format(new Date(`${day}T12:00:00Z`));

/** The visitor's personal plan across every Edition they follow: by day, with clash warnings and a calendar download. Private to the signed-in user. */
export default async function PlanPage() {
  const account = await getAccount();
  if (!account) redirect(`/sign-in?next=${encodeURIComponent("/account/editions/plan")}`);
  const rows = await getMyPlan();
  const editions = groupPlan(rows);
  const days = planDays(editions);
  const enabled = await getEditionsEnabled();
  const link = "font-semibold text-ink underline decoration-2 underline-offset-[3px] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink";
  const edById = new Map(editions.map((e) => [e.id, e]));
  return (
    <div className="mx-auto max-w-3xl px-5 py-8">
      <Link href="/account" className="text-sm font-semibold text-ink-soft hover:text-ink">← Account</Link>
      <h1 className="mt-3 font-display text-3xl font-bold text-ink sm:text-4xl">My plan</h1>
      <p className="mt-2 max-w-[58ch] text-ink-soft">Sessions and events you have picked from festivals and seasons. If a partner withdraws or an Edition is taken down, it disappears from here automatically.</p>

      {editions.length === 0 ? (
        <section className="mt-8 rounded-2xl border border-line bg-paper p-6 shadow-soft">
          <h2 className="font-display text-2xl font-bold text-ink">Nothing in your plan yet</h2>
          <p className="mt-2 text-ink-soft">Open an Edition, press <strong className="font-semibold text-ink">Add to my plan</strong> on the sessions you like, and they will appear here by day.</p>
          {enabled && <p className="mt-4"><Link href="/editions" className={link}>Browse Editions</Link></p>}
        </section>
      ) : (
        <>
          {days.length > 0 && <p className="mt-5"><a href="/account/editions/plan/calendar.ics" download className="inline-flex min-h-11 items-center rounded-pill bg-navy px-5 text-sm font-semibold text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink">Add my plan to my calendar<span className="sr-only"> (downloads a calendar file)</span></a></p>}
          <div className="mt-8 space-y-10">
            {days.map((d) => (
              <section key={d.day} aria-labelledby={`pd-${d.day}`}>
                <h2 id={`pd-${d.day}`} className="border-b-2 border-ink/80 pb-2 font-display text-2xl font-bold text-ink">{dayLabel(d.day)}</h2>
                {d.clashes.size > 0 && <p role="note" className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-sm font-medium text-amber-950">Some things on this day overlap. They are marked below.</p>}
                <ol className="mt-4 space-y-3">
                  {d.items.map((i) => {
                    const clash = d.clashes.has(i.id);
                    const cancelled = i.status === "cancelled";
                    return (
                      <li key={`${i.kind}-${i.id}`} className="rounded-2xl border border-line bg-paper p-4 shadow-soft">
                        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
                          <time dateTime={i.starts_at} className="font-bold tabular-nums text-ink">{i.ends_at ? `${timeLabel(i.starts_at)} to ${timeLabel(i.ends_at)}` : timeLabel(i.starts_at)}</time>
                          <span className="text-ink-muted">{edById.get(i.editionId)?.title}</span>
                          {clash && <span className="rounded-pill border border-amber-300 bg-amber-50 px-2.5 py-0.5 text-xs font-bold text-amber-950">Overlaps another item</span>}
                          {cancelled && <span className="rounded-pill border border-red-300 bg-red-50 px-2.5 py-0.5 text-xs font-bold text-red-900">Cancelled</span>}
                          {i.status === "postponed" && <span className="rounded-pill border border-amber-300 bg-amber-50 px-2.5 py-0.5 text-xs font-bold text-amber-950">Postponed</span>}
                        </p>
                        <h3 className={`mt-1 font-display text-lg font-bold text-ink [overflow-wrap:anywhere] ${cancelled ? "line-through decoration-2" : ""}`}>{i.href ? <Link href={i.href} className="underline-offset-[3px] hover:underline">{i.title}</Link> : i.title}</h3>
                        {i.venue && <p className="text-sm text-ink-soft">{i.venue}</p>}
                        <div className="mt-1"><PlanRemoveButton editionId={i.editionId} kind={i.kind} itemId={i.id} title={i.title} /></div>
                      </li>
                    );
                  })}
                </ol>
              </section>
            ))}
          </div>
          <section aria-labelledby="following-h" className="mt-12">
            <h2 id="following-h" className="font-display text-2xl font-bold text-ink">Editions you follow</h2>
            <ul className="mt-4 divide-y divide-line overflow-hidden rounded-2xl border border-line bg-paper">
              {editions.map((e) => (
                <li key={e.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                  <div className="min-w-0">
                    <Link href={`/editions/${e.slug}`} className="font-semibold text-ink underline-offset-[3px] hover:underline">{e.title}</Link>
                    <p className="text-sm text-ink-soft">{dateRangeLabel(e.starts_on, e.ends_on)}{e.lastUpdateAt ? ` · latest news ${new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", day: "numeric", month: "short" }).format(new Date(e.lastUpdateAt))}` : ""}</p>
                  </div>
                  {e.saved && <PlanRemoveButton editionId={e.id} kind="edition" itemId={e.id} title={e.title} />}
                </li>
              ))}
            </ul>
          </section>
        </>
      )}
    </div>
  );
}

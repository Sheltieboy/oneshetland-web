import Link from "next/link";
import { WhatsOnTabs } from "@/components/activities/WhatsOnTabs";
import { RegularFilters } from "@/components/activities/RegularFilters";
import { ActivityCard } from "@/components/activities/ActivityCard";
import { REGULAR } from "@/components/activities/tokens";
import { getActivityListing, getRulesFor } from "@/lib/activities-data";
import { SHETLAND_AREAS } from "@/lib/local-data";
import { parseDays, parseWhen, regularHref, safeCategory, WHEN_OPTIONS, type RegularFilters as F } from "@/lib/activities";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Regular activities",
  description: "Classes, groups and weekly sessions across Shetland: one listing for each, with the next session, and changes shown as they happen.",
};

export default async function RegularActivitiesPage({ searchParams }: { searchParams: Promise<{ when?: string; days?: string; category?: string; place?: string; dropin?: string; q?: string }> }) {
  const sp = await searchParams;
  const now = new Date();
  const place = SHETLAND_AREAS.find((a) => a.label.toLowerCase() === (sp.place ?? "").toLowerCase())?.label;
  const f: F = { when: parseWhen(sp.when), days: parseDays(sp.days), category: safeCategory(sp.category), locality: place, dropIn: sp.dropin === "1", q: sp.q?.trim().slice(0, 80) || undefined };
  const rows = await getActivityListing(f, now);
  const rules = await getRulesFor(rows.map((r) => r.id));
  const filtered = !!(f.days.length || f.category || f.locality || f.dropIn || f.q || f.when !== "fortnight");
  const whenLabel = WHEN_OPTIONS.find((o) => o.value === f.when)?.label.toLowerCase();

  return (
    <>
      <section className="relative isolate overflow-hidden text-paper" style={{ background: REGULAR }}>
        <div className="absolute inset-0" style={{ background: `linear-gradient(135deg, ${REGULAR}, #134e4a)` }} />
        <div className="relative mx-auto max-w-6xl px-5 py-8 sm:py-14">
          <p className="eyebrow text-paper/85">What&apos;s On</p>
          <h1 className="mt-2 font-display text-4xl font-bold leading-none sm:text-6xl">Regular activities</h1>
          <p className="mt-4 max-w-xl text-lg text-paper/90">Classes, groups and weekly sessions across the isles. One listing for each, with the next session and any changes.</p>
        </div>
      </section>

      {/* The same switch, in the same place, as on Events. */}
      <div className="border-b border-line bg-cream">
        <div className="mx-auto max-w-6xl px-5 py-2.5"><WhatsOnTabs active="regular" /></div>
      </div>

      <div className="mx-auto max-w-6xl px-5 pb-10 pt-6 sm:pb-12">
        <form action="/whats-on/regular" method="get" className="flex gap-2" role="search">
          {f.when !== "fortnight" && <input type="hidden" name="when" value={f.when} />}
          {f.days.length > 0 && <input type="hidden" name="days" value={f.days.join(",")} />}
          {f.category && <input type="hidden" name="category" value={f.category} />}
          {f.locality && <input type="hidden" name="place" value={f.locality} />}
          {f.dropIn && <input type="hidden" name="dropin" value="1" />}
          <input name="q" defaultValue={f.q ?? ""} placeholder="Search classes and groups" aria-label="Search regular activities" className="min-w-0 flex-1 rounded-pill border border-line-strong bg-white px-4 py-2.5 text-sm text-ink focus:outline-none focus:ring-2" maxLength={80} />
          <button type="submit" className="shrink-0 rounded-pill px-5 py-2.5 text-sm font-bold text-paper" style={{ background: REGULAR }}>Search</button>
        </form>
        <div className="mt-4"><RegularFilters f={f} areas={SHETLAND_AREAS} /></div>

        <div className="mt-8">
        {rows.length === 0 ? (
          <div className="rounded-card border border-line bg-paper p-10 text-center shadow-soft">
            <h2 className="font-display text-2xl font-bold">{filtered ? "No regular activities match that" : "No regular activities listed yet"}</h2>
            <p className="mx-auto mt-2 max-w-md text-ink-soft">
              {filtered ? `Nothing has a session ${whenLabel ? `(${whenLabel}) ` : ""}with those choices. Try another day or clear a filter.` : "New classes and groups are being added. Check back soon."}
            </p>
            {filtered && <Link href={regularHref({})} className="mt-6 inline-block rounded-pill px-5 py-3 font-semibold text-paper" style={{ background: REGULAR }}>Clear filters</Link>}
          </div>
        ) : (
          <>
            <p className="mb-5 text-sm text-ink-muted" aria-live="polite">{rows.length} {rows.length === 1 ? "activity" : "activities"}{whenLabel ? ` with sessions ${f.when === "today" || f.when === "tomorrow" ? whenLabel : `in ${whenLabel}`}` : ""}</p>
            <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {rows.map((a) => <ActivityCard key={a.id} a={a} rules={rules.get(a.id)} now={now} />)}
            </ul>
          </>
        )}
        </div>
        <p className="mt-10 rounded-card border border-dashed border-line-strong p-4 text-sm text-ink-soft">
          Run a class or group? Businesses and hubs can list regular activities free from their Manage screen: weekly times, cancellations and holiday breaks included, no booking or payment set-up needed.
        </p>
      </div>
    </>
  );
}

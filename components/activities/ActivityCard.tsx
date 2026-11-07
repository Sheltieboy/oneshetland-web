import Link from "next/link";
import { CATEGORY_LABEL, activityHref, nextLine, patternText, safeHttps, type ListingRow, type RuleRow } from "@/lib/activities";
import { activityOrganiserLabel } from "@/lib/activity-organiser";
import { HERO, REGULAR } from "./tokens";
import { ActivityImage } from "./ActivityImage";

/** ONE card per activity, however many sessions it runs. */
export function ActivityCard({ a, rules, now }: { a: ListingRow; rules?: RuleRow[]; now?: Date }) {
  const next = nextLine(a, now);
  const organiser = activityOrganiserLabel(a.owner_kind, a.owner_name);   // null for a platform-owned activity: no organiser claim
  const place = [a.venue, a.locality].filter(Boolean).join(", ");
  const drop = a.booking_mode === "drop_in";
  return (
    <li className="list-none">
      <Link
        href={activityHref(a.slug)}
        className="group flex h-full flex-col overflow-hidden rounded-card border border-line bg-paper shadow-soft transition hover:shadow-lift focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
      >
        {safeHttps(a.cover_url)
          ? <div className="aspect-[16/9] w-full shrink-0 overflow-hidden bg-sand" data-card-photo><ActivityImage url={a.cover_url} /></div>
          : <div aria-hidden className="h-1.5 w-full shrink-0" data-card-colour style={{ background: `linear-gradient(90deg, ${(HERO[a.category] ?? HERO.other)[0]}, ${(HERO[a.category] ?? HERO.other)[1]})` }} />}
        <div className="flex flex-1 flex-col p-4">
        <div className="flex flex-wrap items-center gap-1.5 text-[11px] font-bold uppercase tracking-widest">
          <span style={{ color: REGULAR }}>{CATEGORY_LABEL[a.category] ?? "Activity"}</span>
          {a.audience && <span className="text-ink-muted normal-case tracking-normal">· {a.audience}</span>}
        </div>
        <h3 className="mt-1 font-display text-xl font-bold leading-tight text-ink group-hover:underline">{a.title}</h3>
        {organiser && <p className="mt-0.5 text-sm text-ink-soft">{organiser}</p>}
        {rules && rules.length > 0 && <p className="mt-2 text-sm font-semibold text-ink">{patternText(rules)}</p>}
        <p className={"mt-2 inline-flex w-fit rounded-pill px-3 py-1 text-sm font-semibold " + (next.tone === "ok" ? "bg-sand text-ink" : "bg-amber-50 text-amber-900")}>{next.text}</p>
        {a.upcoming.some((u) => u.status === "cancelled" || u.status === "moved" || u.status === "changed" || u.status === "break") && (
          <p className="mt-1.5 text-xs font-semibold text-amber-800">
            {a.upcoming.find((u) => u.status === "cancelled" || u.status === "break") ? "A session is cancelled" : "A session has changed"}: check before you go
          </p>
        )}
        <div className="mt-auto flex flex-wrap gap-x-3 gap-y-1 pt-3 text-xs text-ink-muted">
          {place && <span>{place}</span>}
          {a.price_text && <span>{a.price_text}</span>}
          <span>{drop ? "Drop in" : a.booking_mode === "contact" ? "Get in touch to join" : "Booking link"}</span>
        </div>
        </div>
      </Link>
    </li>
  );
}

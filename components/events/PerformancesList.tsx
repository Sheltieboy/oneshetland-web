import { displayOccurrences, nextOccurrence, liveOccurrence, type Occurrence } from "@/lib/event-occurrences";

const TZ = "Europe/London";
/** Text-safe darker shade of the What's On amber (the bright one is for fills; on white it is under 3:1). */
const ACCENT_TEXT = "#8a5a05";

const dateLabel = (iso: string) =>
  new Date(iso).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", timeZone: TZ });
const clock = (iso: string) =>
  new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone: TZ });

/**
 * Every performance of a dated run: date, time, a different venue if there is one, any note, and whether it is cancelled.
 * The next performance is marked; earlier ones come after the coming ones under their own heading and are quieter. Cancelled
 * performances are labelled in words (not by colour alone) and never counted as dates to come.
 */
export function PerformancesList({
  occurrences,
  defaultVenue,
  now = new Date(),
}: {
  occurrences: readonly Occurrence[];
  defaultVenue?: string | null;
  now?: Date;
}) {
  const all = displayOccurrences(occurrences);
  if (all.length === 0) return null;
  const nowMs = now.getTime();
  const next = liveOccurrence(all, now) ?? nextOccurrence(all, now);
  const isPast = (o: Occurrence) => {
    const end = o.ends_at ? Date.parse(o.ends_at) : NaN;
    return Number.isFinite(end) ? end < nowMs : Date.parse(o.starts_at) < nowMs;
  };
  const coming = all.filter((o) => !isPast(o));
  const earlier = all.filter(isPast);
  const liveCount = all.filter((o) => o.status !== "cancelled").length;

  const row = (o: Occurrence, past: boolean) => {
    const cancelled = o.status === "cancelled";
    const isNext = !past && next !== null && o.starts_at === next.starts_at && (o.id ?? "") === (next.id ?? "");
    const venue = o.venue && o.venue !== defaultVenue ? [o.venue, o.locality].filter(Boolean).join(", ") : null;
    return (
      <li
        key={`${o.id ?? ""}|${o.starts_at}`}
        className={
          "flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-line py-3 last:border-0 " +
          (past ? "text-ink-muted" : "text-ink")
        }
      >
        <div className="min-w-0">
          <p className={"font-semibold" + (cancelled ? " line-through" : "")}>
            <time dateTime={o.starts_at}>{dateLabel(o.starts_at)}</time>
          </p>
          {venue ? <p className="text-sm text-ink-muted">{venue}</p> : null}
          {o.note ? <p className="text-sm text-ink-muted">{o.note}</p> : null}
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <span className={"font-display text-lg font-bold" + (cancelled ? " line-through" : "")} style={past || cancelled ? undefined : { color: ACCENT_TEXT }}>
            {clock(o.starts_at)}
            {o.ends_at ? <span className="text-sm font-semibold text-ink-muted"> – {clock(o.ends_at)}</span> : null}
          </span>
          {cancelled ? (
            <span className="rounded-pill bg-red-100 px-2.5 py-0.5 text-xs font-bold uppercase tracking-wide text-red-800">Cancelled</span>
          ) : o.status === "changed" ? (
            <span className="rounded-pill bg-amber-100 px-2.5 py-0.5 text-xs font-bold uppercase tracking-wide text-amber-900">Changed</span>
          ) : null}
          {isNext && !cancelled ? (
            <span className="rounded-pill px-2.5 py-0.5 text-xs font-bold uppercase tracking-wide text-paper" style={{ background: ACCENT_TEXT }}>
              {liveOccurrence(all, now) ? "On now" : "Next"}
            </span>
          ) : null}
        </div>
      </li>
    );
  };

  return (
    <section id="performances" aria-labelledby="performances-heading" className="mt-10 scroll-mt-28">
      <h2 id="performances-heading" className="font-display text-2xl font-bold">
        Performances
        <span className="ml-2 text-base font-normal text-ink-muted">
          {liveCount} date{liveCount === 1 ? "" : "s"}
          {liveCount !== all.length ? `, ${all.length - liveCount} cancelled` : ""}
        </span>
      </h2>
      {coming.length > 0 ? (
        <ul className="mt-4 rounded-xl border border-line bg-paper px-5 shadow-soft">{coming.map((o) => row(o, false))}</ul>
      ) : (
        <p className="mt-4 text-ink-soft">All performances have finished.</p>
      )}
      {earlier.length > 0 ? (
        <>
          <h3 className="mt-8 font-display text-lg font-bold text-ink-soft">Earlier performances</h3>
          <ul className="mt-3 rounded-xl border border-line bg-sand/40 px-5">{earlier.map((o) => row(o, true))}</ul>
        </>
      ) : null}
    </section>
  );
}

import { dayLong, groupByDay, SESSION_STATUS_LABEL, timeRange, type SessionRow } from "@/lib/activities";
import { SaveButton } from "@/components/saved/SaveButton";
import { sessionKey } from "@/lib/saved";

const TONE: Record<string, string> = {
  cancelled: "bg-rose-50 text-rose-800", break: "bg-rose-50 text-rose-800", moved: "bg-amber-50 text-amber-900", changed: "bg-amber-50 text-amber-900", extra: "bg-sky-50 text-sky-900", scheduled: "",
};

/** The upcoming sessions of ONE activity, grouped by day. A cancelled or moved session is shown, not hidden: people need to see it. */
export function SessionList({ sessions, defaultVenue, save }: { sessions: SessionRow[]; defaultVenue?: string | null; save?: { activityId: string; title: string } }) {
  if (sessions.length === 0) return <p className="text-sm text-ink-muted">No upcoming sessions are scheduled right now.</p>;
  return (
    <ol className="divide-y divide-line rounded-xl border border-line bg-paper">
      {groupByDay(sessions).flatMap((g) => g.rows).map((s, i) => {
        const off = s.status === "cancelled" || s.status === "break";
        return (
          <li key={`${s.starts_at}-${i}`} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-4 py-3">
            <div className="min-w-0">
              <p className={"font-semibold text-ink " + (off ? "line-through opacity-60" : "")}>
                {dayLong(s.starts_at)} · {timeRange(s.starts_at, s.ends_at)}
              </p>
              {(s.note || (s.venue && s.venue !== defaultVenue)) && (
                <p className="text-sm text-ink-soft">{[s.venue && s.venue !== defaultVenue ? `At ${s.venue}` : null, s.note].filter(Boolean).join(" · ")}</p>
              )}
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {SESSION_STATUS_LABEL[s.status] && (
                <span className={"shrink-0 rounded-pill px-3 py-1 text-xs font-bold " + TONE[s.status]}>{SESSION_STATUS_LABEL[s.status]}</span>
              )}
              {/* My Saved: one session. Nothing renders while the feature is off or when the row has no key. */}
              {save && !off && sessionKey(s) && <SaveButton type="activity" id={save.activityId} occurrenceKey={sessionKey(s)} title={save.title} dateLabel={`${dayLong(s.starts_at)}, ${timeRange(s.starts_at, s.ends_at)}`} variant="row" hint="Save this session" />}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

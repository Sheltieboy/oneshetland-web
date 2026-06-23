import Link from "next/link";
import { getCruiseHomeCard } from "@/lib/cruise-data";
import { baro, fmtDateShort, CRUISE_ACCENT } from "@/lib/cruise-shared";

/**
 * "In port today" card — shows today's ships, or the next call when none today.
 * Renders nothing when there are no upcoming cruise calls. Safe to drop on the
 * home page and the cruise calendar.
 */
export async function CruiseTodayCard({ className = "" }: { className?: string }) {
  const card = await getCruiseHomeCard();
  if (!card) return null;
  const b = baro(card.barometer);
  const label = card.isToday ? "In port today" : `Next cruise call · ${fmtDateShort(card.date)}`;

  return (
    <Link
      href={`/cruise/${card.date}`}
      className={`flex items-center gap-4 rounded-2xl border border-line bg-paper p-3.5 shadow-soft transition-colors hover:bg-sand/40 ${className}`}
      style={{ borderLeft: `5px solid ${CRUISE_ACCENT}` }}
    >
      {/* Overlapping ship thumbnails */}
      <div className="flex shrink-0 -space-x-3">
        {card.thumbs.slice(0, 3).map((t, i) =>
          t.image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={t.id} src={t.image} alt="" className="h-12 w-12 rounded-xl border-2 border-paper object-cover" style={{ zIndex: 3 - i }} />
          ) : (
            <span key={t.id} className="grid h-12 w-12 place-items-center rounded-xl border-2 border-paper bg-sand text-ink-faint" style={{ zIndex: 3 - i }}>⚓</span>
          ),
        )}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold uppercase tracking-wide" style={{ color: CRUISE_ACCENT }}>{label}</span>
        </div>
        <div className="truncate font-display text-lg font-bold text-ink">
          {card.thumbs.map((t) => t.name).slice(0, 2).join(", ")}
          {card.thumbs.length > 2 ? ` +${card.thumbs.length - 2}` : ""}
        </div>
        <div className="text-sm text-ink-muted">
          {card.ships_count} {card.ships_count === 1 ? "ship" : "ships"}{card.total_est_pax ? ` · ~${card.total_est_pax.toLocaleString()} passengers` : ""}
        </div>
      </div>

      <span className="shrink-0 rounded-pill px-2.5 py-1 text-xs font-bold" style={{ background: b.tint, color: b.color }}>{b.label}</span>
    </Link>
  );
}

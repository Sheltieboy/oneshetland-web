import Link from "next/link";
import { SafeImage } from "@/components/ui/SafeImage";
import { getCruiseHomeCard, type CruiseHomeVisit } from "@/lib/cruise-data";
import { baro, fmtDateShort, fmtTime, CRUISE_ACCENT } from "@/lib/cruise-shared";

/**
 * "In port today" card — the day's ships with per-visit detail (times, berth or
 * tender, passengers, cruise line), plus a "See the whole day" button. A single
 * call gets a hero-image treatment; several ships get a compact list. Renders
 * nothing when there are no upcoming calls. Shared by home + cruise hub.
 */
function visitMeta(v: CruiseHomeVisit): string {
  return [
    v.arrival ? `${fmtTime(v.arrival)}${v.departure ? `–${fmtTime(v.departure)}` : ""}` : null,
    v.tender ? "By tender" : v.berth,
    v.pax ? `~${v.pax.toLocaleString()} pax` : v.paxLabel,
  ].filter(Boolean).join(" · ");
}

function footfallNote(barometer: string): string {
  if (barometer === "peak" || barometer === "very_busy") return "Town will be busy — plan for extra footfall.";
  if (barometer === "busy") return "A good few folk ashore today.";
  return "A quiet call — an easy day in town.";
}

export async function CruiseTodayCard({ className = "" }: { className?: string }) {
  const card = await getCruiseHomeCard();
  if (!card) return null;
  const b = baro(card.barometer);
  const label = card.isToday ? "In port today" : `Next cruise call · ${fmtDateShort(card.date)}`;
  const tint = `color-mix(in srgb, ${CRUISE_ACCENT} 12%, transparent)`;
  const tintStrong = `color-mix(in srgb, ${CRUISE_ACCENT} 40%, transparent)`;
  const single = card.visits.length === 1;
  const summary = [
    `${card.ships_count} ${card.ships_count === 1 ? "ship" : "ships"}`,
    card.total_est_pax ? `~${card.total_est_pax.toLocaleString()} passengers` : null,
    card.firstIn ? `ashore ${fmtTime(card.firstIn)}${card.lastOut ? `–${fmtTime(card.lastOut)}` : ""}` : null,
  ].filter(Boolean).join(" · ");

  return (
    <div
      className={`flex h-full flex-col rounded-2xl border border-line bg-paper p-4 shadow-soft ${className}`}
      style={{ borderLeft: `5px solid ${CRUISE_ACCENT}` }}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-bold uppercase tracking-wide" style={{ color: CRUISE_ACCENT }}>{label}</p>
          <p className="mt-0.5 text-sm text-ink-muted">{summary}</p>
        </div>
        <span className="shrink-0 rounded-pill px-2.5 py-1 text-xs font-bold" style={{ background: b.tint, color: b.color }}>{b.label}</span>
      </div>

      {single ? (
        /* ── Single call: hero image + detail ─────────────────────────── */
        <Link href={`/cruise/visit/${card.visits[0].id}`} className="group mt-3 flex flex-1 flex-col">
          <div className="relative flex-1 overflow-hidden rounded-xl bg-sand" style={{ minHeight: "9rem" }}>
            {card.visits[0].image
              ? <SafeImage src={card.visits[0].image} className="absolute inset-0 h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]" fallback={<span className="grid h-full w-full place-items-center text-3xl text-ink-faint">⚓</span>} />
              : <span className="grid h-full w-full place-items-center text-3xl text-ink-faint">⚓</span>}
            <div aria-hidden className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/35 to-transparent" />
            <div className="absolute inset-x-0 bottom-0 p-3 text-paper">
              <p className="font-display text-xl font-bold leading-tight [text-shadow:_0_1px_2px_rgb(0_0_0_/_0.7),_0_2px_12px_rgb(0_0_0_/_0.6)]">{card.visits[0].name}</p>
              {card.visits[0].line && <p className="text-xs text-white/90 [text-shadow:_0_1px_2px_rgb(0_0_0_/_0.7)]">{card.visits[0].line}</p>}
            </div>
          </div>
          {visitMeta(card.visits[0]) && <p className="mt-2 text-sm font-semibold text-ink">{visitMeta(card.visits[0])}</p>}
        </Link>
      ) : (
        /* ── Several ships: compact list, each row links to that visit ── */
        <ul className="mt-3 flex-1 space-y-1.5">
          {card.visits.slice(0, 3).map((v) => {
            const meta = visitMeta(v);
            return (
              <li key={v.id}>
                <Link
                  href={`/cruise/visit/${v.id}`}
                  className="group flex items-center gap-3 rounded-xl border border-transparent p-2 transition-colors hover:bg-[var(--tint)] hover:border-[var(--tint-strong)]"
                  style={{ "--tint": tint, "--tint-strong": tintStrong } as React.CSSProperties}
                >
                  <div className="h-14 w-20 shrink-0 overflow-hidden rounded-lg bg-sand">
                    {v.image
                      ? <SafeImage src={v.image} className="h-full w-full object-cover" fallback={<span className="grid h-full w-full place-items-center text-lg text-ink-faint">⚓</span>} />
                      : <span className="grid h-full w-full place-items-center text-lg text-ink-faint">⚓</span>}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-display text-base font-bold text-ink">{v.name}</p>
                    {v.line && <p className="truncate text-xs text-ink-muted">{v.line}</p>}
                    {meta && <p className="truncate text-xs text-ink-soft">{meta}</p>}
                  </div>
                  <span aria-hidden className="shrink-0 text-ink-faint transition-transform group-hover:translate-x-0.5">→</span>
                </Link>
              </li>
            );
          })}
          {card.visits.length > 3 && (
            <li className="px-2 pt-0.5 text-xs font-semibold text-ink-muted">+{card.visits.length - 3} more in port</li>
          )}
        </ul>
      )}

      {/* Footfall note + read more */}
      <p className="mt-3 text-xs text-ink-muted">{footfallNote(card.barometer)}</p>
      <Link
        href={`/cruise/${card.date}`}
        className="mt-2 inline-flex items-center justify-center gap-1.5 rounded-pill px-4 py-2 text-sm font-bold text-white transition hover:brightness-105"
        style={{ background: CRUISE_ACCENT }}
      >
        See the whole day <span aria-hidden>→</span>
      </Link>
    </div>
  );
}

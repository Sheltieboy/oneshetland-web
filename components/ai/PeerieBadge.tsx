import { PEERIE, RING_COLOURS } from "@/lib/peerie";

/**
 * "Peerie Bot · AI" — the attribution shown wherever Peerie Bot has produced
 * something, as opposed to PeerieFill which is the whole describe-it card.
 *
 * The rule this exists to enforce: the name NEVER appears without the AI tag
 * and the ✨. A friendly name is precisely the thing that could be mistaken
 * for a person or for editorial copy written by the OneShetland team, so
 * anything Peerie Bot made says so plainly, every time.
 *
 * The dot carries the ring-colour conic gradient — the same signature as the
 * working glow, so Peerie Bot's touch looks the same everywhere.
 */
export function PeerieBadge({
  action = "Put together by",
  className = "",
}: {
  /** Verb phrase before the name, e.g. "Put together by", "Drafted by". */
  action?: string;
  className?: string;
}) {
  return (
    <span className={`inline-flex items-center gap-2 rounded-pill bg-ink/5 px-2.5 py-1 ${className}`}>
      <span
        aria-hidden
        className="grid h-4 w-4 place-items-center rounded-full text-[9px] text-paper"
        style={{ background: `conic-gradient(${RING_COLOURS.join(", ")}, ${RING_COLOURS[0]})` }}
      >
        {PEERIE.spark}
      </span>
      <span className="text-[11px] font-bold uppercase tracking-wide text-ink-muted">
        {action} {PEERIE.name}
      </span>
      <span className="rounded-pill bg-ink/10 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-ink-muted">
        {PEERIE.tag}
      </span>
    </span>
  );
}

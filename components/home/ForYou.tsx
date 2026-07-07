import Link from "next/link";
import { SafeImage } from "@/components/ui/SafeImage";
import { type ForYouItem } from "@/lib/for-you.server";

/**
 * ForYou — a warm, editorial "picked for you" strip at the top of the home,
 * shown only to signed-in users with at least one item. NOT a KPI grid: a
 * horizontal scroll row of compact, human cards, each a link into the section.
 */
export function ForYou({ name, items }: { name: string; items: ForYouItem[] }) {
  if (!items.length) return null;

  return (
    <section className="mx-auto max-w-6xl px-5 pt-8">
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <div>
          <h2 className="font-display text-2xl font-bold text-ink">
            For you{name ? `, ${name}` : ""}
          </h2>
          <p className="mt-0.5 text-sm text-ink-muted">Picked up across Shetland, just for you.</p>
        </div>
      </div>

      {/* Horizontal scroll row — snaps, hides the scrollbar, wraps on wide screens
          isn't needed since fixed-width cards keep it tidy and swipeable. */}
      <div className="-mx-5 flex snap-x gap-3 overflow-x-auto px-5 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {items.map((item) => (
          <Card key={item.id} item={item} />
        ))}
      </div>
    </section>
  );
}

function Card({ item }: { item: ForYouItem }) {
  const accent = item.accent ?? "#032f4c";
  // A faint section-colour wash on hover (mirrors HomeBento's tint approach).
  const style = {
    "--accent": accent,
    "--tint": `color-mix(in srgb, ${accent} 8%, transparent)`,
    "--tint-strong": `color-mix(in srgb, ${accent} 30%, transparent)`,
  } as React.CSSProperties;

  return (
    <Link
      href={item.href}
      style={style}
      className="group relative flex w-[15.5rem] shrink-0 snap-start flex-col rounded-2xl border border-line bg-paper p-4 shadow-soft transition hover:-translate-y-0.5 hover:border-[var(--tint-strong)] hover:bg-[var(--tint)] hover:shadow-lift"
    >
      <div className="flex items-center gap-2.5">
        <span
          className="grid h-9 w-9 shrink-0 place-items-center overflow-hidden rounded-xl"
          style={{ background: `color-mix(in srgb, ${accent} 14%, transparent)`, color: accent }}
        >
          {item.image ? (
            <SafeImage src={item.image} alt="" className="h-full w-full object-cover" fallback={<Icon name={item.icon} />} />
          ) : (
            <Icon name={item.icon} />
          )}
        </span>
        {item.cue && (
          <span
            className="ml-auto inline-flex items-center gap-1 rounded-pill px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide"
            style={{ background: `color-mix(in srgb, ${accent} 16%, transparent)`, color: accent }}
          >
            {isLiveCue(item.cue) && (
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-70" style={{ background: accent }} />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full" style={{ background: accent }} />
              </span>
            )}
            {item.cue}
          </span>
        )}
      </div>

      <h3 className="mt-3 line-clamp-2 font-semibold leading-snug text-ink">{item.title}</h3>
      <p className="mt-1 line-clamp-2 text-sm text-ink-muted">{item.subtitle}</p>

      <span
        className="mt-3 inline-flex items-center gap-1 text-xs font-semibold transition group-hover:gap-1.5"
        style={{ color: accent }}
      >
        View <span aria-hidden>→</span>
      </span>
    </Link>
  );
}

function isLiveCue(cue: string): boolean {
  return ["in progress", "today", "ready", "accepted"].includes(cue);
}

/* ── Inline icons (currentColor) ───────────────────────────────────────────── */
function Icon({ name }: { name: string }) {
  const p = ICONS[name] ?? ICONS.play;
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      {p}
    </svg>
  );
}

const ICONS: Record<string, React.ReactNode> = {
  fetch: <><circle cx="7" cy="18" r="2" /><circle cx="17" cy="18" r="2" /><path d="M5 18H3V6h11v12M14 9h4l3 4v5h-2" /></>,
  calendar: <><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" /></>,
  ticket: <><path d="M3 8a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v2a2 2 0 0 0 0 4v2a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-2a2 2 0 0 0 0-4V8Z" /><path d="M13 6v12" strokeDasharray="2 2" /></>,
  stamp: <><path d="M5 22h14M12 3a3 3 0 0 0-3 3c0 1 .5 1.5 1 2.5.4.8-.2 1.5-1 1.5H8a2 2 0 0 0-2 2v2h12v-2a2 2 0 0 0-2-2h-1c-.8 0-1.4-.7-1-1.5.5-1 1-1.5 1-2.5a3 3 0 0 0-3-3Z" /></>,
  wallet: <><path d="M3 7a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v1h1a1 1 0 0 1 1 1v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z" /><circle cx="17.5" cy="13.5" r="1" fill="currentColor" stroke="none" /></>,
  briefcase: <><rect x="2" y="7" width="20" height="14" rx="2" /><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2" /></>,
  clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
  play: <><circle cx="12" cy="12" r="9" /><path d="M10 8l6 4-6 4V8Z" fill="currentColor" stroke="none" /></>,
  hub: <><path d="M3 21V8l9-5 9 5v13M9 21v-6h6v6" /></>,
  story: <><path d="M12 21s-7-4.35-9.5-8.5C.5 8.5 3 5 6.5 5 9 5 12 8 12 8s3-3 5.5-3C21 5 23.5 8.5 21.5 12.5 19 16.65 12 21 12 21Z" /></>,
  boat: <><path d="M3 14h18l-2 5a3 3 0 0 1-2.8 2H7.8A3 3 0 0 1 5 19l-2-5ZM6 14V6l6-3 6 3v8" /></>,
};

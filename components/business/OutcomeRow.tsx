import Link from "next/link";
import { type Outcome } from "@/lib/business-outcomes";

/**
 * One owner outcome, full width.
 *
 * Full width rather than a tile, because the useful part is a sentence — "2
 * services, availability not set" — and a three-column grid has no room for a
 * sentence. That is how the old Home became eighteen tiles that all looked
 * equally important, which is the same as none of them being important.
 *
 * Four things, in the order they get asked: what is this for, am I using it,
 * where do I go, and is there a second place worth knowing about.
 *
 * The dot is deliberately two-state. Green is live to customers; grey is
 * everything else, including perfectly finished states like "not selling on
 * OneShetland". Amber would turn every unused capability into a warning, and
 * an owner who never wanted a shop has nothing to be warned about.
 */
export function OutcomeRow({ outcome, accent }: { outcome: Outcome; accent: string }) {
  const { title, blurb, status, tone, primary, secondary } = outcome;
  return (
    <section className="rounded-card border border-line bg-paper p-4 shadow-soft sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
        <div className="min-w-0 flex-1">
          <h3 className="font-display text-lg font-bold text-ink">{title}</h3>
          <p className="mt-0.5 text-sm text-ink-muted">{blurb}</p>
          <p className="mt-2 flex items-center gap-2 text-sm font-semibold text-ink-soft">
            <span
              aria-hidden
              className="inline-block h-2 w-2 shrink-0 rounded-full"
              style={{ background: tone === "positive" ? "#16a34a" : "var(--line-strong, #cbd5e1)" }}
            />
            {status}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          {secondary && (
            <Link href={secondary.href} className="text-sm font-semibold text-ink-soft hover:text-ink">
              {secondary.label}
            </Link>
          )}
          <Link
            href={primary.href}
            className="rounded-pill px-4 py-2 text-sm font-bold text-white shadow-soft transition hover:brightness-110"
            style={{ background: accent }}
          >
            {primary.label}
          </Link>
        </div>
      </div>
    </section>
  );
}

/**
 * Money and Grow are not outcomes. They serve the outcomes above, so they read
 * as a list of places rather than as things to achieve — no headings, no
 * blurbs, one line each.
 */
export function UtilityRow({
  label, status, href,
}: { label: string; status?: string | null; href: string }) {
  return (
    <Link
      href={href}
      className="flex items-center justify-between gap-4 rounded-xl border border-line bg-paper px-4 py-3 shadow-soft transition hover:bg-sand/40"
    >
      <span className="font-semibold text-ink">{label}</span>
      <span className="text-sm text-ink-muted">{status ?? ""} →</span>
    </Link>
  );
}

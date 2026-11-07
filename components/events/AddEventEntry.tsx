import Link from "next/link";
import { ADD_EVENT_HREF, ADD_EVENT_LABEL, ADD_EVENT_SHORT_DESC, entryPointsEnabled } from "@/lib/event-entry-points";

/**
 * A link to the "Add an Event or Activity" front door. A SERVER component: it renders nothing unless EVENT_FRONT_DOOR === "on", so with the
 * feature off no markup, text or link is added anywhere. Visible link text is always words (never icon-only), targets are at least 44px tall,
 * and focus shows a ring.
 */
const FOCUS = "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-navy";

export function AddEventEntry({ variant = "button", className = "", label = ADD_EVENT_LABEL, description = ADD_EVENT_SHORT_DESC }: {
  variant?: "button" | "card" | "link"; className?: string; label?: string; description?: string;
}) {
  if (!entryPointsEnabled()) return null;
  if (variant === "card") {
    return (
      <Link href={ADD_EVENT_HREF} className={`block min-h-[44px] rounded-card border border-line bg-paper p-5 shadow-soft transition hover:-translate-y-0.5 hover:shadow-lift ${FOCUS} ${className}`.trim()}>
        <p className="font-display font-bold text-ink">{label}</p>
        <p className="mt-0.5 text-sm text-ink-muted">{description}</p>
      </Link>
    );
  }
  if (variant === "link") {
    return <Link href={ADD_EVENT_HREF} className={`font-semibold text-ink underline underline-offset-2 hover:text-navy ${FOCUS} ${className}`.trim()}>{label}</Link>;
  }
  return (
    <Link href={ADD_EVENT_HREF} className={`inline-flex min-h-[44px] items-center justify-center whitespace-nowrap rounded-pill border border-line-strong bg-paper px-4 py-2 text-sm font-bold text-ink transition-colors hover:bg-sand ${FOCUS} ${className}`.trim()}>{label}</Link>
  );
}

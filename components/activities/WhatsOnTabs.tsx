import Link from "next/link";
import { REGULAR, EVENTS_GOLD } from "./tokens";

/**
 * The What's On section switch: Events (one-off happenings, the mosaic) and Regular activities (classes and groups that repeat).
 * One component, used by both pages, so they always agree.
 */
export function WhatsOnTabs({ active }: { active: "events" | "regular" }) {
  const tab = (key: "events" | "regular", label: string, href: string, color: string) => (
    <Link
      href={href}
      aria-current={active === key ? "page" : undefined}
      className={"shrink-0 rounded-pill px-4 py-2 text-sm font-bold transition " + (active === key ? "text-paper shadow-soft" : "text-ink-soft hover:bg-sand")}
      style={active === key ? { background: color } : undefined}
    >
      {label}
    </Link>
  );
  return (
    <nav aria-label="What's On sections" className="inline-flex gap-1 rounded-pill border border-line-strong bg-paper p-1">
      {tab("events", "Events", "/whats-on", EVENTS_GOLD)}
      {tab("regular", "Regular activities", "/whats-on/regular", REGULAR)}
    </nav>
  );
}

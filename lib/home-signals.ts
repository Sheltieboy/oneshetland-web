import type { HomeJob } from "@/lib/home-data";
import type { EventListItem } from "@/lib/events-data";
import type { CruiseHomeCard } from "@/lib/cruise-data";

/**
 * lib/home-signals.ts — the live pills under the hero headline.
 *
 * WHY THESE REPLACED THE OLD SHORTCUT CHIPS.
 * The hero used to carry four static links — What's On, Eat & Drink, The Fleet,
 * Spik — every one of which already sits in the nav bar directly above it. The
 * most valuable space on the site was spending itself on a second copy of the
 * navigation.
 *
 * The wallet pill was the exception, and the reason is instructive: it doesn't
 * point at a section, it tells you something live and personal ("£8.35"). You
 * didn't know it before you looked. So the rest of the row now works the same
 * way — signals, not shortcuts.
 *
 * THE RULE: a pill only appears when it has something to say. On a wet Tuesday
 * in February you may see one, or none. That's honest, and it beats four doors
 * to nowhere. It also keeps the row from wrapping on a phone.
 *
 * This is a pure function over data the home page already loads, so it costs no
 * extra database work beyond the cruise card.
 */

export type HeroSignal = { key: string; label: string; href: string };

/** Shetland is Europe/London; the server is UTC. Comparing raw dates would put
 *  a 9pm event on tomorrow for half the year, so both sides are resolved in
 *  island local time. en-CA gives a sortable YYYY-MM-DD. */
function islandDateKey(d: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/London",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

function islandHour(d: Date): number {
  return Number(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: "Europe/London",
      hour: "2-digit",
      hour12: false,
    }).format(d),
  );
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** Keep a pill to one tidy line. Cuts on a word where it can, so we get
 *  "Shetland Noir at the…" rather than "Shetland Noir at th…". */
function trim(s: string, max = 30): string {
  const t = s.trim();
  if (t.length <= max) return t;
  const cut = t.slice(0, max);
  const lastSpace = cut.lastIndexOf(" ");
  return `${(lastSpace > max - 12 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`;
}

/** Thousands separator — "4,200 aboard" reads better than "4200 aboard". */
const num = (n: number) => n.toLocaleString("en-GB");

export function buildHeroSignals(input: {
  now: Date;
  monthEvents: EventListItem[];
  jobs: HomeJob[];
  cruise: CruiseHomeCard | null;
}): HeroSignal[] {
  const { now, monthEvents, jobs, cruise } = input;
  const signals: HeroSignal[] = [];
  const todayKey = islandDateKey(now);

  // Ships first when they're in — it's the rarest and most time-critical thing
  // on the page. Residents use it to decide whether to go into Lerwick at all;
  // businesses use it to decide whether to put someone extra on.
  if (cruise?.isToday && cruise.ships_count > 0) {
    // Passenger numbers are the detail that actually changes a decision — a
    // café deciding whether to put someone extra on, or a resident deciding
    // whether Commercial Street is worth it this morning.
    const ships = `${plural(cruise.ships_count, "ship", "ships")} in`;
    signals.push({
      key: "cruise",
      label: cruise.total_est_pax > 0
        ? `${ships} · ${num(cruise.total_est_pax)} aboard`
        : `${ships} today`,
      href: "/cruise",
    });
  }

  // Anything on today that hasn't already finished.
  const todayEvents = monthEvents.filter((e) => {
    if (!e.starts_at) return false;
    const start = new Date(e.starts_at);
    if (islandDateKey(start) !== todayKey) return false;
    const end = e.ends_at ? new Date(e.ends_at) : null;
    return (end ?? start).getTime() >= now.getTime();
  });
  if (todayEvents.length > 0) {
    // After four in the afternoon "tonight" is the truer word, and it reads
    // like something a person would say.
    const when = islandHour(now) >= 16 ? "Tonight" : "Today";
    // With one thing on, name it — "Tonight · 1 event" makes you click to find
    // out what it is, whereas the title tells you straight away whether you
    // care. With several, the count is the more useful signal and the titles
    // wouldn't fit anyway.
    const first = todayEvents[0];
    const detail =
      todayEvents.length === 1 && first.title
        ? trim(first.title)
        : plural(todayEvents.length, "event", "events");
    signals.push({ key: "events", label: `${when} · ${detail}`, href: "/whats-on" });
  }

  // Work posted in the last week — the thing folk check on a Monday.
  const weekAgo = now.getTime() - 7 * 24 * 60 * 60 * 1000;
  const freshJobs = jobs.filter(
    (j) => j.posted_at && new Date(j.posted_at).getTime() >= weekAgo,
  );
  if (freshJobs.length > 0) {
    // Same rule as events: one job gets named, several get counted.
    const detail =
      freshJobs.length === 1 && freshJobs[0].title
        ? `New job · ${trim(freshJobs[0].title, 26)}`
        : plural(freshJobs.length, "new job", "new jobs");
    signals.push({ key: "jobs", label: detail, href: "/jobs" });
  }

  // Three is the most that sits on one line beside the wallet pill on a phone.
  const capped = signals.slice(0, 3);

  // Nothing doing — one calm default rather than an empty gap where a row of
  // buttons clearly used to be.
  if (capped.length === 0) {
    return [{ key: "whats-on", label: "What's On", href: "/whats-on" }];
  }
  return capped;
}

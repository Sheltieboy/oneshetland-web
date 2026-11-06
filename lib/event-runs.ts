/**
 * event-runs.ts - turns event rows that carry performances (event_occurrences) into what a LIST, the HOMEPAGE and the CALENDAR show.
 *
 * PURE: no database, no clock of its own. Built on lib/event-occurrences.ts. The loaders (lib/events-data.ts, lib/home-data.ts,
 * lib/local-data.ts) fetch rows and call these; a row with NO performances comes back exactly as it went in (minus the empty
 * `occurrences` key), so everything that happens today is unchanged.
 *
 * RULES (product owner)
 *   - One card per production in a list or on the homepage. Its date is the NEXT performance (or the one on now), never the parent's
 *     first-to-last span: a dated run is never shown as continuously running between performances.
 *   - A run with nothing still to come (all past, or all cancelled) is not "on" any more and leaves upcoming lists.
 *   - A performance's own venue / locality wins over the parent's.
 *   - The calendar shows one entry per performance on its own day, a cancelled one marked cancelled.
 */

import {
  displayOccurrences, nextOccurrence, liveOccurrence, runState, listingCard, homepageSelect, calendarEntries,
  type Occurrence, type RunState,
} from "./event-occurrences";
import { isUpcomingSurfaceEligible } from "./event-state";

export type RunOccurrence = Occurrence & { id?: string };

export type RunInfo = {
  state: RunState;
  /** Performances that are not cancelled. */
  performances: number;
  /** Performances still to come (not cancelled). */
  remaining: number;
  /** Every performance row, cancelled ones included. */
  total: number;
  /** "Next: Sat 6 Dec · 15 performances"; null when only one performance is left to describe. */
  label: string | null;
  /** True while a performance is on right now. */
  live: boolean;
};

export type RunRow = {
  id: string;
  title?: string;
  starts_at: string;
  ends_at?: string | null;
  status?: string | null;
  venue?: string | null;
  locality?: string | null;
  is_featured?: boolean | null;
  is_dated_run?: boolean | null;
  organiser_name?: string | null;
  organiser_hub_id?: string | null;
  organiser_business_id?: string | null;
  occurrences?: RunOccurrence[] | null;
};

export type Presented<T extends RunRow> = Omit<T, "occurrences"> & { run?: RunInfo };

const strip = <T extends RunRow>(row: T): Omit<T, "occurrences"> => {
  const { occurrences: _o, ...rest } = row;
  void _o;
  return rest;
};

/**
 * The row as an UPCOMING list shows it. Ordinary row (no performances): unchanged. Run: starts_at / ends_at / venue / locality become
 * those of the performance on now or the next one, `run` carries the label and counts. Null when the run has nothing to come.
 */
export function presentRow<T extends RunRow>(row: T, now: Date | number = new Date()): Presented<T> | null {
  const occ = displayOccurrences(row.occurrences);
  if (occ.length === 0) return strip(row);
  const state = runState(row, occ, now);
  if (state !== "upcoming" && state !== "between" && state !== "live") return null;
  const live = occ.filter((o) => o.status !== "cancelled");
  const current = liveOccurrence(live, now) ?? nextOccurrence(live, now);
  if (!current) return null;
  const card = listingCard(row, occ, now);
  const base = strip(row);
  return {
    ...base,
    starts_at: current.starts_at,
    ends_at: current.ends_at ?? null,
    venue: current.venue || row.venue || null,
    locality: current.locality || row.locality || null,
    run: {
      state, performances: card.performances, remaining: card.remaining, total: occ.length,
      label: card.performances > 1 ? card.label : null,
      live: state === "live",
    },
  } as Presented<T>;
}

/** Upcoming-only surfaces (strips, local feed): a run qualifies while it has a performance to come or on now; others use today's rule. */
export function presentUpcomingSurface<T extends RunRow>(row: T, now: Date | number = new Date()): Presented<T> | null {
  const p = presentRow(row, now);
  if (!p) return null;
  if (p.run) return p;
  return isUpcomingSurfaceEligible(p as { starts_at: string; ends_at?: string | null }, now) ? p : null;
}

const t = (iso: string | null | undefined): number => (iso ? Date.parse(iso) : NaN);

/** Stable sort by displayed start (equal starts keep the order the database gave). */
export function sortByStart<T extends { starts_at: string }>(rows: readonly T[]): T[] {
  return rows.map((r, i) => ({ r, i })).sort((a, b) => t(a.r.starts_at) - t(b.r.starts_at) || a.i - b.i).map((x) => x.r);
}

/**
 * The homepage's What's On slots from rows already fetched (legacy and run rows alike): featured first, then soonest; each production once;
 * no organiser more than twice; at most `max`. Uses homepageSelect from lib/event-occurrences.ts.
 */
export function selectHomeRows<T extends RunRow>(rows: readonly T[], now: Date | number = new Date(), max = 7): Presented<T>[] {
  const eligible: Presented<T>[] = [];
  for (const row of rows) {
    const p = presentUpcomingSurface(row, now);
    if (p) eligible.push(p);
  }
  const byId = new Map(eligible.map((p) => [p.id, p] as const));
  const cards = eligible.map((p) => {
    const c = listingCard(p as unknown as RunRow, [], now);
    // The card's date IS the displayed start (the next performance, or an ordinary event's own start). A card whose state is not
    // upcoming-like (an ordinary event already in progress today) still belongs on the homepage, so its state is set explicitly.
    return { ...c, state: "upcoming" as RunState, nextStartsAt: p.starts_at, isFeatured: !!p.is_featured };
  });
  return homepageSelect(cards, { max, perOrganiserMax: 2 }).map((c) => byId.get(c.eventId)!).filter(Boolean);
}

export type CalendarItem<T extends RunRow> = Presented<T> & { occurrence_id?: string | null; cancelled?: boolean };

/**
 * Items for one month's calendar grid. A row with performances becomes one item PER PERFORMANCE in that month, on that performance's own
 * start (cancelled ones flagged). A row without performances is returned as it is - it appears on its start day exactly as before
 * (spanning every covered day is deliberately NOT done for ordinary events: a six-week exhibition would fill every cell).
 * `month` is 1-12 (Shetland months).
 */
export function monthItems<T extends RunRow>(rows: readonly T[], month: { year: number; month: number }): CalendarItem<T>[] {
  const out: CalendarItem<T>[] = [];
  for (const row of rows) {
    const occ = displayOccurrences(row.occurrences);
    if (occ.length === 0) { out.push(strip(row) as CalendarItem<T>); continue; }
    const entries = calendarEntries([row], occ.map((o) => ({ ...o, event_id: row.id })), month);
    const byKey = new Map(occ.map((o) => [`${o.id ?? ""}|${o.starts_at}`, o] as const));
    for (const e of entries) {
      const o = byKey.get(`${e.occurrenceId ?? ""}|${e.starts_at}`);
      out.push({
        ...strip(row),
        starts_at: e.starts_at,
        ends_at: e.ends_at,
        venue: o?.venue || row.venue || null,
        locality: o?.locality || row.locality || null,
        occurrence_id: e.occurrenceId,
        cancelled: e.cancelled,
      } as CalendarItem<T>);
    }
  }
  return sortByStart(out);
}

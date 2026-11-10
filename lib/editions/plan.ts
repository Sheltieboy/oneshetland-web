/** My Plan: pure grouping and clash detection over the rows from edition_my_plan(). No I/O. */
import type { PlanRow } from "./data.server";
import { itemPath } from "./session-url";

export type PlanItem = { editionId: string; editionSlug: string; kind: "session" | "event"; id: string; title: string; starts_at: string; ends_at: string | null; venue: string | null; status: string | null; href: string | null };
export type PlanEdition = { id: string; slug: string; title: string; starts_on: string; ends_on: string; saved: boolean; lastUpdateAt: string | null; items: PlanItem[] };
export type PlanDay = { day: string; items: PlanItem[]; clashes: Set<string> };

const TZ = "Europe/London";
const dayKey = (iso: string) => new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(new Date(iso));

export function groupPlan(rows: PlanRow[]): PlanEdition[] {
  const by = new Map<string, PlanEdition>();
  for (const r of rows) {
    const e = by.get(r.edition_id) ?? { id: r.edition_id, slug: r.edition_slug, title: r.edition_title, starts_on: r.edition_starts_on, ends_on: r.edition_ends_on, saved: false, lastUpdateAt: null, items: [] };
    by.set(r.edition_id, e);
    if (r.kind === null) { e.saved = r.edition_saved; e.lastUpdateAt = r.last_update_at; continue; }
    if (r.item_id && r.title && r.starts_at) e.items.push({ editionId: r.edition_id, editionSlug: r.edition_slug, kind: r.kind, id: r.item_id, title: r.title, starts_at: r.starts_at, ends_at: r.ends_at, venue: r.venue, status: r.status, href: r.kind === "session" ? itemPath(r.edition_slug, { title: r.title, id: r.item_id }) : r.item_href });
  }
  return [...by.values()].map((e) => ({ ...e, items: e.items.sort((a, b) => Date.parse(a.starts_at) - Date.parse(b.starts_at)) })).sort((a, b) => a.starts_on.localeCompare(b.starts_on));
}

const endOf = (i: PlanItem) => Date.parse(i.ends_at ?? "") > Date.parse(i.starts_at) ? Date.parse(i.ends_at!) : Date.parse(i.starts_at) + 3600_000;
/** Two live items clash when their time ranges overlap. Cancelled items never clash. Back-to-back (end == start) is not a clash. */
export function clashes(items: PlanItem[]): Set<string> {
  const live = items.filter((i) => i.status !== "cancelled").sort((a, b) => Date.parse(a.starts_at) - Date.parse(b.starts_at));
  const out = new Set<string>();
  for (let i = 0; i < live.length; i++) for (let j = i + 1; j < live.length; j++) {
    if (Date.parse(live[j].starts_at) >= endOf(live[i])) break;
    out.add(live[i].id); out.add(live[j].id);
  }
  return out;
}

/** Plan items across all Editions, by London day, each day with its clash set. */
export function planDays(editions: PlanEdition[]): PlanDay[] {
  const all = editions.flatMap((e) => e.items);
  const days = new Map<string, PlanItem[]>();
  for (const i of all) (days.get(dayKey(i.starts_at)) ?? days.set(dayKey(i.starts_at), []).get(dayKey(i.starts_at))!).push(i);
  return [...days.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([day, items]) => ({ day, items: items.sort((a, b) => Date.parse(a.starts_at) - Date.parse(b.starts_at)), clashes: clashes(items) }));
}

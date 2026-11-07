/**
 * event-contributor-logic.ts — the decisions behind the "look after your event" page. Pure; the clock is passed in.
 */
import { buildOccurrences, type DateRow, type RowIssue, type UtcOccurrence } from "./event-dates-builder";
import { checkField, COVER_URL_PREFIX } from "./event-submission-validate";
import type { EventRow, LogRow, OccurrenceRow } from "./event-submissions-client";

const DAY = 86_400_000;

/** The dates still ahead, exactly as the database counts them (rows if there are any, else the event's own times). */
export function currentFutureDates(event: Pick<EventRow, "starts_at" | "ends_at"> | null, occurrences: readonly OccurrenceRow[], nowMs: number): UtcOccurrence[] {
  if (occurrences.length > 0) {
    return occurrences.filter((o) => Date.parse(o.starts_at) > nowMs)
      .map((o) => ({ starts_at: o.starts_at, ...(o.ends_at ? { ends_at: o.ends_at } : {}), ...(o.note ? { note: o.note } : {}) }));
  }
  if (event?.starts_at && Date.parse(event.starts_at) > nowMs) return [{ starts_at: event.starts_at, ...(event.ends_at ? { ends_at: event.ends_at } : {}) }];
  return [];
}

const key = (o: UtcOccurrence) => `${Date.parse(o.starts_at)}|${o.ends_at ? Date.parse(o.ends_at) : ""}|${(o.note ?? "").trim()}`;
export const sameDates = (a: readonly UtcOccurrence[], b: readonly UtcOccurrence[]) => {
  const x = a.map(key).sort(), y = b.map(key).sort();
  return x.length === y.length && x.every((v, i) => v === y[i]);
};

export type ChangeForm = { title: string; description: string; venue: string; price_text: string; contact_info: string; ticket_url: string; cover_url: string | null; rows: DateRow[] };

export type ChangeBuild =
  | { ok: true; payload: Record<string, unknown>; changed: string[] }
  | { ok: false; errors: Record<string, string>; rowIssues: RowIssue[]; nothingChanged?: boolean };

/** Only what actually changed goes to the database (it rejects unchanged requests). Same friendly checks as the first submission. */
export function buildChange(current: { event: EventRow; future: readonly UtcOccurrence[] }, f: ChangeForm, now: Date | number, datesTouched: boolean): ChangeBuild {
  const errors: Record<string, string> = {};
  const payload: Record<string, unknown> = {};
  const e = current.event;
  const cur: Record<string, string> = { title: e.title ?? "", description: e.description ?? "", venue: e.venue ?? "", price_text: e.price_text ?? "", contact_info: e.contact_info ?? "", ticket_url: e.ticket_url ?? "" };
  for (const k of ["title", "description", "venue", "price_text", "contact_info", "ticket_url"] as const) {
    const r = checkField(k, f[k]);
    if (r.error) { errors[k] = r.error; continue; }
    if ((r.value ?? "") !== cur[k].trim()) payload[k] = r.value;
  }
  if (f.cover_url !== (e.cover_url ?? null)) {
    if (f.cover_url && !f.cover_url.startsWith(COVER_URL_PREFIX)) errors.cover_url = "Please upload the poster again.";
    else payload.cover_url = f.cover_url;
  }
  let rowIssues: RowIssue[] = [];
  if (datesTouched) {
    const b = buildOccurrences(f.rows, now);
    if (!b.ok) { rowIssues = b.issues; errors.occurrences = b.general[0] ?? "Please check the dates marked below."; }
    else if (!sameDates(b.occurrences, current.future)) payload.occurrences = b.occurrences;
  }
  if (Object.keys(errors).length) return { ok: false, errors, rowIssues };
  if (Object.keys(payload).length === 0) return { ok: false, errors: {}, rowIssues: [], nothingChanged: true };
  return { ok: true, payload, changed: Object.keys(payload) };
}

export type RestoreOption = { kind: "performance"; occurrenceId: string } | { kind: "event" };

/**
 * What can be undone right now. The database only allows an undo for the very latest logged action, made by the contributor, within 24 hours;
 * we offer the button on the same terms (the database still has the last word).
 */
export function restoreOption(log: readonly LogRow[] | null, nowMs: number): RestoreOption | null {
  const last = log?.[0];
  if (!last || last.actor_kind !== "contributor") return null;
  const t = Date.parse(last.created_at);
  if (!Number.isFinite(t) || nowMs - t > DAY) return null;
  if (last.action === "event_cancelled") return { kind: "event" };
  if (last.action === "performance_cancelled" && last.occurrence_id) return { kind: "performance", occurrenceId: last.occurrence_id };
  return null;
}

export const isPast = (startsAt: string, nowMs: number) => Date.parse(startsAt) <= nowMs;

/**
 * ticket-live.ts — what a ticket now is, decided from server rows alone.
 *
 * The customer's ticket card used to sit on whatever the page was rendered
 * with. The organiser could scan it, the organiser's screen would show it used,
 * and the holder's card still read "Valid" until they thought to reload.
 *
 * These helpers hold the whole decision, so the live component never has to
 * guess. Nothing here infers a check-in from a scan, a click or the passage of
 * time: a ticket becomes used because a row came back from `event_tickets`
 * saying so. `newlyUsedIds` is deliberately blind to tickets it has not seen
 * before — a row arriving already-used is not a check-in that just happened,
 * and must not celebrate on first paint.
 *
 * Pure: no imports beyond the shared timezone, no I/O, safe in a Client
 * Component.
 */
import { SHETLAND_TZ } from "@/lib/shetland-time";

export type LiveTicket = {
  id: string;
  status: string | null;
  checked_in_at: string | null;
};

/** The card's used state. `checked_in_at` alone is enough — a scan stamps it. */
export function isUsed(t: Pick<LiveTicket, "status" | "checked_in_at">): boolean {
  return !!t.checked_in_at || t.status === "used" || t.status === "checked_in";
}

/**
 * Ticket ids that went valid → used between two known snapshots.
 *
 * A ticket absent from `prev` yields nothing: on first load, and for any row
 * that appears mid-session, there is no observed transition to celebrate.
 */
export function newlyUsedIds(prev: LiveTicket[], next: LiveTicket[]): string[] {
  const before = new Map(prev.map((t) => [t.id, isUsed(t)]));
  return next.filter((t) => isUsed(t) && before.get(t.id) === false).map((t) => t.id);
}

/**
 * Fold a server read over what is on screen. The server wins for every row it
 * returned; rows it did not return are left exactly as they were, so a partial
 * response can never silently downgrade a ticket.
 */
export function mergeServerTickets(current: LiveTicket[], server: LiveTicket[]): LiveTicket[] {
  const byId = new Map(server.map((t) => [t.id, t]));
  return current.map((t) => byId.get(t.id) ?? t);
}

/** Is there anything left that could still be scanned? */
export function anyStillValid(ts: LiveTicket[]): boolean {
  return ts.some((t) => !isUsed(t));
}

/** Realtime is the mechanism; these are the safety net, not the plan. */
export const POLL_MS_REALTIME_PROVEN = 60_000;
export const POLL_MS_REALTIME_UNPROVEN = 10_000;

/**
 * How often to re-read, or null for not at all.
 *
 * `realtimeProven` means an actual postgres_changes event has been received —
 * not that the channel reported SUBSCRIBED. A channel reports SUBSCRIBED for a
 * table that is not in the publication at all, so the status says only that the
 * topic was joined, never that a row will arrive. Gating the backstop on it
 * widened the poll to a minute in exactly the case the backstop exists for, and
 * a scan took 35 seconds to reach the customer.
 *
 * So the fast interval is the default and Realtime has to earn the slow one.
 * Once every ticket on the page is used there is nothing left to watch and the
 * timer stops rather than pinging forever behind an open tab.
 */
export function pollIntervalMs(realtimeProven: boolean, ts: LiveTicket[]): number | null {
  if (!anyStillValid(ts)) return null;
  return realtimeProven ? POLL_MS_REALTIME_PROVEN : POLL_MS_REALTIME_UNPROVEN;
}

/** Long enough to read, short enough not to be in the way. */
export const CELEBRATION_MS = 1_100;

/**
 * The badge. Event status outranks the ticket: a ticket to a cancelled event
 * must not read "Valid" whatever its own row says. A refunded or cancelled
 * ticket says so rather than falling through to "Valid", which is what a plain
 * used/not-used test would have done had one ever reached this page.
 */
export function ticketBadge(t: LiveTicket, eventStatus: string | null): string {
  if (eventStatus === "cancelled") return "Cancelled";
  if (eventStatus === "postponed") return "Postponed";
  if (t.status === "refunded") return "Refunded";
  if (t.status === "cancelled") return "Cancelled";
  return isUsed(t) ? "Used" : "Valid";
}

/** Only a live, unused ticket is worth showing a scannable code for. */
export function showsCode(t: LiveTicket, eventStatus: string | null): boolean {
  return ticketBadge(t, eventStatus) === "Valid";
}

/**
 * The check-in time, in Shetland's zone. Without the zone this renders in
 * whatever clock the reader's device keeps, which is how a booking once showed
 * 09:30 to the customer and 08:30 on the server for the whole of BST.
 */
export function checkedInTimeLabel(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: SHETLAND_TZ });
}

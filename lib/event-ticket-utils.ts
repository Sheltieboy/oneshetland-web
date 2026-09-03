/**
 * event-ticket-utils.ts — the pure half of event ticketing.
 *
 * Constants and calculations with no Supabase client, no next/headers and no
 * server-only anything, so a Client Component may import them.
 *
 * This file exists because of a real build failure. BusinessEventForm and
 * BusinessEventManage both held TYPE-ONLY imports from lib/events-manage.ts,
 * which TypeScript erases — no runtime edge, no problem. Adding a VALUE import
 * (DEFAULT_PER_ORDER_MAX, ticketCapacity) to those same lines turned an erased
 * import into a real one, and dragged the whole server module into the client
 * graph:
 *
 *   BusinessEventForm [Client] → lib/events-manage.ts → lib/supabase/server.ts
 *                              → next/headers  ✗
 *
 * Turbopack refused it and the Netlify deploy failed, which is why the new
 * field never appeared in production. Pure things live here; lib/events-manage
 * stays server-only and re-exports these so there is still one definition.
 */

/** The database default for event_ticket_types.per_order_max. Shown to the
 *  owner rather than applied behind them. */
export const DEFAULT_PER_ORDER_MAX = 10;

/**
 * What to put on the owner's Capacity card.
 *
 * It used to read events.capacity — a venue headcount nobody fills in — so an
 * owner who had just set a ticket quantity of 5 was told "∞" and reasonably
 * concluded it had not saved. The number that governs whether a ticket can be
 * sold is event_ticket_types.quantity_available; reserve_ticket_slots reads
 * that and never looks at events.capacity.
 *
 * Unlimited stays "∞" because it genuinely is. A mixture of finite and
 * unlimited types is also "∞": once one type is uncapped the event has no
 * ceiling, and adding the finite ones up would state a limit that does not
 * exist. Only when EVERY active type is finite is there a total worth showing.
 */
export function ticketCapacity(
  types: { quantity_available: number | null; is_active: boolean }[],
  eventCapacity: number | null,
): { label: string; source: "tickets" | "venue" } {
  const active = types.filter((t) => t.is_active);
  if (active.length === 0) {
    return { label: eventCapacity != null ? String(eventCapacity) : "∞", source: "venue" };
  }
  if (active.some((t) => t.quantity_available == null)) return { label: "∞", source: "tickets" };
  return {
    label: String(active.reduce((n, t) => n + (t.quantity_available ?? 0), 0)),
    source: "tickets",
  };
}

/**
 * event-cancel-panel.ts — what an organiser of a TICKETED event (business or hub) is told before and after cancelling it. Pure: no network, no React.
 *
 * WHAT REALLY HAPPENS TODAY (read from the code, 7 Nov 2026; keep this honest if any of it changes):
 *  - Business event, "Cancel event": setEventStatus() sets events.status = 'cancelled', inserts an event_updates row (kind 'cancellation') and calls the
 *    notify-event-update Edge Function WITHOUT waiting for it. That function, for every event_tickets row with status 'valid': sends an in-app notification
 *    (and a push if the person has the app) through the preference check (muted events/master switch => skipped; quiet hours ignored), and sends an EMAIL
 *    (template events.cancelled) to each holder with an address, regardless of notification preferences. Nobody reads back whether each arrived.
 *  - Hub event, "Cancel": since 7 Nov 2026 this runs the SAME steps as a business (cancelEventReportingNotify -> setEventStatus). Before that it was only a
 *    status change and told ticket holders nothing. A hub owner or active committee member is authorised: the event_updates insert policy uses is_hub_admin,
 *    and notify-event-update uses can_scan_event (owner / active committee of the organising hub). Only the hub OWNER can refund.
 *  - Neither refunds anyone. Refunds are manual, one order at a time (refund-payment), allowed by can_refund_event_orders: platform admin, the business
 *    owner, or the hub OWNER (not committee members). A holder of a valid ticket can still open the cancelled event in My tickets (events_ticket_holder_read).
 * So the copy says "try to email" for both (delivery is not read back). It never says anyone "will be notified". Hubs differ only in who may refund.
 */
import { SUPPORT_EMAIL } from "./contributor-copy";

export type CancelHost = "business" | "hub";

export type BuyerSummary =
  | { known: false }
  | { known: true; liveOrders: number; liveTickets: number; paidOrders: number; paidPence: number; refundedOrders: number; atLeast: boolean; canRefund: boolean };

const num = (v: unknown): number => (typeof v === "number" && Number.isFinite(v) ? v : 0);

/** Reads the get_event_orders reply. Anything unexpected is "not known", never a guess. */
export function summariseBuyers(raw: unknown): BuyerSummary {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return { known: false };
  const r = raw as { orders?: unknown; total_orders?: unknown; can_refund?: unknown };
  if (!Array.isArray(r.orders)) return { known: false };
  let liveOrders = 0, liveTickets = 0, paidOrders = 0, paidPence = 0, refundedOrders = 0;
  for (const o of r.orders) {
    if (!o || typeof o !== "object") continue;
    const x = o as { status?: unknown; total_pence?: unknown; tickets_count?: unknown };
    if (x.status === "paid") {
      liveOrders += 1; liveTickets += num(x.tickets_count);
      if (num(x.total_pence) > 0) { paidOrders += 1; paidPence += num(x.total_pence); }
    } else if (x.status === "refunded") refundedOrders += 1;
  }
  return { known: true, liveOrders, liveTickets, paidOrders, paidPence, refundedOrders, atLeast: num(r.total_orders) > r.orders.length, canRefund: r.can_refund === true };
}

const pounds = (p: number) => `£${(p / 100).toFixed(2)}`;
const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

export type CancelPanel = { title: string; summary: string; willDo: string[]; willNot: string[]; refund: string; supportLead: string; support: string; ordersLabel: string; nobody: boolean };

function summaryLine(s: BuyerSummary): string {
  if (!s.known) return "We couldn't check how many people have bought tickets. Please look at Ticket orders first.";
  if (s.liveOrders === 0) return s.refundedOrders > 0 ? "Nobody currently holds a valid ticket. Every order so far has been refunded." : "Nobody currently holds a valid ticket for this event.";
  const more = s.atLeast ? "At least " : "";
  const money = s.paidOrders > 0 ? `, ${pounds(s.paidPence)} taken in ${plural(s.paidOrders, "paid order", "paid orders")}` : "";
  return `${more}${plural(s.liveOrders, "order", "orders")} (${plural(s.liveTickets, "ticket", "tickets")}) ${s.liveOrders === 1 ? "is" : "are"} still valid${money}.`;
}

const MARKED = "Mark the event Cancelled. People who hold a ticket will see it marked Cancelled in My tickets.";
const TELL_HOLDERS = "Try to email everyone who holds a valid ticket, and add a note to their OneShetland notifications. We can't see afterwards whether each message arrived.";

function refundLine(host: CancelHost, s: BuyerSummary): string {
  const manual = "Refund anyone automatically. Refunds are made one order at a time on the Ticket orders screen, and each refund also makes that order's tickets invalid.";
  if (host === "hub") {
    if (s.known && s.canRefund) return `${manual} As the hub owner you can refund them.`;
    if (s.known) return `${manual} Only the hub owner can refund orders, and you can't, so please ask the hub owner or contact OneShetland.`;
    return `${manual} Only the hub owner can refund orders.`;
  }
  return s.known && !s.canRefund ? `${manual} You can't refund orders yourself, so please contact OneShetland.` : manual;
}

/** The panel shown BEFORE the organiser confirms. */
export function cancelPanel(host: CancelHost, s: BuyerSummary): CancelPanel {
  const nobody = s.known && s.liveOrders === 0;
  return {
    title: "People may have bought tickets for this event",
    summary: summaryLine(s),
    willDo: nobody ? [MARKED] : [MARKED, TELL_HOLDERS],
    willNot: nobody ? [] : [refundLine(host, s)],
    refund: "To refund, open Ticket orders, choose an order and refund it.",
    supportLead: "Need help telling people or arranging refunds? Email",
    support: `Need help telling people or arranging refunds? Email ${SUPPORT_EMAIL}.`,
    ordersLabel: "Open Ticket orders",
    nobody,
  };
}

export type AfterCancel = { title: string; lines: string[]; ordersLabel: string; supportLead: string; supportLine: string };

/** What the organiser is told once it is done. `notifyError` is the error text if the business update could not be recorded. */
export function afterCancel(host: CancelHost, s: BuyerSummary, notifyError?: string | null): AfterCancel {
  const lines = ["The event is now marked Cancelled."];
  const nobody = s.known && s.liveOrders === 0;
  if (!nobody) {
    lines.push(notifyError
      ? `We couldn't send the cancellation message to ticket holders (${notifyError.trim().replace(/[.\s]+$/, "")}). Please tell them yourself${host === "business" ? ", or post an update from this page" : ""}.`
      : "We've asked for the cancellation to be emailed to everyone who holds a valid ticket, with a note in their OneShetland notifications. We can't see afterwards whether each one arrived.");
    lines.push("No one has been refunded. Refund each order on the Ticket orders screen.");
  }
  return { title: "Event cancelled", lines, ordersLabel: "Open Ticket orders", supportLead: "Need help? Email", supportLine: `Need help? Email ${SUPPORT_EMAIL}.` };
}

/** Whether to show the panel at all: only for an event that sells (or has sold) tickets through OneShetland. */
export function sellsOneShetlandTickets(e: { ticketTypes?: readonly unknown[] | null; hasTickets?: boolean | null; ticketsSold?: number | null; externalUrl?: string | null }): boolean {
  if ((e.ticketsSold ?? 0) > 0) return true;
  if (e.ticketTypes && e.ticketTypes.some((t) => (t as { is_active?: boolean } | null)?.is_active !== false)) return true;
  return !!e.hasTickets && !e.externalUrl;
}

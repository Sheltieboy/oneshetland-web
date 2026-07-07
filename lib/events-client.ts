"use client";

import { createClient } from "@/lib/supabase/client";

function invokeError(error: { message: string; context?: { json?: () => Promise<{ error?: string }> } }): Promise<never> {
  return (async () => {
    let msg = error.message;
    try { const b = await error.context?.json?.(); if (b?.error) msg = b.error; } catch { /* */ }
    throw new Error(msg);
  })();
}

export type LineItem = {
  ticket_type_id: string;
  quantity: number;
};

export type TicketPurchaseStart =
  | { free: true; order_id: string }
  | { charged: true; order_id: string; wallet?: true }
  | { clientSecret: string; order_id: string };

export async function startTicketPurchase(
  eventId: string,
  lineItems: LineItem[],
  opts: { useSavedCard?: boolean; payWithWallet?: boolean } = {},   // default to the buyer's saved card (server falls back to the card form if none) — matches the app
): Promise<TicketPurchaseStart> {
  const { useSavedCard = true, payWithWallet = false } = opts;
  const sb = createClient();
  const { data, error } = await sb.functions.invoke("create-event-ticket-intent", {
    body: {
      event_id: eventId,
      line_items: lineItems,
      use_saved_card: payWithWallet ? false : useSavedCard,
      pay_with_wallet: payWithWallet,
    },
  });
  if (error) return invokeError(error);
  return data as TicketPurchaseStart;
}

export async function confirmTicketPurchase(
  orderId: string,
  paymentIntentId: string,
): Promise<{ ok: boolean; tickets_count: number }> {
  const sb = createClient();
  const { data, error } = await sb.functions.invoke("confirm-event-tickets", {
    body: { order_id: orderId, payment_intent_id: paymentIntentId },
  });
  if (error) return invokeError(error);
  return data;
}

/* ── Ticket check-in (organiser scanner) ─────────────────────────────────────
   Mirrors the app's event-scanner: same `validate-event-ticket` edge function
   and `get_event_scanner_stats` RPC. The web tool drives the manual-entry path
   (raw token from a QR string, or an XXXX-XXXX backup code). */

export type CheckInResultCode =
  | "valid"
  | "already_used"
  | "wrong_event"
  | "cancelled"
  | "refunded"
  | "not_found"
  | "payment_incomplete"
  | "invalid_token";

export type CheckInResult = {
  result: CheckInResultCode | string;
  ticket_type_id?: string;
  ticket_type_name?: string;
  attendee_name?: string;
  checked_in_at?: string;
};

export type ScannerStats = {
  tickets_sold: number;
  checked_in: number;
  pending_payment: number;
};

/** Validate + check in a single ticket. Pass a raw QR token OR a backup code. */
export async function validateEventTicket(
  eventId: string,
  input: { rawToken?: string; backupCode?: string },
): Promise<CheckInResult> {
  const sb = createClient();
  const body: Record<string, string> = { event_id: eventId };
  if (input.rawToken) body.raw_token = input.rawToken;
  else if (input.backupCode) body.backup_code = input.backupCode.toUpperCase().replace(/[^A-Z0-9]/g, "");

  const { data, error } = await sb.functions.invoke("validate-event-ticket", { body });
  if (error) return invokeError(error);
  if ((data as { error?: string })?.error) throw new Error((data as { error: string }).error);
  return data as CheckInResult;
}

/** Live sold / checked-in / pending-payment counts for an event. */
export async function fetchScannerStats(eventId: string): Promise<ScannerStats> {
  const sb = createClient();
  const { data, error } = await sb.rpc("get_event_scanner_stats", { p_event_id: eventId });
  if (error) throw error;
  return (data as ScannerStats) ?? { tickets_sold: 0, checked_in: 0, pending_payment: 0 };
}

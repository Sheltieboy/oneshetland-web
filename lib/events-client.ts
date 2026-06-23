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
  | { charged: true; order_id: string }
  | { clientSecret: string; order_id: string };

export async function startTicketPurchase(
  eventId: string,
  lineItems: LineItem[],
  useSavedCard = false,
): Promise<TicketPurchaseStart> {
  const sb = createClient();
  const { data, error } = await sb.functions.invoke("create-event-ticket-intent", {
    body: { event_id: eventId, line_items: lineItems, use_saved_card: useSavedCard },
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

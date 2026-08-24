"use client";

import { createClient } from "@/lib/supabase/client";

/**
 * Web client for the staff-verified redemption backbone (mirrors the app's
 * lib/local-api.ts helpers). Customer starts a redemption → shows a code/QR →
 * staff verify → effect applied. Used for offers, stamp rewards, passes, points.
 */
export type RedeemKind = "offer" | "reward" | "pass" | "points";
export type RedemptionTicket = {
  id: string; code: string; token: string; kind: RedeemKind;
  detail: { title?: string; subtitle?: string }; expires_at: string;
};

export async function startRedemption(kind: RedeemKind, refId: string, amount?: number): Promise<RedemptionTicket> {
  const { data, error } = await createClient().functions.invoke("local-redeem-start", {
    body: { kind, ref_id: refId, amount },
  });
  if (error) throw new Error(await fnError(error, "Could not start redemption."));
  return data as RedemptionTicket;
}

/**
 * READ-ONLY look-up of a pending code. Consumes nothing — Counter mode calls
 * this first so staff see what they are about to redeem before it is spent.
 */
export async function previewRedemption(input: { code?: string; token?: string }): Promise<{
  kind: RedeemKind;
  detail: { title?: string; subtitle?: string };
  uses_remaining?: number;
}> {
  const { data, error } = await createClient().functions.invoke("local-redeem-verify", {
    body: { ...input, preview: true },
  });
  if (error) throw new Error(await fnError(error, "Could not look that code up."));
  return data as { kind: RedeemKind; detail: { title?: string; subtitle?: string }; uses_remaining?: number };
}

export async function verifyRedemption(input: { code?: string; token?: string }): Promise<{ ok: boolean; kind: RedeemKind; detail: { title?: string; subtitle?: string } }> {
  const { data, error } = await createClient().functions.invoke("local-redeem-verify", { body: input });
  if (error) throw new Error(await fnError(error, "Could not verify."));
  return data as { ok: boolean; kind: RedeemKind; detail: { title?: string; subtitle?: string } };
}

export type RedemptionStatus = "pending" | "consumed" | "expired" | "cancelled" | null;

/**
 * READ-ONLY. The customer modal polls this while it waits for staff. It reads
 * two rows and writes nothing — polling must never consume a use.
 *
 * It returns the pass's AUTHORITATIVE balance alongside the status so the
 * customer card can display the server's number instead of subtracting one for
 * itself. That guess is what showed "1 use left" against a database that
 * correctly said 2.
 */
export async function getRedemptionState(id: string): Promise<{
  status: RedemptionStatus;
  usesRemaining: number | null;
}> {
  const sb = createClient();
  const { data } = await sb
    .from("local_redemptions")
    .select("status, kind, ref_id")
    .eq("id", id)
    .maybeSingle();
  const row = data as { status?: string; kind?: string; ref_id?: string } | null;
  if (!row) return { status: null, usesRemaining: null };

  let usesRemaining: number | null = null;
  if (row.kind === "pass" && row.ref_id) {
    // The customer owns this purchase, so RLS returns it to them and nobody else.
    const { data: pass } = await sb
      .from("book_unit_purchases")
      .select("uses_remaining")
      .eq("id", row.ref_id)
      .maybeSingle();
    usesRemaining = (pass as { uses_remaining?: number } | null)?.uses_remaining ?? null;
  }
  return { status: (row.status as RedemptionStatus) ?? null, usesRemaining };
}

export async function getRedemptionStatus(id: string): Promise<RedemptionStatus> {
  return (await getRedemptionState(id)).status;
}

/** Supabase FunctionsHttpError hides the JSON body — dig out the real message. */
async function fnError(error: unknown, fallback: string): Promise<string> {
  try {
    const ctx = (error as { context?: Response })?.context;
    if (ctx && typeof ctx.json === "function") {
      const body = await ctx.json();
      if (body?.error) return body.error as string;
    }
  } catch { /* fall through */ }
  return error instanceof Error ? error.message : fallback;
}

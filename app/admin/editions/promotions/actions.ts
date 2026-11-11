"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/admin-data.server";
import { createClient } from "@/lib/supabase/server";
import { isUuid } from "@/lib/editions/validate";
import { isIsoDay, promoError, validateGrant, validateReason } from "./calendar";

/** Admin promotion actions. requireAdmin() first, then as the signed-in administrator (the SQL functions check again, apply the integrity rules and audit every change). No service key. */
export type Result = { ok: true } | { ok: false; error: string };
const refresh = () => revalidatePath("/admin/editions/promotions");
type Err = { message?: string; hint?: string | null } | null;
const fail = (e: Err): Result => ({ ok: false, error: promoError(e?.message, e?.hint) });

export async function cancelPromoBooking(input: { booking: string; reason: string }): Promise<Result> {
  await requireAdmin();
  if (!isUuid(input.booking)) return { ok: false, error: "Unknown booking." };
  const r = validateReason(input.reason); if (!r.ok) return r;
  const { error } = await (await createClient()).rpc("admin_promo_cancel", { p_booking: input.booking, p_reason: r.reason });
  if (error) return fail(error); refresh(); return { ok: true };
}
export async function reschedulePromoBooking(input: { booking: string; start: string; reason: string }): Promise<Result> {
  await requireAdmin();
  if (!isUuid(input.booking)) return { ok: false, error: "Unknown booking." };
  if (!isIsoDay(input.start)) return { ok: false, error: "Choose a new start date." };
  const r = validateReason(input.reason); if (!r.ok) return r;
  const { error } = await (await createClient()).rpc("admin_promo_reschedule", { p_booking: input.booking, p_start: input.start, p_reason: r.reason });
  if (error) return fail(error); refresh(); return { ok: true };
}
export async function grantPromoRight(input: { edition: string; kind: string; days: string; reason: string }): Promise<Result> {
  await requireAdmin();
  const v = validateGrant(input); if (!v.ok) return v;
  const { error } = await (await createClient()).rpc("admin_grant_promo_right", { p_edition: v.edition, p_kind: v.kind, p_days: v.days, p_reason: v.reason });
  if (error) return fail(error); refresh(); return { ok: true };
}

"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { mapLaunch50Error, type Launch50ErrorCode, type Launch50Tier } from "@/lib/launch50-core";

/** Owner actions for OneShetland Launch 50. Every one is a database function that re-checks ownership; this layer only maps errors to friendly words. */
export type Launch50ActionResult = { ok: boolean; error?: string; code?: Launch50ErrorCode; expiresAt?: string | null };

const isId = (v: unknown): v is string => typeof v === "string" && /^[0-9a-f-]{8,40}$/i.test(v);

async function call(fn: string, args: Record<string, unknown>): Promise<{ data: unknown; err: Launch50ActionResult | null }> {
  try {
    const sb = await createClient();
    const { data, error } = await sb.rpc(fn, args);
    if (error) { const m = mapLaunch50Error(error); return { data: null, err: { ok: false, error: m.error, code: m.code } }; }
    return { data, err: null };
  } catch {
    const m = mapLaunch50Error(null);
    return { data: null, err: { ok: false, error: m.error, code: m.code } };
  }
}

export async function reservePlace(businessId: string, tier: Launch50Tier, showcase: boolean): Promise<Launch50ActionResult> {
  if (!isId(businessId) || (tier !== "pro" && tier !== "premium")) return { ok: false, error: mapLaunch50Error(null).error, code: "generic" };
  const { data, err } = await call("launch50_reserve", { p_business: businessId, p_tier: tier, p_showcase: !!showcase });
  if (err) return err;
  revalidatePath(`/business/${businessId}/manage/billing`);
  return { ok: true, expiresAt: (data as { expires_at?: string } | null)?.expires_at ?? null };
}

export async function releasePlace(businessId: string): Promise<Launch50ActionResult> {
  if (!isId(businessId)) return { ok: false, error: mapLaunch50Error(null).error, code: "generic" };
  const { err } = await call("launch50_release", { p_business: businessId });
  if (err) return err;
  revalidatePath(`/business/${businessId}/manage/billing`);
  return { ok: true };
}

export async function setShowcase(businessId: string, optIn: boolean): Promise<Launch50ActionResult> {
  if (!isId(businessId)) return { ok: false, error: mapLaunch50Error(null).error, code: "generic" };
  const { err } = await call("launch50_set_showcase", { p_business: businessId, p_opt_in: !!optIn });
  if (err) return err;
  revalidatePath(`/business/${businessId}/manage/billing`);
  revalidatePath("/launch-50");
  return { ok: true };
}

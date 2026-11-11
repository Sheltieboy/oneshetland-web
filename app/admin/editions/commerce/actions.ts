"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/admin-data.server";
import { createClient } from "@/lib/supabase/server";
import { adminError } from "../helpers";
import { isUuid } from "@/lib/editions/validate";
import { COMMERCE_KEYS, validateConfigValue } from "./config";
import { toPence } from "@/lib/editions/commerce";
import { upsertArgs, validateEdit, type CatalogueRow } from "./catalogue";

/** Admin commercial model. requireAdmin() first, then as the signed-in admin (the SQL functions check again and audit every change). No service key. */
export type Result = { ok: true } | { ok: false; error: string };
const fail = (e: unknown): Result => ({ ok: false, error: adminError(e instanceof Error ? e.message : String(e)) });
const refresh = () => revalidatePath("/admin/editions/commerce");

export async function setCommerceConfig(key: string, value: string): Promise<Result> {
  await requireAdmin();
  const v = validateConfigValue(key, value); if (!v.ok) return v;
  const sb = await createClient(); const { error } = await sb.rpc("admin_set_edition_commerce_config", { p_key: key, p_value: v.value });
  if (error) return { ok: false, error: /not allowed/.test(error.message) ? "That setting or value is not allowed." : adminError(error.message) };
  refresh(); return { ok: true };
}
export async function upsertPackage(input: Record<string, unknown>): Promise<Result> {
  await requireAdmin();
  const v = validateEdit(input); if (!v.ok) return v;
  const sb = await createClient();
  // Everything that is not editable (kind, days, features, cap, grants) comes from the stored row, so this form can never loosen a rule. Retired rows are refused here and by the database.
  const { data: row, error: readErr } = await sb.from("edition_packages").select("code, name, description, price_pence, duration_days, features, max_members, active, sort, is_free, kind, grants, retired_at").eq("code", v.code).maybeSingle();
  if (readErr || !row) return { ok: false, error: "That package could not be found." };
  if ((row as CatalogueRow).retired_at) return { ok: false, error: "That package is retired. It cannot be changed or switched back on." };
  const { error } = await sb.rpc("admin_upsert_edition_package", upsertArgs(row as CatalogueRow, v));
  if (error) return fail(error.message);
  refresh(); return { ok: true };
}
export async function grantOrgEntitlement(input: { organiserId: string; feature: string; max?: string; days: string; reason: string }): Promise<Result> {
  await requireAdmin();
  if (!isUuid(input.organiserId)) return { ok: false, error: "Unknown organiser." };
  const days = Number(input.days); if (!Number.isInteger(days) || days < 1 || days > 730) return { ok: false, error: "Choose 1 to 730 days." };
  const max = String(input.max ?? "").trim() ? Number(input.max) : null; if (max !== null && (!Number.isInteger(max) || max < 1)) return { ok: false, error: "The limit must be 1 or more." };
  const sb = await createClient();
  const { error } = await sb.rpc("admin_grant_edition_org_entitlement", { p_org: input.organiserId, p_feature: input.feature, p_max: max, p_ends: new Date(Date.now() + days * 864e5).toISOString(), p_reason: (input.reason ?? "").trim() });
  if (error) return fail(error.message); refresh(); return { ok: true };
}
export async function voidOrgEntitlement(id: string, reason: string): Promise<Result> {
  await requireAdmin(); if (!isUuid(id)) return { ok: false, error: "Unknown entitlement." };
  const sb = await createClient(); const { error } = await sb.rpc("admin_void_edition_org_entitlement", { p_entitlement: id, p_reason: (reason ?? "").trim() });
  if (error) return fail(error.message); refresh(); return { ok: true };
}
export async function setFeeOverride(input: { organiserId: string; kind: string; percent?: string; fixed?: string; waived: boolean; reason: string; days?: string }): Promise<Result> {
  await requireAdmin();
  if (!isUuid(input.organiserId) || (input.kind !== "participation" && input.kind !== "membership")) return { ok: false, error: "Choose an organiser and a fee type." };
  const pct = String(input.percent ?? "").trim() ? Number(input.percent) : null; if (pct !== null && !(pct >= 0 && pct <= 50)) return { ok: false, error: "Percent must be between 0 and 50." };
  const fixed = String(input.fixed ?? "").trim() ? toPence(input.fixed) : null; if (String(input.fixed ?? "").trim() && fixed === null) return { ok: false, error: "Enter the fixed fee like 0.20." };
  const days = String(input.days ?? "").trim() ? Number(input.days) : null;
  const sb = await createClient();
  const { error } = await sb.rpc("admin_set_edition_fee_override", { p_org: input.organiserId, p_kind: input.kind, p_percent: pct, p_fixed: fixed, p_waived: input.waived, p_reason: (input.reason ?? "").trim(), p_until: days ? new Date(Date.now() + days * 864e5).toISOString() : null });
  if (error) return fail(error.message); refresh(); return { ok: true };
}
export async function setCollectionSuspended(organiserId: string, suspended: boolean, reason: string): Promise<Result> {
  await requireAdmin(); if (!isUuid(organiserId)) return { ok: false, error: "Unknown organiser." };
  const sb = await createClient(); const { error } = await sb.rpc("admin_set_edition_collection", { p_org: organiserId, p_suspended: suspended, p_reason: (reason ?? "").trim() });
  if (error) return fail(error.message); refresh(); return { ok: true };
}
export async function resolveException(id: string, note: string): Promise<Result> {
  await requireAdmin(); if (!isUuid(id)) return { ok: false, error: "Unknown exception." };
  const sb = await createClient(); const { error } = await sb.rpc("admin_resolve_edition_exception", { p_exception: id, p_note: (note ?? "").trim() });
  if (error) return fail(error.message); refresh(); return { ok: true };
}
void COMMERCE_KEYS;

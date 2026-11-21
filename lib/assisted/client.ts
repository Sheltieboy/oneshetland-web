import "server-only";
/**
 * client.ts — the server-side door to the Assisted Publishing functions.
 *
 * Every call runs as the signed-in administrator through the ordinary authenticated client: the
 * database function checks the caller itself (launch_plan_authorised) and writes its own audit. No
 * service key is used anywhere in this feature, and there is no fallback that bypasses a refusal.
 */
import { createClient } from "@/lib/supabase/server";
import type { AssistedKind, AssistedRow, CreateResult, DuplicateCandidate } from "@/lib/assisted/shape";

/** A refusal from the database is a result to show the administrator, never a crash. */
const message = (e: unknown): string => {
  const m = e instanceof Error ? e.message : typeof e === "string" ? e : "";
  if (/42501|Only an administrator/i.test(m)) return "Only an administrator can do that.";
  return m.trim() || "Something went wrong. Please try again.";
};

export async function duplicatesFor(kind: AssistedKind, name: string): Promise<DuplicateCandidate[]> {
  try {
    const { data, error } = await (await createClient()).rpc("admin_assisted_duplicates", { p_kind: kind, p_name: name });
    if (error) return [];
    return ((data ?? []) as { subject_id: string; subject_name: string; slug: string | null; claimed: boolean; active: boolean; how: string }[])
      .map((d) => ({ id: d.subject_id, name: d.subject_name, slug: d.slug, claimed: d.claimed, active: d.active, how: d.how }));
  } catch { return []; }
}

export type BusinessInput = {
  name: string; category: string; address: string;
  description?: string | null; phone?: string | null; email?: string | null; website?: string | null;
  requestedByName?: string | null; requestedByEmail?: string | null; requestNote?: string | null;
  publish: boolean; confirmDuplicate: boolean;
};

export async function createBusiness(input: BusinessInput): Promise<CreateResult> {
  try {
    const { data, error } = await (await createClient()).rpc("admin_assisted_create_business", {
      p_name: input.name, p_category: input.category, p_address: input.address,
      p_description: input.description ?? null, p_phone: input.phone ?? null,
      p_email: input.email ?? null, p_website: input.website ?? null,
      p_requested_by_name: input.requestedByName ?? null, p_requested_by_email: input.requestedByEmail ?? null,
      p_request_note: input.requestNote ?? null, p_publish: input.publish, p_confirm_duplicate: input.confirmDuplicate,
    });
    if (error) return { created: false, reason: "error", message: message(error.message) };
    return data as CreateResult;
  } catch (e) { return { created: false, reason: "error", message: message(e) }; }
}

export type HubInput = {
  name: string; type: string;
  description?: string | null; area?: string | null; contactEmail?: string | null; contactPhone?: string | null; website?: string | null;
  requestedByName?: string | null; requestedByEmail?: string | null; requestNote?: string | null;
  publish: boolean; confirmDuplicate: boolean;
};

export async function createHub(input: HubInput): Promise<CreateResult> {
  try {
    const { data, error } = await (await createClient()).rpc("admin_assisted_create_hub", {
      p_name: input.name, p_type: input.type,
      p_description: input.description ?? null, p_area: input.area ?? null,
      p_contact_email: input.contactEmail ?? null, p_contact_phone: input.contactPhone ?? null, p_website: input.website ?? null,
      p_requested_by_name: input.requestedByName ?? null, p_requested_by_email: input.requestedByEmail ?? null,
      p_request_note: input.requestNote ?? null, p_publish: input.publish, p_confirm_duplicate: input.confirmDuplicate,
    });
    if (error) return { created: false, reason: "error", message: message(error.message) };
    return data as CreateResult;
  } catch (e) { return { created: false, reason: "error", message: message(e) }; }
}

/** What OneShetland has created on request. Returns [] rather than throwing if the function is absent. */
export async function listAssisted(kind?: AssistedKind, limit = 100): Promise<AssistedRow[]> {
  try {
    const { data, error } = await (await createClient()).rpc("admin_assisted_list", { p_kind: kind ?? null, p_limit: limit });
    if (error) return [];
    return (data ?? []) as AssistedRow[];
  } catch { return []; }
}

export async function setRequest(kind: AssistedKind, id: string, name: string | null, email: string | null, note: string | null): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const { error } = await (await createClient()).rpc("admin_assisted_set_request", {
      p_kind: kind, p_id: id, p_requested_by_name: name, p_requested_by_email: email, p_request_note: note,
    });
    return error ? { ok: false, error: message(error.message) } : { ok: true };
  } catch (e) { return { ok: false, error: message(e) }; }
}

export async function forgetContact(kind: AssistedKind, id: string): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const { error } = await (await createClient()).rpc("admin_assisted_forget_contact", { p_kind: kind, p_id: id });
    return error ? { ok: false, error: message(error.message) } : { ok: true };
  } catch (e) { return { ok: false, error: message(e) }; }
}

import { createClient } from "@/lib/supabase/server";

/** Staff reads for the Editions admin pages. Run as the signed-in administrator (RLS decides); never a service key. A missing table or refused read yields { rows: [], error }. */
export type Read<T> = { rows: T[]; error: string | null };
const MISSING = "Editions is not set up yet: the database migration (20270102000000_editions_foundation) has not been applied, or this account cannot read it.";

async function read<T>(label: string, run: (sb: Awaited<ReturnType<typeof createClient>>) => PromiseLike<{ data: unknown; error: { message: string; code?: string } | null }>): Promise<Read<T>> {
  try {
    const { data, error } = await run(await createClient());
    if (error) { console.error(`[admin-editions] ${label} failed:`, error.message); return { rows: [], error: error.code === "42P01" || /does not exist|schema cache/i.test(error.message) ? MISSING : `Could not load: ${error.message}` }; }
    return { rows: (Array.isArray(data) ? data : []) as T[], error: null };
  } catch (e) { console.error(`[admin-editions] ${label} threw:`, e); return { rows: [], error: MISSING }; }
}

export type OrgLite = { id: string; name: string; slug: string; status: string; reserved_name_flag: boolean; is_test: boolean; contact_email?: string | null; created_at: string };
export type QueueRow = { id: string; organiser_id: string; evidence: string; requested_by: string | null; created_at: string; organiser: OrgLite | null };
export type EditionRow = { id: string; slug: string; title: string; kind: string; status: string; is_test: boolean; starts_on: string; ends_on: string; created_at: string; organiser: { id: string; name: string } | null };
export type EntRow = { id: string; feature: string; source: string; starts_at: string; ends_at: string; voided_at: string | null; void_reason: string | null; reason: string | null; created_at: string; amount_pence: number | null; edition: { id: string; title: string; slug: string } | null; organiser: { name: string } | null };
export type AuditRow = { id: number; actor: string | null; organiser_id: string | null; edition_id: string | null; action: string; detail: Record<string, unknown>; created_at: string };

/** The reserved-name flag is internal: not readable from the table, only through an admin-only function (the database refuses everyone else). */
async function reservedFlags(): Promise<Map<string, boolean>> {
  try { const { data } = await (await createClient()).rpc("admin_edition_org_flags"); return new Map(((data ?? []) as { id: string; reserved_name_flag: boolean }[]).map((r) => [r.id, r.reserved_name_flag])); } catch { return new Map(); }
}

export const queueRows = async (): Promise<Read<QueueRow>> => {
  const r = await read<QueueRow>("queue", (sb) =>
    sb.from("edition_organiser_verifications")
      .select("id, organiser_id, evidence, requested_by, created_at, organiser:edition_organisers ( id, name, slug, status, is_test, contact_email, created_at )")
      .eq("status", "pending").order("created_at", { ascending: true }).limit(200));
  const flags = await reservedFlags();
  return { ...r, rows: r.rows.map((x) => ({ ...x, organiser: x.organiser ? { ...x.organiser, reserved_name_flag: flags.get(x.organiser.id) ?? false } : null })) };
};

export const organiserRows = async (status: string): Promise<Read<OrgLite>> => {
  const r = await read<OrgLite>("organisers", (sb) => {
    let q = sb.from("edition_organisers").select("id, name, slug, status, is_test, contact_email, created_at").order("created_at", { ascending: false }).limit(300);
    if (["pending", "verified", "rejected", "suspended"].includes(status)) q = q.eq("status", status);
    return q;
  });
  const flags = await reservedFlags();
  return { ...r, rows: r.rows.map((o) => ({ ...o, reserved_name_flag: flags.get(o.id) ?? false })) };
};

export const editionRows = (status: string, test: string) => read<EditionRow>("editions", (sb) => {
  let q = sb.from("editions").select("id, slug, title, kind, status, is_test, starts_on, ends_on, created_at, organiser:edition_organisers ( id, name )").order("created_at", { ascending: false }).limit(300);
  if (["draft", "published", "archived", "suspended"].includes(status)) q = q.eq("status", status);
  if (test === "test") q = q.eq("is_test", true); else if (test === "real") q = q.eq("is_test", false);
  return q;
});

const ENT_COLS = "id, feature, source, starts_at, ends_at, voided_at, void_reason, reason, created_at, amount_pence, edition:editions ( id, title, slug ), organiser:edition_organisers ( name )";
export const entitlementRows = () => read<EntRow>("entitlements", (sb) => sb.from("edition_entitlements").select(ENT_COLS).order("created_at", { ascending: false }).limit(300));
export const editionEntitlements = (editionId: string) => read<EntRow>("edition entitlements", (sb) => sb.from("edition_entitlements").select(ENT_COLS).eq("edition_id", editionId).order("created_at", { ascending: false }));

export const auditRows = (scope?: { editionId?: string; organiserId?: string }) => read<AuditRow>("audit", (sb) => {
  let q = sb.from("edition_audit_log").select("id, actor, organiser_id, edition_id, action, detail, created_at").order("id", { ascending: false }).limit(200);
  if (scope?.editionId) q = q.eq("edition_id", scope.editionId);
  if (scope?.organiserId) q = q.eq("organiser_id", scope.organiserId);
  return q;
});

/** id -> display name for actors / requesters. Best effort. */
export async function names(ids: (string | null | undefined)[]): Promise<Record<string, string>> {
  const u = [...new Set(ids.filter((i): i is string => !!i))];
  if (!u.length) return {};
  try {
    const sb = await createClient();
    const { data } = await sb.from("profiles").select("id, full_name").in("id", u);
    return Object.fromEntries(((data ?? []) as { id: string; full_name: string | null }[]).map((p) => [p.id, p.full_name || "Unnamed user"]));
  } catch { return {}; }
}

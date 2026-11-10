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
export type EditionRow = { id: string; slug: string; title: string; kind: string; status: string; is_test: boolean; starts_on: string; ends_on: string; created_at: string; organiser: { id: string; name: string } | null };
export type EntRow = { id: string; feature: string; source: string; starts_at: string; ends_at: string; voided_at: string | null; void_reason: string | null; reason: string | null; created_at: string; amount_pence: number | null; edition: { id: string; title: string; slug: string } | null; organiser: { name: string } | null };
export type AuditRow = { id: number; actor: string | null; organiser_id: string | null; edition_id: string | null; action: string; detail: Record<string, unknown>; created_at: string };

/** The reserved-name flag is internal: not readable from the table, only through an admin-only function (the database refuses everyone else). */
async function reservedFlags(): Promise<Map<string, boolean>> {
  try { const { data } = await (await createClient()).rpc("admin_edition_org_flags"); return new Map(((data ?? []) as { id: string; reserved_name_flag: boolean }[]).map((r) => [r.id, r.reserved_name_flag])); } catch { return new Map(); }
}

/** Contact emails are private to the organiser team and are NOT readable from the table, even by administrators (that was the cause of "permission denied for table edition_organisers"
 *  on the queue, the organiser list and the organiser page). Administrators read them through an admin-only function. Best effort: if the function is not in the database yet, emails show blank. */
async function contactEmails(orgId?: string): Promise<Map<string, string | null>> {
  try {
    const { data } = await (await createClient()).rpc("admin_edition_org_contacts", orgId ? { p_org: orgId } : {});
    return new Map(((data ?? []) as { id: string; contact_email: string | null }[]).map((r) => [r.id, r.contact_email]));
  } catch { return new Map(); }
}
export const adminContactEmail = async (orgId: string): Promise<string | null> => (await contactEmails(orgId)).get(orgId) ?? null;

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

/* ── Edition approvals (functions that only administrators may call) ──────────────────────────────────────────────────────────────────────── */

export type ReviewRow = {
  edition_id: string; title: string; slug: string; kind: string; starts_on: string; ends_on: string; organiser_id: string; organiser_name: string; parent_kind: "hub" | "business"; parent_name: string | null;
  review_state: string; status: string; submitted_at: string | null; decided_at: string | null; waiting_days: number | null; material: boolean; reserved: boolean; first_edition: boolean;
};
export const reviewQueue = (tab: string) => read<ReviewRow>("review queue", (sb) => sb.rpc("admin_edition_review_queue", { p_tab: tab }));

export type ReviewDetail = {
  edition: { id: string; title: string; slug: string; kind: string; summary: string | null; starts_on: string; ends_on: string; status: string; review_state: string; submitted_at: string | null; cover_url: string | null; pages: number; sessions: number };
  organiser: { id: string; name: string; slug: string; status: string; reserved_name_flag: boolean; created_at: string };
  parent: { kind: "hub" | "business"; id: string; name: string; active: boolean; verified: boolean; created_at: string; owner: string | null; committee?: string[]; members?: number; tier?: string | null; claim_approved_at?: string | null } | null;
  checks: { key: string; label: string; required: boolean; ok: boolean; hint?: string | null }[];
  package: { entitled: boolean; orders: { status: string; amount_pence: number | null; package: string | null }[] };
  history: { action: string; at: string; note: string | null; changes: Record<string, { from: unknown; to: unknown }> | null; by: string | null }[];
};
export async function reviewDetail(id: string): Promise<{ detail: ReviewDetail | null; error: string | null }> {
  try {
    const { data, error } = await (await createClient()).rpc("admin_edition_review_detail", { p_edition: id });
    if (error) return { detail: null, error: /not found/i.test(error.message) ? "not_found" : error.message };
    return { detail: data as ReviewDetail, error: null };
  } catch (e) { return { detail: null, error: e instanceof Error ? e.message : "Could not load." }; }
}

/** Organisers with the Business or Hub that runs each one (an organiser is an automatic profile of exactly one parent). */
export type OrgWithParent = OrgLite & { parent_kind: "hub" | "business" | null; parent_name: string | null };
export const organisersWithParents = async (status: string): Promise<Read<OrgWithParent>> => {
  const r = await read<OrgLite & { hub_id: string | null; business_id: string | null }>("organisers", (sb) => {
    let q = sb.from("edition_organisers").select("id, name, slug, status, is_test, created_at, hub_id, business_id").order("created_at", { ascending: false }).limit(300);
    if (["pending", "verified", "rejected", "suspended"].includes(status)) q = q.eq("status", status);
    return q;
  });
  if (r.error) return { rows: [], error: r.error };
  const sb = await createClient();
  const hubIds = [...new Set(r.rows.map((o) => o.hub_id).filter((x): x is string => !!x))], bizIds = [...new Set(r.rows.map((o) => o.business_id).filter((x): x is string => !!x))];
  const [h, b] = await Promise.all([
    hubIds.length ? sb.from("hubs").select("id, name").in("id", hubIds) : Promise.resolve({ data: [] }),
    bizIds.length ? sb.from("local_businesses").select("id, name").in("id", bizIds) : Promise.resolve({ data: [] }),
  ]);
  const hubs = new Map(((h.data ?? []) as { id: string; name: string }[]).map((x) => [x.id, x.name])), biz = new Map(((b.data ?? []) as { id: string; name: string }[]).map((x) => [x.id, x.name]));
  const flags = await reservedFlags();
  return { error: null, rows: r.rows.map((o) => ({ ...o, reserved_name_flag: flags.get(o.id) ?? false, parent_kind: o.hub_id ? "hub" : o.business_id ? "business" : null, parent_name: o.hub_id ? hubs.get(o.hub_id) ?? null : o.business_id ? biz.get(o.business_id) ?? null : null })) };
};

/** { waiting, changes } for the tab labels and the sidebar. A refused or missing function reads as zero. */
export async function reviewCounts(): Promise<{ waiting: number; changes: number }> {
  try {
    const { data } = await (await createClient()).rpc("admin_edition_review_counts");
    const d = (data ?? {}) as { waiting?: number; changes?: number };
    return { waiting: Number(d.waiting) || 0, changes: Number(d.changes) || 0 };
  } catch { return { waiting: 0, changes: 0 }; }
}

export type OrderRow = { order_id: string; package_name: string | null; status: string; amount_pence: number; refunded_pence: number; free: boolean; created_at: string; paid_at: string | null; buyer_name: string | null };
export type RefundRow = { request_id: string; amount_pence: number; reason: string; status: "pending" | "submitted" | "done" | "failed"; attempts: number; last_error: string | null; created_at: string; resolved_at: string | null };
/** A package order list for one Edition, with each order's refund requests (administrator only; the database refuses anyone else). */
export async function editionOrders(editionId: string): Promise<{ rows: (OrderRow & { refunds: RefundRow[] })[]; error?: string }> {
  try {
    const sb = await createClient();
    const { data, error } = await sb.rpc("admin_edition_orders", { p_edition: editionId });
    if (error) return { rows: [], error: "Orders could not be loaded." };
    const orders = (data ?? []) as OrderRow[];
    const refunds = await Promise.all(orders.map(async (o) => ((await sb.rpc("admin_edition_order_refunds", { p_order: o.order_id })).data ?? []) as RefundRow[]));
    return { rows: orders.map((o, i) => ({ ...o, refunds: refunds[i] })) };
  } catch { return { rows: [], error: "Orders could not be loaded." }; }
}

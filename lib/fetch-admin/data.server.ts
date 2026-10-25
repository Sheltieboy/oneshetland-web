/**
 * data.server.ts — the Fetch operations console's reads (SERVER-ONLY). Every function checks the caller is an administrator here,
 * and the database checks again (fetch_v2_admin_* raise for anyone else). Reads only: nothing in this file writes.
 * Driver verification records come through fetch-v2-admin (drivers area), because those functions are service-only.
 */
import { requireAdmin } from "@/lib/admin-data.server";
import { createClient } from "@/lib/supabase/server";
import { callFetchAdmin } from "@/lib/fetch-admin/edge.server";

export type Loaded<T> = { ok: true; data: T } | { ok: false; error: string };
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Json = Record<string, any>;

async function rpc(fn: string, args?: Record<string, unknown>): Promise<Loaded<Json>> {
  await requireAdmin();
  const sb = await createClient();
  const { data, error } = await sb.rpc(fn, args);
  if (error) { console.error(`[fetch-admin] ${fn} failed:`, error.message); return { ok: false, error: "This could not be loaded. Refresh to try again." }; }
  const d = data as Json;
  if (d?.ok === false) return { ok: false, error: d.code === "not_found" ? "Not found." : "This could not be loaded." };
  return { ok: true, data: d };
}

export const getFetchQueues = () => rpc("fetch_v2_admin_queues");
export const getFetchJobs = (filters: Record<string, string | boolean>) => rpc("fetch_v2_admin_jobs", { p_filters: filters });
export const getFetchJob = (id: string) => rpc("fetch_v2_admin_job", { p_request: id });
export const getFetchMember = (id: string) => rpc("fetch_v2_admin_member", { p_member: id });

export async function getDriverRecord(driverId: string): Promise<Loaded<Json>> {
  await requireAdmin();
  const r = await callFetchAdmin({ area: "drivers", action: "driver_record", driver_id: driverId });
  return r.ok ? { ok: true, data: r.body } : { ok: false, error: r.error };
}

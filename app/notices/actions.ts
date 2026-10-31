"use server";

/**
 * Server actions for Notices & Alerts. Every call runs on the signed-in user's own Supabase session (lib/supabase/server), so the database
 * authorises it; there is deliberately no service-role client here. Results are { ok, data | error } - a refusal is shown to the person, never swallowed.
 */
import { createClient } from "@/lib/supabase/server";
import { callNotifyAudience, type RpcResult } from "@/lib/notices-rpc";
import { approveFuneral, enableImportSource, revokeEssential, runRead, runWrite } from "@/lib/notices-actions-core";

const sessionClient = () => createClient();

/** One allow-listed write (see WRITE_RPCS). The browser can only name an action the list allows, with only its own parameters. */
export async function noticeWrite(fn: string, args: Record<string, unknown>): Promise<RpcResult> {
  return runWrite(await sessionClient(), fn, args ?? {});
}
export async function noticeRead(fn: string, args: Record<string, unknown>): Promise<RpcResult> {
  return runRead(await sessionClient(), fn, args ?? {});
}
export async function revokeEssentialAlert(publisher: string, reason: string): Promise<RpcResult> {
  return revokeEssential(await sessionClient(), publisher, reason);
}
export async function approveFuneralNotice(id: string, method: string, note: string): Promise<RpcResult> {
  return approveFuneral(await sessionClient(), id, method, note);
}
export async function enableNoticeImportSource(id: string, note: string): Promise<RpcResult> {
  return enableImportSource(await sessionClient(), id, note);
}

/** A SEPARATE, explicit, once-only request to notify opted-in members (edge function notify-notice-audience; not deployed yet). */
export async function notifyNoticeAudience(noticeId: string, kind: "essential" | "official"): Promise<RpcResult<{ message: string }>> {
  const sb = await sessionClient();
  const { data: { session } } = await sb.auth.getSession();
  return callNotifyAudience({ baseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "", accessToken: session?.access_token, noticeId, kind });
}

/**
 * edge.server.ts — the one way the console reaches fetch-v2-admin (SERVER-ONLY). The signed-in administrator's own session is
 * sent; the edge function checks they are an administrator and the database records every change as theirs. The answer is the
 * server's — never assumed.
 */
import { createClient } from "@/lib/supabase/server";
import { describeCode } from "@/lib/fetch-admin/actions";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Json = Record<string, any>;
export type EdgeResult = { ok: true; body: Json } | { ok: false; error: string; code?: string };

export async function callFetchAdmin(body: Record<string, unknown>): Promise<EdgeResult> {
  const sb = await createClient();
  const { data: { session } } = await sb.auth.getSession();
  if (!session) return { ok: false, error: "Please sign in again." };
  const { data, error } = await sb.functions.invoke("fetch-v2-admin", {
    headers: { Authorization: `Bearer ${session.access_token}` }, body,
  });
  if (error) {
    // A refusal arrives as a non-2xx answer whose body carries the server's code.
    let code: string | undefined;
    try { const ctx = (error as { context?: Response }).context; if (ctx && typeof ctx.json === "function") code = ((await ctx.json()) as Json)?.code; } catch { /* keep generic */ }
    return { ok: false, error: code ? describeCode(code) : "The server could not be reached. Nothing was confirmed; refresh to check.", code };
  }
  const d = data as Json | null;
  if (!d || d.ok === false) return { ok: false, error: describeCode(d?.code), code: d?.code };
  return { ok: true, body: d };
}

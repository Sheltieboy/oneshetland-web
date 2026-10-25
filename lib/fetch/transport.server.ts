/**
 * transport.server.ts — the server-side transport for lib/fetch-api.ts (SERVER-ONLY). The signed-in member's own session is used for
 * every call, so the database and the edge functions see who is asking. A refusal from an edge function arrives as a non-2xx answer;
 * its body carries the stable code, which is passed on.
 */
import { createClient } from "@/lib/supabase/server";
import { FetchApi, type FetchTransport } from "@/lib/fetch-api";

export async function fetchApi(): Promise<FetchApi> {
  const sb = await createClient();
  const transport: FetchTransport = {
    rpc: async (fn, args) => { const { data, error } = await sb.rpc(fn, args); return { data, error }; },
    invoke: async (fn, body) => {
      const { data: { session } } = await sb.auth.getSession();
      if (!session) return { data: null, error: { code: "unauthorised" } };
      const { data, error } = await sb.functions.invoke(fn, { headers: { Authorization: `Bearer ${session.access_token}` }, body });
      if (!error) return { data, error: null };
      let code: string | undefined;
      try { const ctx = (error as { context?: Response }).context; if (ctx && typeof ctx.json === "function") code = ((await ctx.json()) as { code?: string })?.code; } catch { /* keep generic */ }
      return { data: null, error: { code: code ?? "server_error" } };
    },
    read: async (table, columns, filter) => {
      let q = sb.from(table).select(columns);
      if (filter) q = q.eq(filter.column, filter.value);
      const { data, error } = await q;
      return { data, error };
    },
  };
  return new FetchApi(transport);
}

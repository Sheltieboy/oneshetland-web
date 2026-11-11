import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { Deps } from "./app-handoff.ts";
import { callEdge } from "./app-handoff.ts";

/** Real dependencies for /app-handoff. The edge function holds the service-role key; this server holds only a shared secret that lets it ask. Missing configuration = every request refused. */
export function handoffDeps(origin: string): Deps {
  const cfg = { url: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "", anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "", secret: process.env.HANDOFF_WEB_SECRET ?? "" };
  return {
    origin,
    secureCookies: process.env.NODE_ENV === "production",
    edge: (action, code, ip) => callEdge(cfg, action, code, ip),
    currentEmail: async () => (await (await createClient()).auth.getUser()).data.user?.email ?? null,
    exchange: async (tokenHash) => {
      // The normal server-side client sets the session cookies exactly as a normal sign-in does. No token is ever in a URL.
      const sb = await createClient();
      const { data, error } = await sb.auth.verifyOtp({ type: "magiclink", token_hash: tokenHash });
      return error ? null : data.user?.id ?? null;
    },
    signOut: async () => { await (await createClient()).auth.signOut(); },
  };
}

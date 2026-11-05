import { publicClient } from "./supabase/public.ts";
import { resilient } from "./home-resilience.ts";
import { cleanQuery, parseHits, type SearchHit } from "./search.ts";

/**
 * Server-side search core. One RPC (public.search_site) for every source; bounded and briefly kept so a slow database cannot hold up the
 * site and repeated popular searches cost nothing. Only PUBLIC data goes through here (the RPC is invoker-rights, anon only).
 *   fresh copy: 30 s; deadline: 2.5 s; a stale copy up to 5 min is served if the database is slow or failing.
 * A failure is reported as { ok:false } — never as "no results".
 */
export type SearchOutcome = { ok: true; hits: SearchHit[] } | { ok: false };
type Rpc = (q: string, limit: number) => Promise<unknown>;

const defaultRpc: Rpc = async (q, limit) => {
  const { data, error } = await publicClient().rpc("search_site", { p_q: q, p_limit: limit });
  if (error) throw new Error(error.message);
  return data;
};

export async function searchSite(raw: unknown, limit: number, rpc: Rpc = defaultRpc, deadlineMs = 2500): Promise<SearchOutcome> {
  const q = cleanQuery(raw);
  if (!q) return { ok: true, hits: [] };
  const key = `search:${limit}:${q.toLowerCase()}`;
  const r = await resilient<SearchHit[] | null>(key, { ttlMs: 30_000, staleMs: 5 * 60_000, deadlineMs, fallback: null, isEmpty: () => false },
    async () => parseHits(await rpc(q, limit)));
  return r ? { ok: true, hits: r } : { ok: false };
}

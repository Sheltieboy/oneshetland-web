/**
 * Fire-and-forget promotion counters from the browser. Calls the public database function directly with the anon key and `keepalive`, so a tap that starts a page
 * navigation is still delivered. It never throws, never blocks, and never reports an error to the visitor: the counts are indicative only.
 */
import { trackPayload, type PromoMetric, type PromoSurface } from "./promo-public";

export function trackPromo(editionId: string, surface: PromoSurface, metric: PromoMetric): void {
  try {
    const body = trackPayload(editionId, surface, metric);
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL, key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!body || !url || !key || typeof fetch !== "function") return;
    void fetch(`${url}/rest/v1/rpc/edition_promo_track`, {
      method: "POST", keepalive: true, credentials: "omit",
      headers: { "Content-Type": "application/json", apikey: key, Authorization: `Bearer ${key}` },
      body: JSON.stringify(body),
    }).catch(() => undefined);
  } catch { /* swallowed on purpose */ }
}

import { publicClient } from "@/lib/supabase/public";
import { DISCOVERY_ROW_CAP, FEATURED_KIND, HOME_STRIP_CAP, parseFeatured, type FeaturedEdition } from "./promo-public";

/**
 * The featured Editions for a surface. Anonymous and uncached on purpose: the database counts one 'shown' per row per call, and it already rotates the order daily.
 * A slow or failed call, Editions being off, or no booking all give an empty list so the surface collapses; this never throws.
 */
export async function getFeaturedEditions(surface: "home" | "discovery", deadlineMs = 2500): Promise<FeaturedEdition[]> {
  const cap = surface === "home" ? HOME_STRIP_CAP : DISCOVERY_ROW_CAP;
  try {
    const call = Promise.resolve(publicClient().rpc("edition_featured", { p_kind: FEATURED_KIND[surface] })).then((r: { data: unknown; error: unknown }) => (r.error ? [] : parseFeatured(r.data, cap)));
    const timeout = new Promise<FeaturedEdition[]>((res) => setTimeout(() => res([]), deadlineMs));
    return await Promise.race([call, timeout]);
  } catch { return []; }
}

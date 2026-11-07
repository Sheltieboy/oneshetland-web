/**
 * launch50.ts — server-side reads for OneShetland Launch 50. Every read is tolerant: a failed RPC or table read means "closed" / "nothing",
 * never an error page.
 */
import { createClient } from "@/lib/supabase/server";
import { LAUNCH50_CLOSED, type Launch50Place, type Launch50Status, type ShowcaseMember } from "./launch50-core.ts";

function toStatus(raw: unknown): Launch50Status {
  const r = raw as Partial<Launch50Status> | null;
  if (!r || (r.phase !== "closed" && r.phase !== "claimed_only" && r.phase !== "open")) return LAUNCH50_CLOSED;
  return {
    phase: r.phase,
    places_total: typeof r.places_total === "number" ? r.places_total : 50,
    places_left: typeof r.places_left === "number" ? Math.max(0, r.places_left) : 0,
    opens_at: r.opens_at ?? null,
    public_opens_at: r.public_opens_at ?? null,
  };
}

export async function getLaunch50Status(): Promise<Launch50Status> {
  try {
    const sb = await createClient();
    const { data, error } = await sb.rpc("launch50_status");
    if (error) return LAUNCH50_CLOSED;
    return toStatus(data);
  } catch { return LAUNCH50_CLOSED; }
}

/** Opted-in active members, in the order the database returns (a neutral daily shuffle). Never sorted here. */
export async function getLaunch50Showcase(): Promise<ShowcaseMember[]> {
  try {
    const sb = await createClient();
    const { data, error } = await sb.rpc("launch50_showcase");
    if (error || !Array.isArray(data)) return [];
    return (data as ShowcaseMember[]).filter((m) => m && typeof m.id === "string" && typeof m.name === "string");
  } catch { return []; }
}

/** The signed-in owner's own place for one business (the table is readable by its owner only). */
export async function getMyLaunch50Place(businessId: string): Promise<Launch50Place | null> {
  try {
    const sb = await createClient();
    const { data, error } = await sb
      .from("launch50_places")
      .select("business_id, tier, status, reservation_expires_at, activated_at, discount_ends_at, showcase_opt_in")
      .eq("business_id", businessId)
      .maybeSingle();
    if (error || !data) return null;
    return data as Launch50Place;
  } catch { return null; }
}

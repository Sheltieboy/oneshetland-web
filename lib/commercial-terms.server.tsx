import { createClient } from "@/lib/supabase/server";
import { CommercialTermsAccept } from "@/components/business/CommercialTermsAccept";
import type { ManagedBusiness } from "@/lib/business-data";

/**
 * commercial-terms.server.ts — one gate, in front of every commercial screen.
 *
 * Owning a Directory listing does not make anybody a seller. The dashboard,
 * profile, opening hours, photos, jobs and shifts are all ungated; this is
 * asked for once, at the point a business first opens something that takes
 * money, bookings or commitments, and it covers every commercial feature for
 * that business rather than being asked again per screen.
 *
 * The status comes from `my_commercial_terms_status`, which derives the user
 * from auth.uid() and takes only a business id — there is no way to ask about
 * anybody else, and the arbitrary-user reader behind it is not granted to
 * clients at all.
 *
 * FAILS CLOSED. If the status cannot be read, the acceptance surface is shown
 * rather than the manager: "unknown" is never treated as "accepted". Accepting
 * again in that state is harmless, because the writer is idempotent per user,
 * business and version.
 *
 * Database enforcement of commercial WRITES is deliberately not live yet — this
 * is the journey, made clear and usable first.
 */

export type CommercialTermsStatus =
  | { known: true; accepted: boolean; version: string }
  | { known: false };

/** Has the caller accepted the current commercial terms for this business? */
export async function commercialTermsStatus(businessId: string): Promise<CommercialTermsStatus> {
  try {
    const sb = await createClient();
    const { data, error } = await sb.rpc("my_commercial_terms_status", { p_business_id: businessId });
    if (error || !data) return { known: false };
    const row = data as { accepted?: boolean; version?: string };
    if (typeof row.accepted !== "boolean") return { known: false };
    return { known: true, accepted: row.accepted, version: String(row.version ?? "") };
  } catch {
    return { known: false };
  }
}

/**
 * Call this immediately after requireBusinessOwner, before any of the screen's
 * own work:
 *
 *     const gate = await commercialTermsGate(business, "Products");
 *     if (gate) return gate;
 *
 * Returns the acceptance surface when it is needed, or null to carry on.
 */
export async function commercialTermsGate(
  business: Pick<ManagedBusiness, "id" | "name">,
  feature: string,
): Promise<React.ReactElement | null> {
  const status = await commercialTermsStatus(business.id);
  if (status.known && status.accepted) return null;
  return (
    <CommercialTermsAccept
      businessId={business.id}
      businessName={business.name}
      feature={feature}
      statusUnavailable={!status.known}
    />
  );
}

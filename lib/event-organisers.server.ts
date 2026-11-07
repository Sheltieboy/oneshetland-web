import "server-only";
/**
 * event-organisers.server.ts — the businesses and hubs the SIGNED-IN member is authorised to add events and regular activities for.
 *
 *   businesses: getMyBusinessesBasic(userId, { includeUnlisted: true })  → rows where owner_id = the member (the same person
 *               requireBusinessOwner and controls_event_entity let manage it; an unlisted business is still theirs to manage)
 *   hubs:       getMyHubs()  → active hub_members rows with role owner or committee, hub active (the same people
 *               requireHubAdmin / is_hub_admin / controls_event_entity let manage a hub)
 *
 * Nothing else is ever offered. If either loader fails the journey degrades to the independent option with a calm note; it never throws.
 */
import { getMyBusinessesBasic } from "@/lib/account-data.server";
import { getMyHubs } from "@/lib/hubs-server";
import { shapeOrganisers, type Organiser } from "@/lib/event-ownership";

export type LoadedOrganisers = { organisers: Organiser[]; failed: boolean; hubsKnown: boolean; managesHub: boolean | null };

export async function loadMyOrganisers(userId: string): Promise<LoadedOrganisers> {
  const [b, h] = await Promise.allSettled([getMyBusinessesBasic(userId, { includeUnlisted: true }), getMyHubs()]);
  const businesses = b.status === "fulfilled" ? b.value : [];
  const hubs = h.status === "fulfilled" ? h.value : [];
  const organisers = shapeOrganisers(businesses, hubs);
  const hubsKnown = h.status === "fulfilled";
  return {
    organisers,
    failed: b.status === "rejected" || h.status === "rejected",
    hubsKnown,
    managesHub: hubsKnown ? organisers.some((o) => o.kind === "hub") : null,
  };
}

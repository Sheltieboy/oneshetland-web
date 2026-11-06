/**
 * event-organiser.ts — who an event is "by", in one place.
 *
 * Pure: no Supabase client, no server-only imports, so a Client Component may use it.
 *
 * The rule (product owner, 6 Nov 2026), in this order:
 *   1. community  source = 'community_submission'      -> organiser_name; NEVER "OneShetland" (neutral "Community organiser" if the name is missing)
 *   2. business / hub  the owning entity               -> as before
 *   3. official   source = 'oneshetland'               -> "OneShetland". An EXPLICIT staff-set marker: the ONLY way an event reads as OneShetland-organised.
 *   4. named      organiser_name, no owner, source NULL -> that name (a curated listing credited to its real organiser)
 *   5. otherwise  null                                  -> no organiser claim at all.
 *
 * `is_platform_event` is deliberately NOT part of the rule. It says who OWNS the row, not who ORGANISES the event. The 120 platform-owned events that exist
 * today (a parkrun, drama groups, a venue's weekend ...) are third-party events curated by staff; they carry no source and must never read as OneShetland's.
 * A community event is stored platform-owned underneath, which is a second reason the platform flag can never decide attribution.
 *
 * Legacy rows (none of the new fields present) behave exactly as before: hub, else business, else null (no organiser card).
 * `prefer` exists only because two existing surfaces order a row that has BOTH a hub and a business differently (the page: hub first; the JSON-LD:
 * business first). The database allows exactly one owner, so this only matters for old fixtures.
 */

export type EventOrganiserKind = "business" | "hub" | "community" | "official" | "named";

export interface EventOrganiser {
  kind: EventOrganiserKind;
  name: string;
  logoUrl?: string;
  href?: string;
}

export interface OrganiserEventInput {
  hub?: { id?: string | null; name?: string | null; logo_url?: string | null } | null;
  business?: { id?: string | null; name?: string | null; logo_url?: string | null } | null;
  /** New columns — undefined until the migration reaches production. */
  is_platform_event?: boolean | null;
  source?: string | null;
  organiser_name?: string | null;
}

export const COMMUNITY_SOURCE = "community_submission";
export const OFFICIAL_NAME = "OneShetland";
export const NEUTRAL_COMMUNITY_NAME = "Community organiser";
export const OFFICIAL_SOURCE = "oneshetland";

const clean = (s: string | null | undefined): string | null => {
  const t = typeof s === "string" ? s.trim() : "";
  return t ? t : null;
};

export function eventOrganiser(
  event: OrganiserEventInput | null | undefined,
  opts: { prefer?: "hub" | "business" } = {},
): EventOrganiser | null {
  if (!event) return null;

  // 1. Community first: it is platform-owned underneath, so it must be recognised before the platform check.
  if (clean(event.source) === COMMUNITY_SOURCE) {
    return { kind: "community", name: clean(event.organiser_name) ?? NEUTRAL_COMMUNITY_NAME };
  }

  // 2. Owning entity (today's behaviour).
  const fromHub = (): EventOrganiser | null => {
    const n = clean(event.hub?.name);
    if (!n) return null;
    const o: EventOrganiser = { kind: "hub", name: n };
    const logo = clean(event.hub?.logo_url); if (logo) o.logoUrl = logo;
    const id = clean(event.hub?.id); if (id) o.href = `/hubs/${id}`;
    return o;
  };
  const fromBusiness = (): EventOrganiser | null => {
    const n = clean(event.business?.name);
    if (!n) return null;
    const o: EventOrganiser = { kind: "business", name: n };
    const logo = clean(event.business?.logo_url); if (logo) o.logoUrl = logo;
    const id = clean(event.business?.id); if (id) o.href = `/directory/${id}`;
    return o;
  };
  const owner = opts.prefer === "business" ? fromBusiness() ?? fromHub() : fromHub() ?? fromBusiness();
  if (owner) return owner;

  // 3. Official ONLY by the explicit staff marker. Platform ownership (is_platform_event) is never enough.
  if (clean(event.source) === OFFICIAL_SOURCE) return { kind: "official", name: OFFICIAL_NAME };

  // 4. A curated listing credited to its real organiser: no owner, no source, but a name.
  const named = clean(event.source) ? null : clean(event.organiser_name);
  if (named) return { kind: "named", name: named };

  // 5. No claim. This is what every platform-owned event shows today (no organiser card), and what a legacy row shows. An unrecognised source never
  //    falls through to a label.
  return null;
}

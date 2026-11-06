/**
 * event-organiser.ts — who an event is "by", in one place.
 *
 * Pure: no Supabase client, no server-only imports, so a Client Component may use it.
 *
 * The rule (product owner, 6 Nov):
 *   official   = is_platform_event AND source IS NULL           -> "OneShetland"
 *   community  = source = 'community_submission'                -> organiser_name, NEVER "OneShetland"
 *   business / hub = the owning entity, as before.
 * A community event is stored platform-owned underneath (is_platform_event = true), which is exactly why the order below matters:
 * `source` is checked BEFORE is_platform_event, so a community event can never be mistaken for an official one. A community
 * event with no usable name reads "Community organiser" — it never falls through to "OneShetland".
 *
 * Legacy rows (none of the new fields present) behave exactly as before: hub, else business, else null (no organiser card).
 * `prefer` exists only because two existing surfaces order a row that has BOTH a hub and a business differently (the page:
 * hub first; the JSON-LD: business first). The database now allows exactly one owner, so this only matters for old fixtures.
 */

export type EventOrganiserKind = "business" | "hub" | "community" | "official";

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

  // 3. Official only when explicitly flagged and carrying no source marker of any kind.
  if (event.is_platform_event === true && !clean(event.source)) {
    return { kind: "official", name: OFFICIAL_NAME };
  }
  // 4. Legacy / unowned / unknown source: no organiser, as today. An unrecognised non-null source is never "official".
  return null;
}

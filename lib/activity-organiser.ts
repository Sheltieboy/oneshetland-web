/**
 * activity-organiser.ts — who a Regular Activity is "run by", in one place. Pure: no Supabase client, no server-only imports.
 *
 * The rule (product owner, 7 Nov 2026), mirroring lib/event-organiser.ts for events:
 *   business or hub owner  -> that business's / hub's own name
 *   platform-owned, or no readable owner name -> NO organiser claim at all (null): no "OneShetland" label, no "Run by" line, no organiser section.
 * A platform-owned activity says who OWNS the row, not who RUNS the activity, so it must never read as OneShetland's.
 *
 * WHY THE NAME IS CHECKED, NOT TRUSTED: the database's regular_activities_listing() returns owner_name = coalesce(hub.name, business.name, 'OneShetland').
 * So it hands back the literal 'OneShetland' for a platform-owned activity (right kind, wrong label for the page) AND for a hub- or business-owned activity
 * whose owner row the viewer cannot read (an unlisted hub or business under row security): there the kind is 'hub'/'business' but the name is the fallback.
 * Both must show no organiser rather than a false one. (A follow-up change to the function itself would return NULL instead; this helper keeps working either way.)
 */

export type ActivityOwnerKind = "business" | "hub" | "platform";
export type ActivityOrganiser = { kind: ActivityOwnerKind; /** null = make no organiser claim */ name: string | null };

const FALLBACK = /^one\s*shetland$/i;

export function activityOrganiser(kind: unknown, name: unknown): ActivityOrganiser {
  if (kind !== "business" && kind !== "hub") return { kind: "platform", name: null };
  const t = typeof name === "string" ? name.trim().replace(/\s+/g, " ") : "";
  return { kind, name: t && !FALLBACK.test(t) ? t : null };
}

/** The line a card or tile shows under the title: the owner's name, or null for "say nothing". */
export const activityOrganiserLabel = (kind: unknown, name: unknown): string | null => activityOrganiser(kind, name).name;

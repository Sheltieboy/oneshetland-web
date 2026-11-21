/**
 * shape.ts — the vocabulary of Assisted Publishing, with no server or browser dependency so both can
 * use it and a test can read it without a database.
 *
 * Phase 1 covers two content types. The kind is carried explicitly everywhere rather than inferred,
 * because Phase 2 adds more of them and an inferred kind is the thing that breaks when it does.
 */

export type AssistedKind = "business" | "hub";

/** The Directory categories, exactly as local_businesses_category_check allows them. */
export const BUSINESS_CATEGORIES: [string, string][] = [
  ["food_drink", "Food & drink"],
  ["retail", "Retail"],
  ["services", "Services"],
  ["tourism", "Tourism"],
  ["accommodation", "Accommodation"],
  ["health_wellbeing", "Health & wellbeing"],
  ["arts_creative", "Arts & creative"],
  ["sport_fitness", "Sport & fitness"],
  ["community_voluntary", "Community & voluntary"],
  ["other", "Other"],
];

/** The Hub types, exactly as hubs_type_check allows them. */
export const HUB_TYPES: [string, string][] = [
  ["club", "Club"],
  ["sports", "Sports club"],
  ["youth", "Youth organisation"],
  ["hall", "Hall or venue"],
  ["charity", "Charity"],
  ["society", "Society"],
  ["volunteer", "Volunteer group"],
  ["arts", "Arts organisation"],
  ["community", "Community group"],
  ["other", "Other"],
];

export type DuplicateCandidate = { id: string; name: string; slug: string | null; claimed: boolean; active: boolean; how: string };

export type CreateResult =
  | { created: true; kind: AssistedKind; id: string; slug: string | null }
  | { created: false; reason: "possible_duplicate"; candidates: DuplicateCandidate[] }
  | { created: false; reason: "error"; message: string };

export type AssistedRow = {
  subject_kind: AssistedKind;
  subject_id: string;
  subject_name: string | null;
  slug: string | null;
  is_active: boolean | null;
  is_claimed: boolean | null;
  owner_name: string | null;
  requested_by_name: string | null;
  requested_by_email: string | null;
  request_note: string | null;
  created_at: string;
  created_by_name: string | null;
  contact_forgotten: boolean | null;
};

/** The one sentence that describes where a record stands. Used by the admin list and by tests. */
export function assistedState(r: Pick<AssistedRow, "is_claimed" | "is_active" | "owner_name">): string {
  if (r.is_claimed) return `Managed by its owner${r.owner_name ? ` (${r.owner_name})` : ""}`;
  return r.is_active ? "OneShetland-managed · unclaimed · visible to the public" : "OneShetland-managed · unclaimed · not published";
}

/** Where the public can see this record, if anywhere. */
export function publicPath(r: Pick<AssistedRow, "subject_kind" | "slug" | "subject_id">): string | null {
  const ref = r.slug || r.subject_id;
  if (!ref) return null;
  return r.subject_kind === "hub" ? `/hubs/${ref}` : `/directory/${ref}`;
}

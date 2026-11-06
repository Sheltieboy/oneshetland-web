/**
 * accessibility.ts — the shared vocabulary for Accessible Shetland.
 *
 * Rules the whole feature follows (they are enforced again in the database, this file only words them):
 *  - Missing information is "not provided", never "not accessible". Nothing here scores, rates or labels a place "accessible".
 *  - Every fact is a specific facility with an answer: Yes / Partly / No / Not sure, plus an optional plain-words detail.
 *  - We never ask for or show anything about a person's health or disability.
 */
export const SUBJECT_TYPES = ["business", "hub", "activity", "event"] as const;
export type SubjectType = (typeof SUBJECT_TYPES)[number];
export type FactStatus = "available" | "partial" | "not_available" | "not_known";
export type Verification = "owner_provided" | "official_source" | "independently_checked";

export const STATUS_LABEL: Record<FactStatus, string> = { available: "Yes", partial: "Partly", not_available: "No", not_known: "Not sure" };
export const STATUS_LONG: Record<FactStatus, string> = { available: "Available", partial: "Partly available", not_available: "Not available", not_known: "Not known" };
export const STATUS_ORDER: FactStatus[] = ["available", "partial", "not_available", "not_known"];

export type Facility = { key: string; label: string; hint: string };
export type FacilityGroup = { id: string; title: string; facilities: Facility[] };

export const GROUPS: FacilityGroup[] = [
  { id: "getting-in", title: "Getting in and moving around", facilities: [
    { key: "step_free_entrance", label: "Step-free entrance", hint: "A way in without steps, or only a very small threshold." },
    { key: "ramp", label: "Ramp", hint: "Mention the slope or any rail in the details if you can." },
    { key: "lift", label: "Lift", hint: "Say which floors it reaches." },
    { key: "automatic_door", label: "Automatic or push-button door", hint: "" },
    { key: "wide_doors", label: "Wide doorways", hint: "If you know the width, give it in the details." },
    { key: "level_inside", label: "Level or step-free inside", hint: "Floors without steps between areas people will use." },
    { key: "space_to_move", label: "Space to move around", hint: "Room for a wheelchair, mobility scooter or pushchair to turn." },
  ] },
  { id: "arriving", title: "Parking and arriving", facilities: [
    { key: "accessible_parking", label: "Accessible parking", hint: "Marked spaces, or how close the nearest parking is." },
    { key: "drop_off", label: "Drop-off point close to the entrance", hint: "" },
  ] },
  { id: "facilities", title: "Toilets and seating", facilities: [
    { key: "accessible_toilet", label: "Accessible toilet", hint: "" },
    { key: "changing_places", label: "Changing Places toilet", hint: "A larger toilet with a hoist and changing bench." },
    { key: "wheelchair_seating", label: "Wheelchair space or seating", hint: "" },
    { key: "seating_available", label: "Seating available", hint: "Places to sit and rest." },
  ] },
  { id: "communication", title: "Hearing, sight and communication", facilities: [
    { key: "hearing_loop", label: "Hearing loop", hint: "Say where it works, for example the counter only." },
    { key: "communication_support", label: "Communication support", hint: "For example written information, or a way to ask questions in advance." },
    { key: "large_print_or_easy_read", label: "Large print or Easy Read information", hint: "" },
    { key: "visual_support", label: "Support for people with sight loss", hint: "For example good lighting, contrast or someone who can help." },
  ] },
  { id: "sensory", title: "Quiet and sensory", facilities: [
    { key: "quiet_space", label: "Quiet space", hint: "" },
    { key: "quiet_times", label: "Quieter times", hint: "When it is usually calmer." },
    { key: "sensory_friendly", label: "Sensory-friendly options", hint: "" },
  ] },
  { id: "assistance", title: "Assistance", facilities: [
    { key: "assistance_dogs_welcome", label: "Assistance dogs welcome", hint: "" },
    { key: "staff_assistance", label: "Staff can help", hint: "Say how to ask, and whether notice helps." },
    { key: "companion_or_carer", label: "Carer or companion arrangements", hint: "For example free or reduced entry for a companion." },
    { key: "equipment_available", label: "Equipment to borrow or hire", hint: "" },
  ] },
];
export const ALL_FACILITIES = GROUPS.flatMap((g) => g.facilities);
export const FACILITY_LABEL: Record<string, string> = Object.fromEntries(ALL_FACILITIES.map((f) => [f.key, f.label]));

export const PROVENANCE_LABEL: Record<Verification, string> = {
  owner_provided: "Provided by the owner or organiser",
  official_source: "From an official source",
  independently_checked: "Independently checked",
};

export const TYPE_LABEL: Record<SubjectType, string> = { business: "Business", hub: "Hub", activity: "Regular activity", event: "Event" };
export const TYPE_NOUN: Record<SubjectType, string> = { business: "business", hub: "Hub", activity: "activity", event: "event" };

export type Fact = { facility: string; status: FactStatus; detail: string | null };
export type Profile = {
  subject_type: SubjectType; subject_id: string; published: boolean; summary: string | null; visit_tips: string | null; access_contact: string | null;
  last_confirmed_at: string | null; updated_at: string; last_editor_kind: "owner" | "staff"; verification: Verification; verification_note: string | null; verified_on: string | null;
  hidden_by_staff?: boolean; hidden_reason?: string | null;
};
export type ProfileWithFacts = Profile & { facts: Fact[] };

export function isSubjectType(v: string): v is SubjectType { return (SUBJECT_TYPES as readonly string[]).includes(v); }

/** Only facilities that have an answer worth showing, grouped, in the page's order. "Not sure" is shown quietly, never as "no". */
export function groupFacts(facts: Fact[]): { group: FacilityGroup; items: (Fact & { label: string })[] }[] {
  const by = new Map(facts.map((f) => [f.facility, f]));
  return GROUPS.map((group) => ({
    group,
    items: group.facilities.flatMap((f) => { const x = by.get(f.key); return x ? [{ ...x, label: f.label }] : []; }),
  })).filter((g) => g.items.length > 0);
}

export function hasContent(p: ProfileWithFacts | null): boolean {
  return !!p && (p.facts.length > 0 || !!p.summary?.trim() || !!p.visit_tips?.trim());
}

/** "Last updated 3 March 2026". Dates only: nobody needs the time. */
export function dateLine(iso: string | null | undefined): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "Europe/London" });
}

/** The link to a subject's public page. */
export function subjectHref(type: SubjectType, id: string, slug?: string | null): string {
  switch (type) {
    case "business": return `/directory/${slug || id}`;
    case "hub": return `/hubs/${slug || id}`;
    case "activity": return `/whats-on/regular/${slug || id}`;
    case "event": return `/whats-on/${id}`;
  }
}
export const editHref = (type: SubjectType, id: string) => `/accessible/edit/${type}/${id}`;

/** Plain-text summary of the answers someone can filter on, e.g. for a card: only things answered "Yes". */
export function highlights(facts: Fact[], max = 4): string[] {
  return ALL_FACILITIES.filter((f) => facts.some((x) => x.facility === f.key && x.status === "available")).slice(0, max).map((f) => f.label);
}

/** Filter chips on /accessible. Each maps to ONE facility answered Yes (or Partly). Never combined into an "accessible" label. */
export const FILTERS: { key: string; label: string }[] = [
  { key: "step_free_entrance", label: "Step-free entrance" },
  { key: "accessible_parking", label: "Accessible parking" },
  { key: "accessible_toilet", label: "Accessible toilet" },
  { key: "changing_places", label: "Changing Places" },
  { key: "hearing_loop", label: "Hearing loop" },
  { key: "quiet_space", label: "Quiet space" },
  { key: "assistance_dogs_welcome", label: "Assistance dogs welcome" },
  { key: "staff_assistance", label: "Staff can help" },
];

/** Where visitors can find authoritative information we do not hold. Each URL was fetched and answered on 6 Nov 2026; we link, we do not copy. */
export type Resource = { title: string; href: string; by: string; about: string };
export type ResourceSection = { id: string; title: string; blurb: string; items: Resource[] };

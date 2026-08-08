/**
 * Planner context — the vocabulary shared by the owner form, the backfill for
 * seeded places, and the planner itself.
 *
 * One definition so a chip an owner ticks is the same string the planner reads
 * and the same string Peerie Bot is shown.
 */

export type PlannerSetting = "indoor" | "outdoor" | "both";
export type PlannerBooking = "none" | "advised" | "required";

export type PlannerContext = {
  /** null = nobody has said, and the planner carries on as before. */
  planner_visitor_ready: boolean | null;
  planner_dwell_minutes: number | null;
  planner_setting: PlannerSetting | null;
  planner_good_for: string[] | null;
  planner_booking: PlannerBooking | null;
  planner_note: string | null;
};

/** Fixed list — chips can be reasoned over, free-text adjectives cannot. */
export const GOOD_FOR = [
  { key: "families",    label: "Families" },
  { key: "wet_day",     label: "A wet day" },
  { key: "quick_stop",  label: "A quick stop" },
  { key: "proper_visit",label: "A proper visit" },
  { key: "food_on_site",label: "Food on site" },
  { key: "dogs",        label: "Dogs welcome" },
  { key: "accessible",  label: "Step-free access" },
  { key: "free",        label: "Free to visit" },
  // Added by Darren while reviewing the 391 — all three describe something the
  // original list couldn't. `stay_overnight` in particular records what a hotel
  // IS without putting it in a day plan, which is why those rows stay
  // visitor_ready false.
  { key: "stay_overnight",      label: "Somewhere to stay" },
  { key: "local_shop_food_etc", label: "Local shop — food and essentials" },
  { key: "quick_food_stop",     label: "A quick bite" },
] as const;

export const GOOD_FOR_LABEL: Record<string, string> =
  Object.fromEntries(GOOD_FOR.map((g) => [g.key, g.label]));

/** The options an owner picks from — real numbers, not a free-text box. */
export const DWELL_CHOICES = [
  { minutes: 15,  label: "About 15 minutes" },
  { minutes: 30,  label: "About half an hour" },
  { minutes: 45,  label: "About 45 minutes" },
  { minutes: 60,  label: "About an hour" },
  { minutes: 90,  label: "An hour and a half" },
  { minutes: 120, label: "A couple of hours" },
  { minutes: 240, label: "Half a day" },
] as const;

export const SETTINGS: { key: PlannerSetting; label: string }[] = [
  { key: "indoor",  label: "Indoors" },
  { key: "outdoor", label: "Outdoors" },
  { key: "both",    label: "A bit of both" },
];

export const BOOKINGS: { key: PlannerBooking; label: string }[] = [
  { key: "none",     label: "Just turn up" },
  { key: "advised",  label: "Booking advised" },
  { key: "required", label: "Booking required" },
];

export const NOTE_MAX = 140;

/**
 * Defaults for the places nobody owns — brochs, lighthouses, the halls we
 * seeded from OpenStreetMap. Keyed on the `kind` the importer assigned.
 *
 * `visitorReady: false` on halls and libraries is doing real work: it keeps
 * them in the Directory, where they belong, and out of visitor plans, where
 * they don't.
 */
export const SEEDED_DEFAULTS: Record<
  string,
  { visitorReady: boolean; dwell?: number; setting?: PlannerSetting; goodFor?: string[]; note?: string }
> = {
  "Broch":                { visitorReady: true, dwell: 30, setting: "outdoor", goodFor: ["proper_visit", "free"], note: "An Iron Age broch — walk round the remains; nothing on site, so dress for the weather." },
  "Archaeological site":  { visitorReady: true, dwell: 30, setting: "outdoor", goodFor: ["proper_visit", "free"], note: "Remains in open ground. Free to wander; no facilities on site." },
  "Castle or ruin":       { visitorReady: true, dwell: 35, setting: "outdoor", goodFor: ["proper_visit", "free"], note: "Ruins you can walk around, out in the open." },
  "Lighthouse":           { visitorReady: true, dwell: 25, setting: "outdoor", goodFor: ["quick_stop", "free"], note: "A lighthouse on the coast — worth the stop for the view." },
  "Viewpoint":            { visitorReady: true, dwell: 15, setting: "outdoor", goodFor: ["quick_stop", "free"], note: "A place to pull in and look out." },
  "Museum":               { visitorReady: true, dwell: 60, setting: "indoor",  goodFor: ["wet_day", "families", "proper_visit"], note: "An indoor museum — a good shout if the weather turns." },
  "Gallery":              { visitorReady: true, dwell: 45, setting: "indoor",  goodFor: ["wet_day"] },
  "Nature reserve":       { visitorReady: true, dwell: 90, setting: "outdoor", goodFor: ["proper_visit", "dogs", "free"], note: "Open ground for walking and wildlife. Give it time." },
  "Park or garden":       { visitorReady: true, dwell: 30, setting: "outdoor", goodFor: ["families", "dogs", "free"] },
  "Historic site":        { visitorReady: true, dwell: 30, setting: "outdoor", goodFor: ["proper_visit", "free"] },
  "Attraction":           { visitorReady: true, dwell: 45, setting: "both" },
  "Memorial":             { visitorReady: true, dwell: 15, setting: "outdoor", goodFor: ["quick_stop", "free"] },
  "Arts venue":           { visitorReady: true, dwell: 60, setting: "indoor",  goodFor: ["wet_day"] },
  "Picnic spot":          { visitorReady: true, dwell: 30, setting: "outdoor", goodFor: ["families", "free"] },

  // In the Directory, out of visitor plans.
  "Community hall":       { visitorReady: false },
  "Library":              { visitorReady: false },
  "Wreck":                { visitorReady: false },
};

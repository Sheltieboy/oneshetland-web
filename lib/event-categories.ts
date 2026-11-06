/**
 * event-categories.ts — one logical category per kind of event, whatever is stored.
 *
 * WHY
 * The event forms (web and app) offer twelve categories. The 56 original events were created
 * earlier, under an older vocabulary ("Music & Gigs", "Family & Kids", "Heritage & Culture"…),
 * and the database still holds those words. The web filter chips are built from the stored values,
 * so a visitor would have seen "Music" AND "Music & Gigs" as two separate choices, and picking
 * "Music" (an exact match) hid every legacy gig. The app's chips were the static twelve, so its
 * legacy events could not be reached by any chip at all.
 *
 * Stored values are NOT rewritten (a later clean-up may do that). This module maps at read time:
 *   · normaliseCategory()  — what a stored value is called to the user
 *   · storedValuesFor()    — every stored value a chosen category must match in a query
 *   · uniqueCategories()   — chips, one per logical category
 *
 * THE MAPPING IS DERIVED FROM PRODUCTION, NOT FROM CODE
 * No legacy name appears anywhere in the code. It was read from the 56 original events (15 distinct
 * values; query recorded in the Stage 4A.5A report) and checked against the event titles, using the same
 * judgements the Stage 4A imports applied (comedy, books, drama, museum events → "Arts & Culture").
 * Two are judgement calls, both on events that have already happened:
 *   · "Charity & Community" → Community   (quiz night, coffee morning, variety concert)
 *   · "Sports & Outdoors"   → Sport       (a walking group, a parasport festival, a race, a rally)
 * An UNKNOWN value (anything not listed) is left exactly as stored: it keeps its own chip and its own
 * label rather than being silently bucketed, and nothing here throws on it.
 *
 * No imports, identical copy in both repos — see lib/event-currency.ts for why.
 */

/** The twelve categories the event forms offer (mirrors EVENT_CATEGORIES in events-data / events-api). */
export const CURRENT_EVENT_CATEGORIES = [
  "Music", "Arts & Culture", "Market", "Community", "Outdoors", "Sport",
  "Family", "Food & Drink", "Charity", "Business", "Festival", "Other",
] as const;

/**
 * Categories newly recognised as CURRENT without being on the existing event forms yet (the forms' list, above, is pinned to the
 * app by a test). "Theatre & Performing Arts" arrives with the unified Events & Activities front door; until the forms offer it,
 * it only appears as a chip when an event actually carries it. Legacy "Theatre" still reads as "Arts & Culture" (unchanged).
 */
export const ADDITIONAL_CURRENT_CATEGORIES = ["Theatre & Performing Arts"] as const;

/** LEGACY stored value → current category. Exactly the legacy values found on the original events. */
export const LEGACY_CATEGORY_MAP: Readonly<Record<string, string>> = {
  "Art & Exhibitions": "Arts & Culture",
  "Charity & Community": "Community",
  "Cinema": "Arts & Culture",
  "Comedy": "Arts & Culture",
  "Family & Kids": "Family",
  "Festivals & Celebrations": "Festival",
  "Heritage & Culture": "Arts & Culture",
  "Literature": "Arts & Culture",
  "Music & Gigs": "Music",
  "Sports & Outdoors": "Sport",
  "Theatre": "Arts & Culture",
};

const key = (s: string) => s.trim().toLowerCase();

const CURRENT_BY_KEY: Readonly<Record<string, string>> = Object.fromEntries(
  [...CURRENT_EVENT_CATEGORIES, ...ADDITIONAL_CURRENT_CATEGORIES].map((c) => [key(c), c]),
);
const LEGACY_BY_KEY: Readonly<Record<string, string>> = Object.fromEntries(
  Object.entries(LEGACY_CATEGORY_MAP).map(([legacy, current]) => [key(legacy), current]),
);

/**
 * The category a stored value belongs to, as the user should see it. null for no category
 * (missing, empty, or not a string). Matching ignores case and surrounding spaces; an unknown
 * value is returned trimmed but otherwise unchanged.
 */
export function normaliseCategory(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const t = raw.trim();
  if (!t) return null;
  return CURRENT_BY_KEY[key(t)] ?? LEGACY_BY_KEY[key(t)] ?? t;
}

/**
 * Every stored value that a query for `category` must match: the current name plus each legacy
 * name that maps to it. Accepts a legacy or current name; an unknown category matches only itself.
 * Empty array for no category (callers then apply no category filter).
 */
export function storedValuesFor(category: unknown): string[] {
  const logical = normaliseCategory(category);
  if (!logical) return [];
  const out = [logical];
  for (const [legacy, current] of Object.entries(LEGACY_CATEGORY_MAP)) {
    if (current === logical) out.push(legacy);
  }
  return out;
}

/** True when two stored values are the same logical category (a null/empty never matches). */
export function sameCategory(a: unknown, b: unknown): boolean {
  const x = normaliseCategory(a);
  return x !== null && x === normaliseCategory(b);
}

/**
 * One chip per logical category, alphabetical (the order the web chips already used). Input is the
 * stored values of whatever events are being shown; nulls and blanks are skipped.
 */
export function uniqueCategories(stored: Iterable<unknown>): string[] {
  const set = new Set<string>();
  for (const v of stored) {
    const c = normaliseCategory(v);
    if (c) set.add(c);
  }
  return [...set].sort((a, b) => a.localeCompare(b));
}

/* ══════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════
 * SHARED CONTRIBUTOR-FACING CATEGORIES (Events & Activities front door)
 *
 * One plain-language list a contributor chooses from, whatever they are adding. Each entry routes to the right editor:
 *   event    a dated thing (a show, a market, a fixture)           → the Event editor
 *   activity a regular thing (a weekly class, a club, a group)     → the Regular Activity editor
 *   ask      could be either                                       → ask ONE question (ASK_QUESTION), then route
 * These are NOT stored values. Stored values are unchanged: events.category keeps its existing words (eventLabelForCategory),
 * regular_activities.category keeps its ten slugs (activityValueForCategory). Pure; no imports.
 * ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════ */

export type CategoryRoute = "event" | "activity" | "ask";
export const SHARED_CATEGORIES = [
  { slug: "theatre_performing_arts", label: "Theatre & Performing Arts", route: "event" },
  { slug: "music_gigs", label: "Music & gigs", route: "event" },
  { slug: "festivals", label: "Festivals", route: "event" },
  { slug: "exhibitions_arts_culture", label: "Exhibitions, arts & culture", route: "event" },
  { slug: "markets_fairs", label: "Markets & fairs", route: "event" },
  { slug: "fundraising_charity", label: "Fundraising & charity", route: "event" },
  { slug: "talks_workshops", label: "Talks & one-off workshops", route: "event" },
  { slug: "community", label: "Community events", route: "event" },
  { slug: "food_drink", label: "Food & drink", route: "event" },
  { slug: "outdoors", label: "Outdoors", route: "event" },
  { slug: "heritage", label: "Heritage", route: "event" },
  { slug: "comedy_film_literature", label: "Comedy, film & books", route: "event" },
  { slug: "business", label: "Business", route: "event" },
  { slug: "fitness_exercise", label: "Fitness & exercise", route: "activity" },
  { slug: "clubs_hobbies_social", label: "Clubs, hobbies & social groups", route: "activity" },
  { slug: "kids_groups", label: "Children's groups", route: "activity" },
  { slug: "classes_learning", label: "Classes & learning", route: "activity" },
  { slug: "faith_wellbeing", label: "Faith & wellbeing", route: "activity" },
  { slug: "sport", label: "Sport", route: "ask" },
  { slug: "family", label: "Family", route: "ask" },
  { slug: "other", label: "Something else", route: "ask" },
] as const satisfies readonly { slug: string; label: string; route: CategoryRoute }[];
export type SharedCategorySlug = (typeof SHARED_CATEGORIES)[number]["slug"];

/** The one question asked when a category could be either an event or a regular activity. */
export const ASK_QUESTION = "Is this a run of specific dates, or does it repeat every week?";
export const ASK_ANSWERS = [
  { value: "dates", label: "A run of specific dates", route: "event" },
  { value: "weekly", label: "It repeats every week", route: "activity" },
] as const satisfies readonly { value: string; label: string; route: CategoryRoute }[];

const SHARED_BY_SLUG: Readonly<Record<string, (typeof SHARED_CATEGORIES)[number]>> = Object.fromEntries(SHARED_CATEGORIES.map((c) => [c.slug, c]));

export const isSharedCategory = (slug: unknown): slug is SharedCategorySlug => typeof slug === "string" && Object.hasOwn(SHARED_BY_SLUG, slug);

/** Where a chosen category goes. An unknown or missing slug is treated as "ask", the safe answer. */
export function routeForCategory(slug: unknown): CategoryRoute {
  return isSharedCategory(slug) ? SHARED_BY_SLUG[slug].route : "ask";
}

/** Where the answer to the ask-question goes; anything else is null (ask again). */
export function routeForAskAnswer(answer: unknown): "event" | "activity" | null {
  const a = ASK_ANSWERS.find((x) => x.value === answer);
  return a ? a.route : null;
}

/** The text of the single disambiguating question for an 'ask' category; null for any other category. */
export function askQuestionFor(slug: unknown): string | null {
  return routeForCategory(slug) === "ask" ? ASK_QUESTION : null;
}

/**
 * The label to store in events.category for a shared category (existing chip names wherever one fits; "Theatre & Performing Arts"
 * is the one new name). Null for the activity-only categories, which are never stored on an event.
 */
const EVENT_LABEL: Readonly<Record<string, string>> = {
  theatre_performing_arts: "Theatre & Performing Arts",
  music_gigs: "Music",
  festivals: "Festival",
  exhibitions_arts_culture: "Arts & Culture",
  markets_fairs: "Market",
  fundraising_charity: "Charity",
  talks_workshops: "Community",
  community: "Community",
  food_drink: "Food & Drink",
  outdoors: "Outdoors",
  heritage: "Arts & Culture",
  comedy_film_literature: "Arts & Culture",
  business: "Business",
  sport: "Sport",
  family: "Family",
  other: "Other",
};
export function eventLabelForCategory(slug: unknown): string | null {
  return isSharedCategory(slug) ? (EVENT_LABEL[slug] ?? null) : null;
}

/** The regular_activities.category slug (existing ten, unchanged) for a shared category; null for event-only categories. */
const ACTIVITY_VALUE: Readonly<Record<string, string>> = {
  fitness_exercise: "fitness",
  clubs_hobbies_social: "social",
  kids_groups: "kids_family",
  classes_learning: "learning",
  faith_wellbeing: "wellbeing",
  sport: "sport",
  family: "kids_family",
  other: "other",
};
export function activityValueForCategory(slug: unknown): string | null {
  return isSharedCategory(slug) ? (ACTIVITY_VALUE[slug] ?? null) : null;
}

/** Legacy / current STORED event category → shared slug. Lower-cased keys. Null, blank or unknown → "other". */
const LEGACY_TO_SHARED: Readonly<Record<string, SharedCategorySlug>> = {
  "music": "music_gigs",
  "music & gigs": "music_gigs",
  "arts & culture": "exhibitions_arts_culture",
  "art & exhibitions": "exhibitions_arts_culture",
  "family": "family",
  "family & kids": "family",
  "community": "community",
  "charity & community": "community",
  "charity": "fundraising_charity",
  "sport": "sport",
  "sports & outdoors": "sport",
  "festivals & celebrations": "festivals",
  "festival": "festivals",
  "other": "other",
  "heritage & culture": "heritage",
  "market": "markets_fairs",
  "food & drink": "food_drink",
  "comedy": "comedy_film_literature",
  "theatre": "theatre_performing_arts",
  "theatre & performing arts": "theatre_performing_arts",
  "literature": "comedy_film_literature",
  "cinema": "comedy_film_literature",
  "outdoors": "outdoors",
  "business": "business",
};
export function mapLegacyEventCategory(stored: unknown): SharedCategorySlug {
  if (typeof stored !== "string") return "other";
  return LEGACY_TO_SHARED[key(stored)] ?? "other";
}

/** The ten Regular Activity category slugs → shared slug. Unknown → "other". */
const ACTIVITY_TO_SHARED: Readonly<Record<string, SharedCategorySlug>> = {
  fitness: "fitness_exercise",
  kids_family: "kids_groups",
  social: "clubs_hobbies_social",
  arts_crafts: "clubs_hobbies_social",
  sport: "sport",
  wellbeing: "faith_wellbeing",
  music: "clubs_hobbies_social",
  learning: "classes_learning",
  faith: "faith_wellbeing",
  other: "other",
};
export function mapActivityCategory(slug: unknown): SharedCategorySlug {
  return typeof slug === "string" ? (ACTIVITY_TO_SHARED[slug] ?? "other") : "other";
}

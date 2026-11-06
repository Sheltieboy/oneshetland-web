/**
 * Shared contributor categories: routing, legacy mapping, activity mapping, exhaustiveness. Pure; no network.
 * Run: node --test --import ./tests/support/register.mjs tests/event-categories-shared.test.mjs
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  SHARED_CATEGORIES, routeForCategory, routeForAskAnswer, askQuestionFor, ASK_QUESTION, mapLegacyEventCategory, mapActivityCategory,
  eventLabelForCategory, activityValueForCategory, normaliseCategory, CURRENT_EVENT_CATEGORIES, uniqueCategories, storedValuesFor,
} from "../lib/event-categories.ts";
import { ACTIVITY_CATEGORIES } from "../lib/activities.ts";

const ROUTES = {
  theatre_performing_arts: "event", music_gigs: "event", festivals: "event", exhibitions_arts_culture: "event", markets_fairs: "event",
  fundraising_charity: "event", talks_workshops: "event", community: "event", food_drink: "event", outdoors: "event", heritage: "event",
  comedy_film_literature: "event", business: "event", fitness_exercise: "activity", clubs_hobbies_social: "activity", kids_groups: "activity",
  classes_learning: "activity", faith_wellbeing: "activity", sport: "ask", family: "ask", other: "ask",
};

describe("routing", () => {
  test("every specified slug routes as specified, and nothing else is in the list", () => {
    assert.deepEqual(Object.fromEntries(SHARED_CATEGORIES.map((c) => [c.slug, c.route])), ROUTES);
    for (const [s, r] of Object.entries(ROUTES)) assert.equal(routeForCategory(s), r);
  });
  test("every shared slug routes somewhere valid and has a label", () => {
    for (const c of SHARED_CATEGORIES) { assert.ok(["event", "activity", "ask"].includes(routeForCategory(c.slug))); assert.ok(c.label.length > 2); }
    assert.equal(new Set(SHARED_CATEGORIES.map((c) => c.slug)).size, SHARED_CATEGORIES.length);
  });
  test("unknown / missing slugs ask rather than guess", () => { for (const v of ["nope", "", null, undefined, 3, "__proto__", "constructor"]) assert.equal(routeForCategory(v), "ask"); });
  test("the one question appears only for ask categories", () => {
    assert.equal(ASK_QUESTION, "Is this a run of specific dates, or does it repeat every week?");
    for (const c of SHARED_CATEGORIES) assert.equal(askQuestionFor(c.slug), c.route === "ask" ? ASK_QUESTION : null);
  });
  test("answers route to event or activity; junk is null", () => {
    assert.equal(routeForAskAnswer("dates"), "event"); assert.equal(routeForAskAnswer("weekly"), "activity");
    for (const v of [null, "", "x", undefined]) assert.equal(routeForAskAnswer(v), null);
  });
  test("labels avoid the banned word", () => { for (const c of SHARED_CATEGORIES) assert.doesNotMatch(c.label, /\bwee\b/i); });
});

const LEGACY = {
  "Music": "music_gigs", "Music & Gigs": "music_gigs", "Arts & Culture": "exhibitions_arts_culture", "Art & Exhibitions": "exhibitions_arts_culture",
  "Family": "family", "Family & Kids": "family", "Community": "community", "Charity & Community": "community", "Charity": "fundraising_charity",
  "Sport": "sport", "Sports & Outdoors": "sport", "Festivals & Celebrations": "festivals", "Festival": "festivals", "Other": "other",
  "Heritage & Culture": "heritage", "Market": "markets_fairs", "Food & Drink": "food_drink", "Comedy": "comedy_film_literature",
  "Theatre": "theatre_performing_arts", "Literature": "comedy_film_literature", "Cinema": "comedy_film_literature",
};
describe("legacy event categories", () => {
  for (const [k, v] of Object.entries(LEGACY)) test(`${k} -> ${v}`, () => assert.equal(mapLegacyEventCategory(k), v));
  test("null / blank / unknown -> other; case and spacing ignored", () => {
    for (const v of [null, undefined, "", "  ", "Zebra", 5]) assert.equal(mapLegacyEventCategory(v), "other");
    assert.equal(mapLegacyEventCategory("  music & GIGS "), "music_gigs");
  });
  test("every current form category and the new one map to a real shared slug", () => {
    const slugs = new Set(SHARED_CATEGORIES.map((c) => c.slug));
    for (const c of [...CURRENT_EVENT_CATEGORIES, "Theatre & Performing Arts"]) assert.ok(slugs.has(mapLegacyEventCategory(c)), c);
  });
});

describe("activity categories", () => {
  const EXPECT = { fitness: "fitness_exercise", kids_family: "kids_groups", social: "clubs_hobbies_social", arts_crafts: "clubs_hobbies_social", sport: "sport", wellbeing: "faith_wellbeing", music: "clubs_hobbies_social", learning: "classes_learning", faith: "faith_wellbeing", other: "other" };
  test("all ten map as specified", () => {
    assert.deepEqual(ACTIVITY_CATEGORIES.map((c) => c.value).sort(), Object.keys(EXPECT).sort());
    for (const [k, v] of Object.entries(EXPECT)) assert.equal(mapActivityCategory(k), v);
    assert.equal(mapActivityCategory("zzz"), "other"); assert.equal(mapActivityCategory(null), "other");
  });
  test("a stored activity value survives a round trip into a valid activity category", () => {
    const valid = new Set(ACTIVITY_CATEGORIES.map((c) => c.value));
    for (const c of SHARED_CATEGORIES) { const v = activityValueForCategory(c.slug); if (c.route !== "event") assert.ok(valid.has(v), c.slug); else assert.equal(v, null); }
  });
});

describe("label stored on events.category", () => {
  test("event and ask categories have a label; activity-only categories have none", () => {
    for (const c of SHARED_CATEGORIES) assert.equal(eventLabelForCategory(c.slug) === null, c.route === "activity", c.slug);
    assert.equal(eventLabelForCategory("theatre_performing_arts"), "Theatre & Performing Arts");
    assert.equal(eventLabelForCategory("music_gigs"), "Music");
    assert.equal(eventLabelForCategory("bogus"), null);
  });
  test("every stored label is one the chips recognise (twelve existing, or the one new)", () => {
    const ok = new Set([...CURRENT_EVENT_CATEGORIES, "Theatre & Performing Arts"]);
    for (const c of SHARED_CATEGORIES) { const l = eventLabelForCategory(c.slug); if (l) assert.ok(ok.has(l), l); }
  });
});

describe("existing category behaviour is untouched", () => {
  test("normaliseCategory passes values through exactly as before", () => {
    assert.equal(normaliseCategory("Music & Gigs"), "Music"); assert.equal(normaliseCategory("Theatre"), "Arts & Culture");
    assert.equal(normaliseCategory(" zebra "), "zebra"); assert.equal(normaliseCategory(null), null); assert.equal(normaliseCategory("music"), "Music");
  });
  test("the new category is recognised, case-insensitively, and gets its own chip", () => {
    assert.equal(normaliseCategory("theatre & performing arts"), "Theatre & Performing Arts");
    assert.deepEqual(uniqueCategories(["Music", "Theatre & Performing Arts", "Theatre"]), ["Arts & Culture", "Music", "Theatre & Performing Arts"]);
    assert.deepEqual(storedValuesFor("Theatre & Performing Arts"), ["Theatre & Performing Arts"]);
  });
  test("the form's twelve are still exactly twelve", () => assert.equal(CURRENT_EVENT_CATEGORIES.length, 12));
});

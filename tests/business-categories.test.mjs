/** Business taxonomy: four new categories (health_wellbeing, arts_creative, sport_fitness, community_voluntary). */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { CATEGORIES, CATEGORY_LABEL, HEALTH_CATEGORY_NOTE } from "../lib/local-data.ts";
import { subtitleFor } from "../lib/search.ts";
import { isGetItDoneCategory } from "../lib/get-it-done-eligibility.ts";
import { catColorFor } from "../lib/business-page/tokens.ts";

const read = (p) => readFileSync(p, "utf8");
const DB_ALLOWED = ["food_drink", "retail", "services", "tourism", "accommodation", "other", "health_wellbeing", "arts_creative", "sport_fitness", "community_voluntary"];
const NEW = { health_wellbeing: "Health & Wellbeing", arts_creative: "Arts & Creative", sport_fitness: "Sport & Fitness", community_voluntary: "Community & Voluntary" };

describe("category list", () => {
  test("the website list equals what the database constraint allows (migration 20261230070000)", () => {
    assert.deepEqual(CATEGORIES.map((c) => c.key).sort(), [...DB_ALLOWED].sort());
    const mig = read("../oneshetland-events-testers/supabase/migrations/20261230070000_business_categories_health_arts_sport_community.sql");
    for (const k of DB_ALLOWED) assert.ok(mig.includes(`'${k}'`), k);
  });
  test("labels, including the four new ones; the originals are unchanged", () => {
    for (const [k, l] of Object.entries(NEW)) assert.equal(CATEGORY_LABEL[k], l);
    assert.equal(CATEGORY_LABEL.other, "Other"); assert.equal(CATEGORY_LABEL.services, "Services");
    assert.equal(CATEGORIES.at(-1).key, "other", "Other stays last");
  });
});

describe("every place that shows a category knows the new ones", () => {
  test("search subtitles use proper labels", () => {
    for (const [k, l] of Object.entries(NEW)) assert.equal(subtitleFor({ kind: "business", subtitle: k, ref: "x", title: "t", score: 1, close: false }), l);
    assert.equal(subtitleFor({ kind: "business", subtitle: "food_drink", ref: "x", title: "t", score: 1, close: false }), "Food & drink");
  });
  test("colours: distinct brand-safe values, not the unknown-category fallback", () => {
    for (const k of Object.keys(NEW)) assert.notEqual(catColorFor(k), "#4f46e5");
    for (const f of ["components/preview/v2/LocalV2.tsx", "components/preview/v2/HomeV2.tsx"]) for (const k of Object.keys(NEW)) assert.ok(read(f).includes(k), f + k);
  });
  test("forms and finder use the shared list (no private copies left)", () => {
    assert.match(read("components/business/ProfileManager.tsx"), /CATEGORIES\.map\(\(c\) => <option key=\{c\.key\}/);
    assert.ok(!/const CATEGORIES = \[/.test(read("components/business/ProfileManager.tsx")));
    assert.match(read("components/business/BusinessFinder.tsx"), /const CAT: Record<string, string> = CATEGORY_LABEL;/);
    assert.match(read("components/directory/BusinessCreateForm.tsx"), /CATEGORIES\.map/);
    assert.match(read("app/directory/page.tsx"), /CATEGORIES\.map\(\(c\) => chip\(/);
  });
  test("Get it done invitations are unchanged: only services and other", () => {
    for (const k of Object.keys(NEW)) assert.equal(isGetItDoneCategory(k), false);
    assert.equal(isGetItDoneCategory("services"), true); assert.equal(isGetItDoneCategory("other"), true);
  });
});

describe("health wording", () => {
  test("a clear non-endorsement note is shown where Health & Wellbeing is chosen, and no label claims verification", () => {
    assert.match(HEALTH_CATEGORY_NOTE, /does not mean OneShetland has checked, verified or endorsed/);
    for (const f of ["components/business/ProfileManager.tsx", "components/directory/BusinessCreateForm.tsx"]) assert.match(read(f), /HEALTH_CATEGORY_NOTE/);
    for (const l of Object.values(NEW)) assert.ok(!/verified|certified|clinical|medical|approved/i.test(l));
  });
});

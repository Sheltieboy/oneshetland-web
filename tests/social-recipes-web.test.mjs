/**
 * Social Studio recipe expansion (web): short-link destinations, the Recipes screen controls, and the essential-alert approval lock.
 * No network, no database. Run: node --test tests/social-recipes-web.test.mjs
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { socialDestination } from "../lib/social-links.ts";
import { KIND_META, kindMeta, recipeSchedule } from "../lib/social-meta.ts";

const read = (p) => readFileSync(new URL("../" + p, import.meta.url), "utf8");
const UUID = "1b4e28ba-2fa1-11d2-883f-0016d3cca427";

describe("/go links for the newer recipes", () => {
  test("each recipe's link lands on the right page", () => {
    assert.deepEqual(socialDestination(["notice", UUID]), { path: `/notices/${UUID}`, campaign: "notice_update", objectType: "notice", objectId: UUID });
    assert.equal(socialDestination(["memory", UUID]).path, `/memories/${UUID}`);
    assert.equal(socialDestination(["business", UUID]).path, `/directory/${UUID}`);
    assert.equal(socialDestination(["hub", UUID]).path, `/hubs/${UUID}`);
    assert.equal(socialDestination(["games", "guess-da-wird"]).path, "/games/guess-da-wird");
    assert.equal(socialDestination(["cruise", "2026-11-12"]).path, "/cruise/2026-11-12");
  });
  test("nothing unsafe is ever spliced into a redirect path", () => {
    for (const bad of [["notice", "../admin"], ["notice", "a/b"], ["hub", "x?y=1"], ["memory", "%2e%2e"], ["notice", ""], ["business", "a".repeat(80)], ["notice", "//evil.example"]]) assert.equal(socialDestination(bad), null, JSON.stringify(bad));
    assert.equal(socialDestination(["games", "not-a-game"]), null);
    assert.equal(socialDestination(["games", "../admin"]), null);
    assert.equal(socialDestination(["cruise", "tomorrow"]), null);
    assert.equal(socialDestination(["cruise", "2026-11-12/../x"]), null);
  });
  test("existing links are untouched: spik, whats-on, jobs, event, product are still handled by the original branches", () => {
    const route = read("app/go/[...slug]/route.ts");
    for (const m of ['spik: { path: "/spik"', '"whats-on": { path: "/whats-on"', 'jobs: { path: "/jobs"', 'head === "event" && id', 'head === "product" && id']) assert.ok(route.includes(m), m);
    assert.equal(socialDestination(["spik"]), null); assert.equal(socialDestination(["event", UUID]), null); assert.equal(socialDestination(["product", UUID]), null);
  });
  test("the route module exports only handlers (Next requires it) and keeps the click log + utm redirect", () => {
    const route = read("app/go/[...slug]/route.ts");
    assert.deepEqual([...route.matchAll(/^export (?:async )?(?:function|const) (\w+)/gm)].map((m) => m[1]), ["dynamic", "GET"]);
    assert.match(route, /social_link_clicked/); assert.match(route, /utm_source", "facebook"/);
  });
});

describe("Recipes screen", () => {
  const studio = read("components/admin/SocialStudio.tsx");
  const actions = read("lib/social-actions.ts");
  test("every new kind has a label and colour", () => {
    for (const k of ["notice_update", "essential_alert", "aald_memory", "business_spotlight", "hub_community", "game_challenge", "cruise_visit"]) { assert.ok(KIND_META[k], k); assert.notEqual(kindMeta(k).label, "Custom", k); }
  });
  test("schedule summary is built from the recipe's own config", () => {
    assert.equal(recipeSchedule({ weekdays: ["Mon", "Wed", "Sat"], hour: 19 }), "Mon, Wed, Sat · about 19:00");
    assert.equal(recipeSchedule({ hour: 8 }), "about 08:00");
    assert.equal(recipeSchedule({}), "");
  });
  test("essential alert: the Autopilot switch is locked in the UI", () => {
    assert.match(studio, /ALWAYS_APPROVE = new Set\(\["essential_alert"\]\)/);
    assert.match(studio, /disabled=\{pendingAutopilot \|\| !enabled \|\| locked\}/);
    assert.match(studio, /autopilot is locked off for alerts/);
  });
  test("…and refused by the server action before any write", () => {
    const fn = actions.slice(actions.indexOf("export async function toggleSocialRecipeAutopilot"));
    assert.ok(fn.indexOf('key === "essential_alert" && autopilot') < fn.indexOf('.update({ autopilot })'));
    assert.match(fn, /always need your approval/);
  });
  test("other recipes keep the existing Enabled and Autopilot switches unchanged", () => {
    assert.match(studio, /label="Enabled"/); assert.match(studio, /toggleSocialRecipe\(recipe\.key, next\)/); assert.match(studio, /toggleSocialRecipeAutopilot\(recipe\.key, next\)/);
  });
  test("the queue tells the admin these posts are re-checked at the moment of posting", () => {
    assert.match(studio, /checked again at the moment of posting/i); assert.match(studio, /only you can approve it/);
  });
  test("approving, skipping and the publishing pause are unchanged", () => {
    assert.match(actions, /status: "approved", error: null/); assert.match(actions, /social\.publishing_paused/);
  });
});

/**
 * Directory tiers: featured, then owner-managed, then unclaimed — and the old order inside each tier.
 * Run: node --test tests/directory-rank.test.mjs
 * The tier itself is computed in the database (supabase/tests/directory-rank.node.test.ts proves it against both ownership
 * routes, inactive/hidden rows and RLS); this file proves the web asks for it everywhere the Directory is ranked.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { compareDirectory, DIRECTORY_RANK_COL } from "../lib/directory-rank.ts";

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
const b = (name, directory_rank, is_verified = false) => ({ name, directory_rank, is_verified });
const names = (rows) => rows.map((r) => r.name).join(",");

test("three tiers: featured, then owner-managed, then unclaimed", () => {
  const rows = [b("Unclaimed", 2), b("Owner", 1), b("Featured", 0)];
  assert.equal(names([...rows].sort(compareDirectory)), "Featured,Owner,Unclaimed");
});

test("both ownership routes share tier 1 and keep the existing order inside it (verified first, then name)", () => {
  const rows = [b("Zed claimed", 1), b("Amy created by owner", 1), b("Mid claimed verified", 1, true), b("Top unclaimed verified", 2, true)];
  assert.equal(names([...rows].sort(compareDirectory)), "Mid claimed verified,Amy created by owner,Zed claimed,Top unclaimed verified");
});

test("a verified unclaimed listing does not jump above an unverified owner-managed one (tier beats verified)", () => {
  assert.equal(names([b("V unclaimed", 2, true), b("plain owner", 1)].sort(compareDirectory)), "plain owner,V unclaimed");
});

test("a row with no tier is treated as unclaimed, never as featured", () => {
  assert.equal(names([b("No tier", undefined), b("Owner", 1)].sort(compareDirectory)), "Owner,No tier");
});

test("within a tier the order is exactly what it was: verified first, then name", () => {
  const rows = [b("b", 2), b("a", 2, true), b("c", 2, true), b("A", 2)];
  assert.equal(names([...rows].sort(compareDirectory)), "a,c,A,b");
});

// ── the web asks the database for the tier on EVERY Directory read (main list, category, filters, search all go through it)

const section = (src, name) => { const i = src.indexOf(`export async function ${name}`); assert.ok(i >= 0, name); return src.slice(i, src.indexOf("\n}\n", i) + 3); };

test("getAllBusinesses orders by tier first, then verified, then name — before the row cap", () => {
  const f = section(read("lib/local-data.ts"), "getAllBusinesses");
  const order = [...f.matchAll(/\.order\(([A-Za-z_."]+)/g)].map((m) => m[1]);
  assert.deepEqual(order.slice(0, 3), ["DIRECTORY_RANK_COL", '"is_verified"', '"name"']);
  assert.ok(f.indexOf("DIRECTORY_RANK_COL") < f.indexOf(".limit(DIRECTORY_LIST_LIMIT)"), "ordered in the query, so the cut keeps the right rows");
  assert.equal(DIRECTORY_RANK_COL, "directory_rank");
});

test("category, area, bookable and search are filters on that same query, so they inherit the tier", () => {
  const f = section(read("lib/local-data.ts"), "getAllBusinesses");
  for (const filter of [/opts\.category\) q = q\.eq/, /opts\.bookableOnly\) q = q\.eq/, /opts\.area/, /opts\.q/]) assert.match(f, filter);
  assert.equal((f.match(/from\(PUBLIC_BUSINESS\)/g) ?? []).length, 2, "the main read and the tag fold-in, nothing else");
});

test("the tag fold-in merges with the same comparator and selects the tier, so merged search results stay tiered", () => {
  const f = section(read("lib/local-data.ts"), "getAllBusinesses");
  assert.match(f, /rows = rows\.sort\(compareDirectory\)/);
  assert.equal((f.match(/\$\{LIST_COLS\}, \$\{DIRECTORY_RANK_COL\}/g) ?? []).length, 2);
});

test("visibility is untouched: still active-only, still read through the public view, no new filter removed", () => {
  const f = section(read("lib/local-data.ts"), "getAllBusinesses");
  assert.equal((f.match(/\.eq\("is_active", true\)/g) ?? []).length, 2);
  assert.doesNotMatch(f, /is_active", false|owner_id|local_businesses"\)/);
});

test("the Featured row keeps its own definition and the page still excludes it from the grid (no duplicates)", () => {
  const featured = section(read("lib/local-data.ts"), "getDirectoryFeatured");
  assert.match(featured, /\.in\("subscription_tier", \["pro", "premium"\]\)/);
  assert.match(featured, /subscription_until\.is\.null,subscription_until\.gt\./);
  assert.match(read("app/directory/page.tsx"), /all\.filter\(\(b\) => !featuredIds\.has\(b\.id\)\)/);
});

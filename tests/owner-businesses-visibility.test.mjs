/**
 * An owner manages every business they own, listed or not. Run: node --test tests/owner-businesses-visibility.test.mjs
 *
 * Found in the launch-partner acceptance: a freshly claimed business is inactive until it is published, and the
 * owner lists filtered on is_active = true, so it never appeared under "Your businesses" and the owner opened the
 * wrong dashboard. Public discovery is untouched: these are owner-only reads under the owner's own session, and the
 * database (RLS) shows an owner their own inactive rows and nobody else's.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
const fn = (src, name) => { const i = src.indexOf(`export async function ${name}`); assert.ok(i >= 0, name); return src.slice(i, src.indexOf("\n}\n", i) + 3); };

test("the owner's account list includes unlisted businesses and says so", () => {
  const page = read("app/account/page.tsx");
  assert.match(page, /getMyBusinessesBasic\(account\.id, \{ includeUnlisted: true \}\)/);
  assert.match(page, /!b\.is_active &&[\s\S]{0,200}Not publicly listed/);
});

test("getMyBusinessesBasic filters on the owner, and only drops unlisted ones when not asked to include them", () => {
  const f = fn(read("lib/account-data.server.ts"), "getMyBusinessesBasic");
  assert.match(f, /\.eq\("owner_id", userId\)/);
  assert.match(f, /if \(!opts\.includeUnlisted\) q = q\.eq\("is_active", true\)/);
  assert.match(f, /is_active/);
});

test("other callers keep their old behaviour: jobs still offers only listed businesses", () => {
  assert.match(read("app/jobs/manage/page.tsx"), /getMyBusinessesBasic\(account\.id\)/);
  assert.doesNotMatch(read("app/jobs/manage/page.tsx"), /includeUnlisted/);
  assert.match(read("lib/jobs-data.server.ts"), /\.eq\("owner_id", userId\)\.eq\("is_active", true\)/);
});

test("the dashboard switcher lists every owned business and marks unlisted ones", () => {
  const f = fn(read("lib/business-data.server.ts"), "getMyManagedBusinesses");
  assert.match(f, /\.eq\("owner_id", userId\)/); assert.doesNotMatch(f, /is_active", true/);
  const page = read("app/business/[id]/manage/page.tsx");
  assert.match(page, /not listed/); assert.match(page, /Not publicly listed/);
});

test("nothing public changed: no discovery loader, view or policy was touched", () => {
  for (const f of ["lib/local-data.ts", "lib/curated-businesses.ts", "lib/shop-data.ts"]) assert.doesNotMatch(read(f), /includeUnlisted/, f);
  // an owner list must always be scoped to the owner — never an unfiltered read of local_businesses
  for (const f of ["lib/account-data.server.ts", "lib/business-data.server.ts"]) {
    for (const m of read(f).matchAll(/from\("local_businesses"\)[\s\S]{0,260}?\.order\("name"\)/g)) assert.match(m[0], /owner_id/, f);
  }
});

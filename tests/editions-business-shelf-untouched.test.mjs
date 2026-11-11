/**
 * Regression guard: the Editions strip must not touch the business shelf. The business discovery loader and the shelf's component and ordering sources are pinned to recorded
 * SHA-256 hashes (recorded 11 Nov 2026 BEFORE the strip was added), and the home page passes nothing from the strip into them. If a hash changes on purpose, re-record it
 * here in the same change and say why.
 * Run: node --test tests/editions-business-shelf-untouched.test.mjs
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const bytes = (p) => readFileSync(join(ROOT, p));
const sha = (p) => createHash("sha256").update(bytes(p)).digest("hex");

const RECORDED = {
  "lib/curated-businesses.ts": "51c110bab5b1703af6dd5015f0a14069d5a24d5d77dac13680f634600f378cf6", // business discovery loader (getBusinessShowcase: rotation, Premium reserved slots, Recently joined)
  "components/preview/v2/HomeV2.tsx": "d3e12733ae58f92f15be1d419c0eb050f17e0a29b084bc8e6d7cf26a4d3a9801", // DiscoverLocal and the rest of the home sections
  "lib/directory-rank.ts": "16f02fe535339c45d370397d5f2ec7e2b3b91bc4287f4dfd7390614a860fa59d", // directory ranking
};

for (const [file, hash] of Object.entries(RECORDED)) test(`${file} is byte-identical to the recorded hash`, () => { assert.equal(sha(file), hash); });

test("none of those files references Editions code or the strip", () => {
  for (const f of Object.keys(RECORDED)) assert.ok(!/EditionsStrip|edition_featured|lib\/editions|components\/editions/.test(bytes(f).toString("utf8")), `${f} references Editions code`);
});

test("app/page.tsx passes nothing from the strip into the business shelf", () => {
  const src = readFileSync(join(ROOT, "app/page.tsx"), "utf8");
  const shelf = /<DiscoverLocal\b[^>]*\/>/.exec(src);
  assert.ok(shelf, "DiscoverLocal is rendered");
  assert.equal(shelf[0], "<DiscoverLocal businesses={businesses.main} recent={businesses.recent} />", "the shelf still gets only the business showcase");
  assert.ok(!/editionsFeatured|EditionsStrip/.test(shelf[0]));
  // the strip's data never feeds the showcase loader, the shelf exclusion set, or "New this week"
  for (const re of [/getBusinessShowcase\([^)]*\)/, /const shelfIds[^\n]*/, /planNewThisWeek\([^)]*\)/]) { const m = re.exec(src); assert.ok(m, String(re)); assert.ok(!/editionsFeatured|getFeaturedEditions|EditionsStrip/.test(m[0]), m[0]); }
  // one read, its own variable, one render
  assert.equal((src.match(/getFeaturedEditions\(/g) ?? []).length, 1); assert.equal((src.match(/<EditionsStrip\b/g) ?? []).length, 1);
  assert.equal((src.match(/editionsFeatured/g) ?? []).length, 2); // destructured once, rendered once
});

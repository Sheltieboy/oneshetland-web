/**
 * Share/QR URLs minted by the mobile app must not 404 for people without the
 * app. Run: node --test tests/app-link-redirects.test.mjs
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import nextConfig from "../next.config.ts";

const rules = await nextConfig.redirects();
const rule = (source) => rules.find((r) => r.source === source);

test("/give/:id redirects to the hub campaign page (temporary)", () => {
  const r = rule("/give/:id");
  assert.ok(r, "missing /give/:id redirect");
  assert.equal(r.destination, "/hubs/campaign/:id");
  assert.equal(r.permanent, false);
});

test("/b/:slug redirects to the directory profile (temporary)", () => {
  const r = rule("/b/:slug");
  assert.ok(r, "missing /b/:slug redirect");
  assert.equal(r.destination, "/directory/:slug");
  assert.equal(r.permanent, false);
});

test("redirect destinations are real pages", () => {
  assert.ok(existsSync(new URL("../app/hubs/campaign/[id]/page.tsx", import.meta.url)));
  assert.ok(existsSync(new URL("../app/directory/[id]/page.tsx", import.meta.url)));
});

test("directory/[id] resolves slugs, not just UUIDs", async () => {
  const { readFile } = await import("node:fs/promises");
  const src = await readFile(new URL("../lib/local-data.ts", import.meta.url), "utf8");
  assert.match(src, /UUID\.test\(idOrSlug\) \? "id" : "slug"/);
});

test("no page route shadows the redirects", () => {
  assert.ok(!existsSync(new URL("../app/give", import.meta.url)));
  assert.ok(!existsSync(new URL("../app/b", import.meta.url)));
});

/** Run: node --test --import ./tests/support/register.mjs tests/home-new-this-week.test.mjs */
import { test } from "node:test";
import assert from "node:assert/strict";
import { planNewThisWeek, isFresh, publishedLabel, MAX_SUPPORTING } from "../lib/home-new-this-week.ts";

const NOW = Date.parse("2026-11-09T12:00:00Z");
const ago = (d) => new Date(NOW - d * 86_400_000).toISOString();
const ahead = (d) => new Date(NOW + d * 86_400_000).toISOString();
const it = (id, kind, o = {}) => ({ id, kind, title: id, meta: "", href: "/x", image: "/i.jpg", publishedAt: ago(1), usefulUntil: ahead(5), ...o });

test("only items published inside the window count; no date or a future date is never new", () => {
  assert.equal(isFresh(it("a", "event", { publishedAt: ago(6.5) }), NOW), true);
  assert.equal(isFresh(it("a", "event", { publishedAt: ago(8) }), NOW), false);
  assert.equal(isFresh(it("a", "event", { publishedAt: null }), NOW), false);
  assert.equal(isFresh(it("a", "event", { publishedAt: ahead(1) }), NOW), false);
});

test("expired content is never shown as new, however recently it was published", () => {
  assert.equal(isFresh(it("o", "offer", { usefulUntil: ago(0.1) }), NOW), false);
  assert.equal(isFresh(it("j", "job", { usefulUntil: ago(2) }), NOW), false);
  assert.equal(isFresh(it("e", "event", { usefulUntil: ahead(0.1) }), NOW), true);
});

test("ids on the paid Discover shelf are skipped and ordering ignores any tier field", () => {
  const items = [it("shelf-biz", "business", { publishedAt: ago(0.2), tier: "premium" }), it("new-biz", "business", { publishedAt: ago(2) })];
  const plan = planNewThisWeek(items, NOW, new Set(["shelf-biz"]));
  assert.equal(plan.featured.id, "new-biz");
});

test("featured is the newest with a photograph; supporting prefers different types, newest first, capped", () => {
  const items = [
    it("e1", "event", { publishedAt: ago(0.1), image: null }),
    it("e2", "event", { publishedAt: ago(0.5) }),
    it("j1", "job", { publishedAt: ago(1) }),
    it("o1", "offer", { publishedAt: ago(2) }),
    it("b1", "business", { publishedAt: ago(3) }),
    it("e3", "event", { publishedAt: ago(4) }),
  ];
  const plan = planNewThisWeek(items, NOW);
  assert.equal(plan.featured.id, "e2");
  assert.deepEqual(plan.supporting.map((i) => i.kind), ["job", "offer", "business"]);
  assert.ok(plan.supporting.length <= MAX_SUPPORTING);
});

test("a quiet week degrades: one item stands alone; none hides the section", () => {
  assert.equal(planNewThisWeek([it("only", "event")], NOW).supporting.length, 0);
  assert.equal(planNewThisWeek([it("old", "event", { publishedAt: ago(20) })], NOW), null);
  assert.equal(planNewThisWeek([], NOW), null);
});

test("labels are Today, Yesterday or a weekday", () => {
  assert.equal(publishedLabel(new Date(NOW - 3600_000).toISOString(), NOW), "Today");
  assert.equal(publishedLabel(ago(1), NOW), "Yesterday");
  assert.equal(publishedLabel(ago(3), NOW), "Fri");
});

test("the same show listed on several dates is one card (newest kept); different kinds with one title are both fine", () => {
  const items = [
    it("t1", "event", { title: "Tribute night for Willie Robertson", publishedAt: ago(1) }),
    it("t2", "event", { title: "Tribute night for Willie  Robertson!", publishedAt: ago(2) }),
    it("j1", "job", { title: "Tribute night for Willie Robertson", publishedAt: ago(3) }),
  ];
  const plan = planNewThisWeek(items, NOW);
  const all = [plan.featured, ...plan.supporting].map((i) => i.id).sort();
  assert.deepEqual(all, ["j1", "t1"]);
});

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { essentialState } from "../lib/home-essential.ts";
import { resilient, __resetHomeResilience } from "../lib/home-resilience.ts";

const card = (id) => ({ id, title: "Road closed", isEssential: true, level: 1 });

test("active essential alerts -> state 'alerts' with the alerts", () => {
  const s = essentialState({ ok: true, data: [card("a")] }, false);
  assert.equal(s.state, "alerts"); assert.equal(s.alerts.length, 1);
});
test("confirmed no active alerts -> 'none' (renders nothing)", () => {
  assert.equal(essentialState({ ok: true, data: [] }, false).state, "none");
});
test("timeout / thrown read (null) -> 'unavailable', never 'none'", () => {
  assert.equal(essentialState(null, false).state, "unavailable");
});
test("database refusal (ok:false) -> 'unavailable', never 'none'", () => {
  assert.equal(essentialState({ ok: false, error: "x" }, false).state, "unavailable");
});
test("end to end: a read that never answers is 'unavailable' within the 3 s deadline, an answering read is not", async () => {
  __resetHomeResilience();
  const slow = await resilient("e", { ttlMs: 0, staleMs: 0, deadlineMs: 40, fallback: null }, () => new Promise(() => {}));
  assert.equal(essentialState(slow, false).state, "unavailable");
  const ok = await resilient("e2", { ttlMs: 0, staleMs: 0, deadlineMs: 40, fallback: null }, async () => ({ ok: true, data: [] }));
  assert.equal(essentialState(ok, false).state, "none");
});
test("essential alerts are never kept: ttl 0 and no stale fallback; deadline 3 s", () => {
  const src = readFileSync(new URL("../lib/home-notices.ts", import.meta.url), "utf8");
  assert.match(src, /"home:essential:"[^\n]*ttlMs: 0, staleMs: 0, deadlineMs: 3000/);
});
test("the alert slot streams in its own Suspense boundary and the unavailable notice is accessible", () => {
  const page = readFileSync(new URL("../app/page.tsx", import.meta.url), "utf8");
  assert.match(page, /<Suspense fallback=\{null\}><HomeEssentialAlerts account=\{accountP\} \/><\/Suspense>/);
  const c = readFileSync(new URL("../components/notices/HomeEssentialAlerts.tsx", import.meta.url), "utf8");
  assert.match(c, /role="status"/); assert.match(c, /couldn&apos;t check for current alerts/);
  assert.doesNotMatch(c.split("export async function")[0], /9b1c1c|bg-red/); // not the red urgent styling
});

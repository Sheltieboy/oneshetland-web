import test from "node:test";
import assert from "node:assert/strict";
import { resilient, __resetHomeResilience } from "../lib/home-resilience.ts";

const O = (o = {}) => ({ ttlMs: 1000, deadlineMs: 50, staleMs: 10_000, fallback: ["FB"], ...o });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
test.beforeEach(() => __resetHomeResilience());

test("fresh copy is served without calling the loader again", async () => {
  let calls = 0; const f = async () => { calls++; return ["a"]; };
  assert.deepEqual(await resilient("k", O(), f), ["a"]);
  assert.deepEqual(await resilient("k", O(), f), ["a"]);
  assert.equal(calls, 1);
});
test("a loader that never answers cannot hold the page: fallback after the deadline", async () => {
  const t = Date.now();
  const v = await resilient("k", O(), () => new Promise(() => {}));
  assert.deepEqual(v, ["FB"]); assert.ok(Date.now() - t < 500);
});
test("a throwing loader returns the fallback, not an exception", async () => {
  assert.deepEqual(await resilient("k", O(), async () => { throw new Error("boom"); }), ["FB"]);
});
test("slow after a good copy: the stale copy is served, not the fallback", async () => {
  let n = 0; let t = 0; const now = () => t;
  await resilient("k", O(), async () => ["good"], now);
  t = 5000; // copy now expired (ttl 1s) but within stale window
  const v = await resilient("k", O(), () => new Promise(() => {}), now);
  assert.deepEqual(v, ["good"]); void n;
});
test("too-old stale copy is not served", async () => {
  let t = 0; const now = () => t;
  await resilient("k", O(), async () => ["good"], now);
  t = 60_000;
  assert.deepEqual(await resilient("k", O({ staleMs: 10_000 }), () => new Promise(() => {}), now), ["FB"]);
});
test("concurrent callers share one load", async () => {
  let calls = 0; const f = async () => { calls++; await sleep(10); return ["x"]; };
  const r = await Promise.all([resilient("k", O(), f), resilient("k", O(), f), resilient("k", O(), f)]);
  assert.equal(calls, 1); assert.deepEqual(r, [["x"], ["x"], ["x"]]);
});
test("a late result refreshes the copy for the next visitor", async () => {
  const slow = async () => { await sleep(120); return ["late"]; };
  assert.deepEqual(await resilient("k", O({ deadlineMs: 20 }), slow), ["FB"]);
  await sleep(200);
  assert.deepEqual(await resilient("k", O(), async () => ["never"]), ["late"]);
});
test("a swallowed failure (empty result) does not wipe a recent good copy", async () => {
  let t = 0; const now = () => t;
  await resilient("k", O(), async () => ["good"], now);
  t = 2000;
  assert.deepEqual(await resilient("k", O(), async () => [], now), ["good"]);
});
test("an empty result is accepted when there was no good copy or the copy is old", async () => {
  let t = 0; const now = () => t;
  assert.deepEqual(await resilient("a", O({ fallback: ["FB"] }), async () => [], now), []);
  await resilient("b", O(), async () => ["good"], now);
  t = 10 * 60_000;
  assert.deepEqual(await resilient("b", O({ staleMs: 20 * 60_000 }), async () => [], now), []);
});
test("copies expire: after the ttl the loader runs again", async () => {
  let t = 0; const now = () => t; let calls = 0;
  const f = async () => ++calls && [calls];
  await resilient("k", O(), f, now); t = 2000; await resilient("k", O(), f, now);
  assert.equal(calls, 2);
});
test("HOME_RESILIENCE=off bypasses the copy but keeps deadline + fallback", async () => {
  process.env.HOME_RESILIENCE = "off";
  try {
    let calls = 0; const f = async () => { calls++; return ["a"]; };
    await resilient("k", O(), f); await resilient("k", O(), f);
    assert.equal(calls, 2);
    assert.deepEqual(await resilient("z", O(), () => new Promise(() => {})), ["FB"]);
  } finally { delete process.env.HOME_RESILIENCE; }
});

test("a stuck load does not pin the key: the next caller starts a fresh load", async () => {
  let calls = 0;
  const f = () => (++calls === 1 ? new Promise(() => {}) : Promise.resolve(["fresh"]));
  assert.deepEqual(await resilient("k", O(), f), ["FB"]);
  assert.deepEqual(await resilient("k", O(), f), ["fresh"]);
  assert.equal(calls, 2);
});

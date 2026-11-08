/**
 * My Saved: references, keys, and the `save=<type>:<id>[:<key>]` instruction that finishes a save after sign-in. A crafted link must never change
 * anything silently, never escape the site, and never toggle a save off. Also: which ids are asked about (batches of 200), how the database's
 * replies are read, and how list rows become sections. Pure functions plus source pins for the confirmation bar. No network.
 * Run: node --test --import ./tests/support/register.mjs tests/saved-intent.test.mjs
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { safeNext, isLocalPath } from "../lib/redirect.ts";
import {
  parseSaveIntent, buildSaveIntent, withSaveIntent, signInHrefForSave, stripSaveParam, makeRef, isValidKey, sessionKey, activityRuleKey, activityExtraKey,
  eventDateKey, planFlagBatches, refsFromFlags, chunk, saveOutcome, readSavedList, sectionize, canUndoRemove, itemHref, parseSessionParam, refKey, rpcArgs, bookmarkName,
} from "../lib/saved.ts";

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
const U1 = "0b8a5a3e-6f2c-4d0a-9b57-2f1c3e4d5a61";
const U2 = "7c1d2e3f-4a5b-4c6d-8e7f-90a1b2c3d4e5";
const DAY = "2026-11-10";

test("every shape of reference round-trips through the instruction", () => {
  const cases = [
    ["job", U1, null], ["business", U1, null], ["event", U1, null], ["event", U1, U2], ["activity", U1, null],
    ["activity", U1, `rule:${U2}:${DAY}`], ["activity", U1, `extra:${U2}`],
  ];
  for (const [type, id, key] of cases) {
    const ref = makeRef(type, id, key);
    assert.ok(ref, `${type} ${key}`);
    assert.deepEqual(parseSaveIntent(buildSaveIntent(ref)), ref);
  }
  assert.equal(buildSaveIntent(makeRef("activity", U1, `rule:${U2}:${DAY}`)), `activity:${U1}:rule:${U2}:${DAY}`);
});

test("anything that is not exactly a well-formed reference is refused", () => {
  const bad = [
    null, undefined, 42, "", ":", "job", `job:`, `job:${U1}:`, `shop:${U1}`, `JOB:${U1}`, `job:not-a-uuid`, `job:${U1.toUpperCase()}`,
    `job:${U1}:${U2}`, `business:${U1}:${U2}`, `event:${U1}:rule:${U2}:${DAY}`, `event:${U1}:not-a-uuid`,
    `activity:${U1}:rule:${U2}:2026-02-30`, `activity:${U1}:rule:${U2}:${DAY}:x`, `activity:${U1}:rule:bad:${DAY}`, `activity:${U1}:extra:bad`, `activity:${U1}:other:${U2}`,
    `job:${U1} `, ` job:${U1}`, `job:${U1}\n`, `job:${U1}&save=job:${U2}`, `job:${U1}/../x`, "job:" + "a".repeat(200),
  ];
  for (const v of bad) assert.equal(parseSaveIntent(v), null, String(v));
});

test("key rules: whole items carry no key; only events and activities take one", () => {
  assert.equal(isValidKey("job", null), true); assert.equal(isValidKey("job", U2), false);
  assert.equal(isValidKey("business", U2), false);
  assert.equal(isValidKey("event", U2), true); assert.equal(isValidKey("event", "x"), false);
  assert.equal(isValidKey("activity", `rule:${U2}:${DAY}`), true); assert.equal(isValidKey("activity", U2), false);
  assert.equal(makeRef("event", "x", null), null);
});

test("session keys follow the activity notice format and use the rule's ORIGINAL date", () => {
  assert.equal(activityRuleKey(U2, DAY), `rule:${U2}:${DAY}`);
  assert.equal(activityExtraKey(U2), `extra:${U2}`);
  assert.equal(eventDateKey(U2), U2);
  assert.equal(sessionKey({ rule_id: U2, exception_id: null, occurrence_date: DAY, is_extra: false }), `rule:${U2}:${DAY}`);
  assert.equal(sessionKey({ rule_id: null, exception_id: U2, occurrence_date: null, is_extra: true }), `extra:${U2}`);
  assert.equal(sessionKey({ rule_id: U2, exception_id: U1, occurrence_date: DAY, is_extra: false }), `rule:${U2}:${DAY}`, "a moved session keeps its rule key");
  assert.equal(sessionKey({ rule_id: null, exception_id: null, occurrence_date: null }), null, "a row with nothing to key on cannot be saved on its own");
  assert.equal(sessionKey({ rule_id: U2, occurrence_date: "soon" }), null);
});

test("signed-out tap: sign-in with this page plus the instruction, using the existing /sign-in?next= convention", () => {
  const ref = makeRef("job", U1);
  const href = signInHrefForSave(`/jobs/${U1}`, ref);
  assert.ok(href.startsWith("/sign-in?next="));
  const next = new URL(href, "https://x.test").searchParams.get("next");
  assert.equal(next, `/jobs/${U1}?save=job:${U1}`);
  assert.equal(safeNext(next), next, "the existing guard accepts it unchanged");
});

test("the instruction joins an existing query, replaces an earlier one, and drops the hash", () => {
  const ref = makeRef("event", U1);
  assert.equal(withSaveIntent("/whats-on?category=Music", ref), `/whats-on?category=Music&save=event:${U1}`);
  assert.equal(withSaveIntent(`/whats-on?save=job:${U2}&category=Music`, ref), `/whats-on?category=Music&save=event:${U1}`);
  assert.equal(withSaveIntent(`/whats-on/${U1}#performances`, ref), `/whats-on/${U1}?save=event:${U1}`);
});

test("interplay with safeNext: a hostile current address is not turned into a redirect", () => {
  const ref = makeRef("job", U1);
  for (const evil of ["//evil.example/x", "/\\evil.example", "/\t/evil.example", "https://evil.example/x", "javascript:alert(1)", "/%2F/evil.example"]) {
    const href = signInHrefForSave(evil, ref);
    assert.equal(href, "/sign-in", `${JSON.stringify(evil)} falls back to a plain sign-in`);
  }
  // The instruction value itself can never smuggle anything: it only contains [a-z0-9-:] after validation.
  assert.equal(isLocalPath(`/jobs/${U1}?save=job:${U1}`), true);
  // A smuggled second parameter inside the value is refused before it is ever used.
  assert.equal(parseSaveIntent(`job:${U1}&next=//evil.example`), null);
});

test("stripping the instruction keeps everything else, and does nothing when there is none", () => {
  assert.equal(stripSaveParam(`/jobs/${U1}?save=job:${U1}`), `/jobs/${U1}`);
  assert.equal(stripSaveParam(`/whats-on?category=Music&save=event:${U1}&date=week#x`), "/whats-on?category=Music&date=week#x");
  assert.equal(stripSaveParam("/whats-on?category=Music"), "/whats-on?category=Music");
  assert.equal(stripSaveParam("/whats-on"), "/whats-on");
  assert.equal(stripSaveParam(`/a?save=1&save=2`), "/a", "repeated parameters all go");
  assert.equal(stripSaveParam(`/a?savedfoo=1&save=x`), "/a?savedfoo=1", "only the exact name");
});

test("a refresh cannot toggle a save off: the runner asks, calls save_item (idempotent), and strips the address", () => {
  const src = read("components/saved/SaveIntentRunner.tsx");
  assert.match(src, /parseSaveIntent\(raw\)/, "validated before use");
  assert.match(src, /role="region" aria-label="Save this\?"/, "the 'Save this?' bar");
  assert.match(src, /CONFIRM_BAR\.question\(TYPE_NOUN\[ref\.type\]\)/);
  assert.match(src, /await save\(ref\)/, "save_item through the provider, which never unsaves");
  assert.doesNotMatch(src, /unsave/, "the runner can never remove a save");
  assert.match(src, /window\.history\.replaceState\(/);
  assert.match(src, /function skip\(\) \{ stripFromAddress\(\)/, "'Not now' also strips");
  // Nothing is saved from an effect: the only call to save() is inside confirm(), which a button click runs.
  const effects = [...src.matchAll(/useEffect\(\(\) => \{[^}]*\}/g)].map((m) => m[0]).join("\n");
  assert.doesNotMatch(effects, /save\(/, "no automatic save");
  assert.match(src, /onClick=\{\(\) => void confirm\(\)\}/);
  // Only for a signed-in person with the feature on.
  assert.match(src, /enabled && signedIn/);
});

test("the provider mounts the runner only for signed-in people, and renders nothing at all when the feature is off", () => {
  const src = read("components/saved/SavedProvider.tsx");
  assert.match(src, /if \(!enabled\) return <Ctx\.Provider value=\{OFF\}>\{children\}<\/Ctx\.Provider>/);
  assert.match(src, /\{signedIn && <SaveIntentRunner \/>\}/);
});

test("which ids are asked about: one call per type, at most 200 ids each, only real uuids", () => {
  const ids = Array.from({ length: 450 }, (_, i) => `00000000-0000-4000-8000-${String(i).padStart(12, "0")}`);
  const pending = new Map([["event", new Set(ids)], ["job", new Set([U1, "nope"])]]);
  const plan = planFlagBatches(pending);
  assert.deepEqual(plan.map((b) => [b.type, b.ids.length]), [["event", 200], ["event", 200], ["event", 50], ["job", 1]]);
  assert.ok(plan.every((b) => b.ids.length <= 200));
  assert.deepEqual(planFlagBatches(new Map()), []);
  assert.deepEqual(chunk([1, 2, 3, 4, 5], 2), [[1, 2], [3, 4], [5]]);
  assert.equal(chunk(Array.from({ length: 401 }), 200).length, 3, "Clear past sends chunks of 200");
});

test("the answer of my_saved_flags is read defensively", () => {
  const refs = refsFromFlags("event", [{ item_id: U1, occurrence_key: null }, { item_id: U1, occurrence_key: U2 }, { item_id: "bad" }, null, { item_id: U1, occurrence_key: "x" }]);
  assert.deepEqual(refs.map(refKey), [`event|${U1}|`, `event|${U1}|${U2}`]);
  assert.deepEqual(refsFromFlags("event", null), []);
  assert.deepEqual(refsFromFlags("event", { not: "an array" }), []);
});

test("save_item / unsave_item replies: 42501 is sign-in, business outcomes are not exceptions, anything odd is a failure", () => {
  assert.equal(saveOutcome({ data: { ok: true, saved: true, already: false } }), "ok");
  assert.equal(saveOutcome({ data: { ok: true, removed: true } }), "ok");
  assert.equal(saveOutcome({ data: { ok: false, error: "LIMIT_REACHED" } }), "limit");
  assert.equal(saveOutcome({ data: { ok: false, error: "NOT_ENABLED" } }), "off");
  assert.equal(saveOutcome({ data: null, error: { code: "42501", message: "SIGN_IN_REQUIRED" } }), "signin");
  assert.equal(saveOutcome({ data: null, error: { message: "SIGN_IN_REQUIRED" } }), "signin");
  assert.equal(saveOutcome({ data: null, error: { code: "22023", message: "BAD_REQUEST" } }), "error");
  assert.equal(saveOutcome({ data: null }), "error");
  assert.equal(saveOutcome({ data: { ok: "true" } }), "error", "only a real true counts");
  assert.equal(saveOutcome({ data: { ok: false } }), "error");
});

test("the arguments sent to save_item are exactly (p_type, p_item, p_occurrence)", () => {
  assert.deepEqual(rpcArgs(makeRef("job", U1)), { p_type: "job", p_item: U1, p_occurrence: null });
  assert.deepEqual(rpcArgs(makeRef("event", U1, U2)), { p_type: "event", p_item: U1, p_occurrence: U2 });
  const prov = read("components/saved/SavedProvider.tsx");
  for (const fn of ["my_saved_flags", "save_item", "unsave_item"]) assert.ok(prov.includes(fn), fn);
  assert.match(prov, /p_type: type, p_ids: ids/);
  assert.match(read("components/saved/SavedList.tsx"), /rpc\("unsave_many", \{ p_items:/);
  assert.match(read("app/account/saved/page.tsx"), /rpc\("my_saved_list"/);
});

const row = (o) => ({ item_type: "event", item_id: U1, occurrence_key: null, saved_at: "2026-11-01T10:00:00Z", state: "upcoming", bucket: 1, sort_at: null, title: "T", place: null, starts_at: null, ends_at: null, note: null, from_snapshot: false, slug: null, parent_readable: false, ...o });

test("the list is split by the database's bucket, shadowed rows are hidden, and filters group events with activities", () => {
  const items = [
    row({ item_id: U1, bucket: 0, state: "cancelled" }), row({ item_id: U2, bucket: 1 }),
    row({ item_type: "business", bucket: 2, state: "ok" }), row({ item_type: "job", bucket: 3, state: "snapshot_expired", from_snapshot: true }),
    row({ item_type: "activity", bucket: 1, occurrence_key: `rule:${U2}:${DAY}`, shadowed: true }), row({ item_type: "activity", bucket: 1, item_id: U2 }),
  ];
  const all = sectionize(items);
  assert.deepEqual([all.comingUp.length, all.saved.length, all.past.length], [3, 1, 1], "the shadowed activity date is not shown");
  assert.deepEqual(sectionize(items, "events").comingUp.map((i) => i.item_type), ["event", "event", "activity"], "events include activities, in the database order");
  assert.equal(sectionize(items, "jobs").past.length, 1);
  assert.equal(sectionize(items, "businesses").saved.length, 1);
  assert.equal(sectionize(items, "businesses").comingUp.length, 0);
});

test("Undo is offered only where the old row can come back", () => {
  assert.equal(canUndoRemove({ from_snapshot: false, state: "upcoming" }), true);
  assert.equal(canUndoRemove({ from_snapshot: false, state: "cancelled" }), true);
  assert.equal(canUndoRemove({ from_snapshot: true, state: "snapshot_expired" }), false);
  assert.equal(canUndoRemove({ from_snapshot: false, state: "snapshot_ended" }), false);
  assert.equal(canUndoRemove({ from_snapshot: false, state: "unavailable" }), false);
});

test("a row links only to what the member can still read", () => {
  assert.equal(itemHref(row({ item_type: "job", state: "upcoming" })), `/jobs/${U1}`);
  assert.equal(itemHref(row({ item_type: "job", state: "snapshot_expired", from_snapshot: true })), null, "a snapshot never links to current details");
  assert.equal(itemHref(row({ state: "unavailable" })), null);
  assert.equal(itemHref(row({ item_type: "business", state: "ok" })), `/directory/${U1}`);
  assert.equal(itemHref(row({ occurrence_key: U2 })), `/whats-on/${U1}#performances`);
  assert.equal(itemHref(row({ occurrence_key: U2, state: "date_gone", parent_readable: true })), `/whats-on/${U1}`, "a gone date links to the event's current dates");
  assert.equal(itemHref(row({ occurrence_key: U2, state: "date_gone", parent_readable: false })), null);
  assert.equal(itemHref(row({ item_type: "activity", slug: "knitting-club", occurrence_key: `rule:${U2}:${DAY}` })), `/whats-on/regular/knitting-club?session=${DAY}`);
  assert.equal(itemHref(row({ item_type: "activity", slug: "knitting-club", occurrence_key: `rule:${U2}:${DAY}`, state: "date_gone", parent_readable: true })), "/whats-on/regular/knitting-club");
  assert.equal(itemHref(row({ item_type: "activity", slug: "../evil" })), null);
  assert.equal(itemHref(row({ item_type: "activity", slug: null })), null);
});

test("the list answer is read defensively", () => {
  assert.deepEqual(readSavedList(null), { items: [], total: 0, more: false });
  const r = readSavedList({ items: [row({}), { item_type: "shop", item_id: U1, state: "x" }, null, row({ item_id: "bad" })], total: 9, more: true });
  assert.equal(r.items.length, 1); assert.equal(r.total, 9); assert.equal(r.more, true);
});

test("?session= accepts a real date only", () => {
  assert.equal(parseSessionParam(DAY), DAY);
  assert.equal(parseSessionParam([DAY, "x"]), DAY);
  for (const v of [undefined, "", "2026-13-01", "2026-02-30", "<script>", "2026-11-10T00:00"]) assert.equal(parseSessionParam(v), null, String(v));
});

test("a bookmark is named after the item, and for one date after the date; the name does not change with the state", () => {
  assert.equal(bookmarkName("Up Helly Aa"), "Save Up Helly Aa");
  assert.equal(bookmarkName("  Pantomime ", "Saturday 6 December"), "Save Pantomime, Saturday 6 December");
});

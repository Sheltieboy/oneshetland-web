/**
 * The homepage What's On slots are ordered deterministically: featured first, then chronologically, and events that start at exactly the
 * same instant are ordered by id - never by whatever order the database happened to return rows (which changed when an extra filter was added).
 * Everything else (the seven-slot limit, featured priority, the two-per-organiser cap, one card per production) is unchanged.
 *
 * Runs over the in-memory fake in BOTH paths: the live (pre-migration) query and the post-migration one.
 * Run: node --test --import ./tests/support/register.mjs tests/home-events-order.test.mjs
 */
import { test, describe, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { setDb, setViewer } from "./support/fake-supabase.mjs";
import { getHomeData } from "../lib/home-data.ts";

const H = 3600_000;
const NOW = Date.now();
const iso = (ms) => new Date(ms).toISOString();
const ev = (id, hours, o = {}) => ({
  id, title: `T-${id}`, category: "Music", status: "published", is_hidden: false, venue: "Mareel", locality: "Lerwick",
  starts_at: iso(NOW + hours * H), ends_at: iso(NOW + hours * H + 2 * H), cover_url: null, price_text: null, has_tickets: false, is_featured: false,
  organiser_hub_id: null, organiser_business_id: null, calendar_approved: true, hub_visibility: null, business: null, hub: null, ticket_types: [], ...o,
});
const ids = (l) => l.map((e) => e.id);

function legacyGuard(_t, cols) {
  return /occurrences|organiser_name|is_dated_run/.test(cols) ? { code: "42703", message: "column events.organiser_name does not exist" } : null;
}
const legacySchema = () => { globalThis.__FAKE_SELECT_GUARD__ = legacyGuard; };
const modernSchema = () => { globalThis.__FAKE_SELECT_GUARD__ = undefined; };
beforeEach(() => { setViewer("anon"); });
afterEach(() => { globalThis.__FAKE_SELECT_GUARD__ = undefined; });

/** every one of these row orders must give the identical homepage */
function permutations(rows, limit = 24) {
  const out = []; const a = [...rows];
  const rec = (n) => { if (out.length >= limit) return; if (n <= 1) { out.push([...a]); return; } for (let i = 0; i < n; i++) { rec(n - 1); const j = n % 2 ? 0 : i; [a[n - 1], a[j]] = [a[j], a[n - 1]]; } };
  rec(a.length); return out;
}
const homeOrder = async () => ids((await getHomeData({ homepageOnly: true })).events);

for (const [label, path] of [["live (pre-migration) query", legacySchema], ["post-migration query", modernSchema]]) {
  describe(label, () => {
    beforeEach(() => path());

    test("events starting at the same instant come out in the same order whatever order the database returns them", async () => {
      const rows = [ev("d4", 10), ev("b2", 10), ev("a1", 10), ev("c3", 10), ev("z9", 12)];
      let first = null;
      for (const p of permutations(rows)) {
        setDb({ events: p });
        const got = await homeOrder();
        first ??= got;
        assert.deepEqual(got, first, `row order ${ids(p).join(",")} changed the page`);
      }
      assert.deepEqual(first, ["a1", "b2", "c3", "d4", "z9"], "same instant: by id; then later events");
    });

    test("it is chronological: earlier first, regardless of database order", async () => {
      const rows = [ev("e", 30), ev("a", 5), ev("c", 18), ev("b", 5.5), ev("d", 24)];
      for (const p of permutations(rows)) { setDb({ events: p }); assert.deepEqual(await homeOrder(), ["a", "b", "c", "d", "e"]); }
    });

    test("featured priority is unchanged: a featured later event still comes first, then chronological", async () => {
      const rows = [ev("p1", 2), ev("f2", 40, { is_featured: true }), ev("p3", 3), ev("f1", 30, { is_featured: true }), ev("f0", 30, { is_featured: true })];
      for (const p of permutations(rows)) { setDb({ events: p }); assert.deepEqual(await homeOrder(), ["f0", "f1", "f2", "p1", "p3"]); }
    });

    test("the seven-slot limit takes the SAME seven when the 7th and 8th events tie (lower id wins), whatever the database order", async () => {
      const rows = [ev("a", 1), ev("b", 2), ev("c", 3), ev("d", 4), ev("e", 5), ev("f", 6), ev("h2", 7), ev("g1", 7), ev("i", 9)];
      for (const p of permutations(rows, 40)) { setDb({ events: p }); assert.deepEqual(await homeOrder(), ["a", "b", "c", "d", "e", "f", "g1"]); }
    });

    test("nothing else changed: the same events on the page as before the tiebreak (sorted set equal to a plain chronological pick)", async () => {
      const rows = Array.from({ length: 14 }, (_, i) => ev(`id${String(i).padStart(2, "0")}`, 1 + Math.floor(i / 2)));   // pairs sharing an instant
      setDb({ events: rows });
      const got = await homeOrder();
      assert.equal(got.length, 7);
      assert.deepEqual(got, ["id00", "id01", "id02", "id03", "id04", "id05", "id06"]);
    });
  });
}

describe("post-migration only: organiser diversity and one card per production are unchanged", () => {
  beforeEach(() => modernSchema());
  test("no organiser takes more than two slots, even among events starting at the same instant", async () => {
    const rows = [ev("a1", 1, { organiser_business_id: "B" }), ev("a2", 1, { organiser_business_id: "B" }), ev("a3", 1, { organiser_business_id: "B" }), ev("c1", 1), ev("c2", 2)];
    for (const p of permutations(rows)) { setDb({ events: p }); assert.deepEqual(await homeOrder(), ["a1", "a2", "c1", "c2"]); }
  });
  test("a run appears once, dated by its next performance, in its chronological place", async () => {
    const run = { ...ev("run", 1), occurrences: [{ id: "o1", starts_at: iso(NOW - 2 * H), ends_at: iso(NOW - H), status: "scheduled" }, { id: "o2", starts_at: iso(NOW + 8 * H), ends_at: iso(NOW + 10 * H), status: "scheduled" }, { id: "o3", starts_at: iso(NOW + 30 * H), ends_at: null, status: "scheduled" }] };
    const rows = [ev("x", 5), run, ev("y", 12)];
    for (const p of permutations(rows)) { setDb({ events: p }); assert.deepEqual(await homeOrder(), ["x", "run", "y"]); }
  });
});

test("the loaders order by id as the last sort key (database side), and the in-memory selection breaks ties by event id", () => {
  const home = readFileSync(new URL("../lib/home-data.ts", import.meta.url), "utf8");
  assert.equal((home.match(/\.order\("starts_at", \{ ascending: true \}\)\s*\n\s*\.order\("id", \{ ascending: true \}\)/g) ?? []).length, 2, "both homepage queries");
  const occ = readFileSync(new URL("../lib/event-occurrences.ts", import.meta.url), "utf8");
  assert.match(occ, /a\.c\.eventId < b\.c\.eventId/);
});

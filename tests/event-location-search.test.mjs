/**
 * Where-is-it suggestions: venue ranking / dedupe, area search, address and locality to area, the auto-select + override rule,
 * loaders that fail silently, and the submission payload (typed venue unchanged; coordinates only from a record).
 * Run: node --test --import ./tests/support/register.mjs tests/event-location-search.test.mjs
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement as h } from "react";
import {
  normalise, likeTerm, shapeAreas, shapeAliases, buildAreaIndex, searchAreas, areaFromLocality, areaFromAddress, areaFromVenue, onVenuePicked,
  dedupeVenues, rankVenues, shapeBusinesses, shapeEventVenues, suggestVenues, loadAreaIndex, loadBusinessVenues, loadEventVenues,
} from "../lib/event-location-search.ts";
import { validateSubmission } from "../lib/event-submission-validate.ts";
import { blankRow } from "../lib/event-dates-builder.ts";

await import("./support/register-jsx.mjs");
const { Combobox } = await import("../components/events/Combobox.tsx");

const AREA_ROWS = [
  { id: "shetland_wide", name_display: "Shetland-wide", type: "shetland", parent_id: null, sort_order: 0 },
  { id: "north_mainland", name_display: "North Mainland", name_official: "North Mainland", type: "locality", parent_id: null, sort_order: 1 },
  { id: "central_mainland", name_display: "Central Mainland", type: "locality", parent_id: null, sort_order: 2 },
  { id: "north_isles", name_display: "Yell, Unst & Fetlar / North Isles", type: "locality", parent_id: null, sort_order: 3 },
  { id: "lerwick", name_display: "Lerwick", type: "settlement", parent_id: "central_mainland", sort_order: 4 },
  { id: "brae", name_display: "Brae", type: "settlement", parent_id: "north_mainland", sort_order: 5 },
  { id: "burra", name_display: "Burra", type: "island", parent_id: "central_mainland", sort_order: 6 },
  { id: "bressay", name_display: "Bressay", type: "island", parent_id: "central_mainland", sort_order: 7 },
  { id: "unst", name_display: "Unst", type: "island", parent_id: "north_isles", sort_order: 8 },
  { id: "hamnavoe", name_display: "Hamnavoe", type: "settlement", parent_id: "central_mainland", sort_order: 9 },
  { id: "voe", name_display: "Voe", type: "settlement", parent_id: "north_mainland", sort_order: 10 },
];
const ALIAS_ROWS = [
  { alias: "Baltasound", area_id: "unst", candidate_ids: [] },
  { alias: "Hamnavoe", area_id: null, candidate_ids: ["hamnavoe", "burra"] },     // ambiguous
  { alias: "Toon", area_id: "lerwick", candidate_ids: null },
  { alias: "The Sound", area_id: null, candidate_ids: ["lerwick", "voe"] },
  { alias: "Ghost", area_id: "nowhere", candidate_ids: [] },                       // points at nothing we offer
];
const idx = buildAreaIndex(shapeAreas(AREA_ROWS), shapeAliases(ALIAS_ROWS));

describe("areas", () => {
  test("the Shetland-wide row is never offered; parent names are resolved", () => {
    assert.ok(!idx.byId.has("shetland_wide"));
    assert.equal(idx.byId.get("brae").parentName, "North Mainland");
    assert.equal(idx.byId.get("unst").parentName, "Yell, Unst & Fetlar / North Isles");
  });
  test("empty query lists every area, alphabetically", () => {
    const all = searchAreas(idx, "");
    assert.equal(all.length, 10);
    assert.deepEqual(all.map((a) => a.name), [...all.map((a) => a.name)].sort((a, b) => a.localeCompare(b, "en-GB")));
  });
  test("island areas are findable and show their parent", () => {
    for (const [q, name] of [["unst", "Unst"], ["burr", "Burra"], ["bress", "Bressay"]]) assert.equal(searchAreas(idx, q)[0].name, name);
    assert.equal(searchAreas(idx, "unst")[0].context, "Yell, Unst & Fetlar / North Isles");
  });
  test("names rank before aliases; 'Also known as' appears only for an alias match", () => {
    const r = searchAreas(idx, "balta");
    assert.deepEqual([r[0].name, r[0].alsoKnownAs], ["Unst", "Baltasound"]);
    assert.equal(searchAreas(idx, "brae")[0].alsoKnownAs, null);
  });
  test("an ambiguous alias lists every candidate and never one guess", () => {
    const r = searchAreas(idx, "toon").map((a) => a.id);
    assert.deepEqual(r, ["lerwick"]);
    assert.deepEqual(new Set(searchAreas(idx, "Hamnavoe").map((a) => a.id)), new Set(["hamnavoe", "burra"]));
  });
  test("an alias pointing at nothing we offer is ignored", () => { assert.equal(searchAreas(idx, "ghost").length, 0); });
});

describe("locality text and address to area", () => {
  test("stored locality matches exactly, case and punctuation insensitive", () => {
    assert.equal(areaFromLocality(idx, " lerwick ").id, "lerwick");
    assert.equal(areaFromLocality(idx, "BURRA").id, "burra");
    assert.equal(areaFromLocality(idx, "Baltasound").id, "unst");     // unambiguous alias
    assert.equal(areaFromLocality(idx, "Lerwick area"), null);        // not an exact match: no guess
    assert.equal(areaFromLocality(idx, ""), null);
  });
  test("an address with exactly one area gives it", () => {
    assert.equal(areaFromAddress(idx, "Commercial Street, Lerwick, Shetland ZE1 0HX").id, "lerwick");
    assert.equal(areaFromAddress(idx, "Main St, Brae ZE2 9QJ").id, "brae");
  });
  test("two areas, no area, or an ambiguous alias give null", () => {
    assert.equal(areaFromAddress(idx, "Burra Road, Lerwick"), null);
    assert.equal(areaFromAddress(idx, "Ocean Kinetics, Gremista ZE1 0PX"), null);
    assert.equal(areaFromAddress(idx, "Old School, The Sound"), null);        // ambiguous alias: skipped, never guessed
    assert.equal(areaFromAddress(idx, "Old School, The Sound, Voe").id, "voe");
  });
  test("whole words only", () => { assert.equal(areaFromAddress(idx, "Voeside Cottage"), null); assert.equal(areaFromAddress(idx, "Voe, ZE2").id, "voe"); });
  test("a venue uses its past-event locality first, then its address", () => {
    assert.equal(areaFromVenue(idx, { locality: "Brae", address: "Lerwick" }).id, "brae");
    assert.equal(areaFromVenue(idx, { locality: null, address: "Lerwick" }).id, "lerwick");
    assert.equal(areaFromVenue(idx, { locality: "Somewhere", address: null }), null);
  });
});

describe("auto-select and override rule", () => {
  const none = { areaId: null, source: "none", legacyText: false };
  test("empty area: fill from the venue", () => assert.deepEqual(onVenuePicked(none, "brae"), { kind: "set", areaId: "brae" }));
  test("area that came from an earlier venue: replace it", () => assert.deepEqual(onVenuePicked({ areaId: "voe", source: "venue", legacyText: false }, "brae"), { kind: "set", areaId: "brae" }));
  test("area the member chose: never overwritten, the conflict is reported", () => {
    assert.deepEqual(onVenuePicked({ areaId: "voe", source: "manual", legacyText: false }, "brae"), { kind: "conflict", areaId: "brae" });
  });
  test("same area: nothing to do", () => assert.deepEqual(onVenuePicked({ areaId: "brae", source: "manual", legacyText: false }, "brae"), { kind: "keep" }));
  test("older typed text is treated as the member's own", () => assert.deepEqual(onVenuePicked({ areaId: null, source: "none", legacyText: true }, "brae"), { kind: "conflict", areaId: "brae" }));
  test("nothing derived: nothing changes", () => assert.deepEqual(onVenuePicked({ areaId: "voe", source: "manual", legacyText: false }, null), { kind: "keep" }));
});

describe("venues", () => {
  const hist = shapeEventVenues([
    { venue: "Mareel", locality: "Lerwick", lat: 60.1, lng: -1.1 }, { venue: "Mareel", locality: "Lerwick", lat: null, lng: null },
    { venue: "Mareel - Music - Cinema and Education Venue", locality: "Lerwick", lat: 60.1, lng: -1.1 },
    { venue: "Shetland Library", locality: null }, { venue: "Shetland Library", locality: "Lerwick" },
    { venue: "Hall", locality: "Brae" }, { venue: "Hall", locality: "Voe" }, { venue: "  ", locality: "Voe" }, { venue: "Brae Hall", locality: "Brae", lat: 0, lng: 0 },
  ]);
  const biz = shapeBusinesses([{ id: "1", name: "Mareel", address: "North Ness, Lerwick ZE1 0WD", lat: 60.16, lng: -1.15 }, { id: "2", name: "Shetland Library Cafe", address: "Lerwick", lat: null, lng: null }, { id: "3", name: null }]);
  test("history rows are grouped, blanks dropped, (0,0) is not a coordinate", () => {
    assert.equal(hist.filter((v) => v.name === "Mareel").length, 1);
    assert.equal(hist.find((v) => v.name === "Brae Hall").lat, null);
  });
  test("near-duplicates merge: the business wins and keeps the useful details", () => {
    const m = dedupeVenues([...biz, ...hist]).filter((v) => /^Mareel/.test(v.name));
    assert.equal(m.length, 1); assert.equal(m[0].source, "business"); assert.equal(m[0].name, "Mareel"); assert.equal(m[0].locality, "Lerwick");
  });
  test("without a business the shortest name survives, with the locality and coordinates that exist", () => {
    const m = dedupeVenues(hist).find((v) => /^Mareel/.test(v.name));
    assert.equal(m.name, "Mareel"); assert.equal(m.lat, 60.1);
    const lib = dedupeVenues(hist).filter((v) => v.name === "Shetland Library");
    assert.equal(lib.length, 1); assert.equal(lib[0].locality, "Lerwick");
  });
  test("the same generic name in two places stays two suggestions", () => {
    assert.equal(dedupeVenues(hist).filter((v) => v.name === "Hall").length, 2);
  });
  test("'Shetland Library Cafe' is not merged into 'Shetland Library'", () => {
    assert.equal(dedupeVenues([...biz, ...hist]).filter((v) => /^Shetland Library/.test(v.name)).length, 2);
  });
  test("ranking: exact, prefix, word, contains; minimum 2 characters; max 8", () => {
    const all = dedupeVenues([...biz, ...hist]);
    assert.deepEqual(rankVenues(all, "m"), []);
    assert.equal(rankVenues(all, "mareel")[0].name, "Mareel");
    assert.equal(rankVenues(all, "hall")[0].name, "Hall");   // the exact name beats a longer one
    const many = Array.from({ length: 20 }, (_, i) => ({ key: "k" + i, name: "Hall " + i, source: "history", context: "", address: null, locality: null, lat: null, lng: null }));
    assert.equal(rankVenues(many, "hall").length, 8);
    assert.deepEqual(rankVenues(all, "zzzz"), []);
  });
  test("suggestVenues never invents a record: every result comes from the inputs", () => {
    const names = new Set([...hist, ...biz].map((v) => v.name));
    for (const v of suggestVenues(hist, biz, "hall mareel lib")) assert.ok(names.has(v.name));
    for (const q of ["shetl", "mare", "hal"]) for (const v of suggestVenues(hist, biz, q)) assert.ok(names.has(v.name));
  });
  test("likeTerm strips wildcard and filter characters", () => { assert.equal(likeTerm("a%b_c,(d)*\\e"), "a b c d e"); });
  test("normalise", () => { assert.equal(normalise("The Café & Bar!"), "cafe and bar"); });
});

describe("loaders degrade silently", () => {
  const q = (result) => { const b = { select: () => b, eq: () => b, neq: () => b, not: () => b, order: () => b, limit: () => b, ilike: () => b, then: (ok, no) => Promise.resolve(result()).then(ok, no) }; return b; };
  const client = (fn) => ({ from: (t) => q(() => fn(t)) });
  test("network or RLS errors give empty results, never a throw", async () => {
    const bad = client(() => ({ data: null, error: { code: "42501" } }));
    assert.equal(await loadAreaIndex(bad), null);
    assert.deepEqual(await loadBusinessVenues(bad, "mareel"), []);
    assert.deepEqual(await loadEventVenues(bad), []);
    const boom = client(() => { throw new Error("offline"); });
    assert.equal(await loadAreaIndex(boom), null);
    assert.deepEqual(await loadBusinessVenues(boom, "mareel"), []);
    assert.deepEqual(await loadEventVenues(boom), []);
    assert.deepEqual(await loadBusinessVenues({ from: () => { throw new Error("x"); } }, "mareel"), []);
  });
  test("aliases failing still gives the areas", async () => {
    const c = client((t) => (t === "areas" ? { data: AREA_ROWS, error: null } : { data: null, error: { code: "x" } }));
    const i = await loadAreaIndex(c);
    assert.equal(i.areas.length, 10); assert.equal(i.aliases.length, 0);
  });
  test("under two characters there is no lookup", async () => { let called = 0; await loadBusinessVenues({ from: () => { called++; return q(() => ({ data: [] })); } }, "a"); assert.equal(called, 0); });
});

describe("submission payload", () => {
  const base = () => ({
    request_id: "11111111-1111-4111-8111-111111111111", organiser_name: "Unst Quilters", title: "Winter Fair", description: "Tea and cake for everyone.", category: "community",
    venue: "Baltasound Hall", locality: "Unst", price_text: "", contact_info: "", ticket_url: "", cover_url: null, adult_confirmed: true,
    rows: [blankRow({ date: "2099-01-10", start: "19:00", end: "21:00" })],
  });
  test("a typed venue builds exactly the old payload shape: readable text, no coordinates", () => {
    const r = validateSubmission(base(), new Date("2098-01-01T00:00:00Z"));
    assert.ok(r.ok);
    assert.equal(r.payload.venue, "Baltasound Hall"); assert.equal(r.payload.locality, "Unst");
    assert.ok(!("lat" in r.payload) && !("lng" in r.payload));
    const withNulls = validateSubmission({ ...base(), lat: null, lng: null }, new Date("2098-01-01T00:00:00Z"));
    assert.ok(withNulls.ok && !("lat" in withNulls.payload));
  });
  test("coordinates travel only as a pair, from a record", () => {
    const ok = validateSubmission({ ...base(), lat: 60.1, lng: -1.1 }, new Date("2098-01-01T00:00:00Z"));
    assert.ok(ok.ok); assert.deepEqual([ok.payload.lat, ok.payload.lng], [60.1, -1.1]);
    const half = validateSubmission({ ...base(), lat: 60.1, lng: null }, new Date("2098-01-01T00:00:00Z"));
    assert.ok(half.ok && !("lat" in half.payload));
  });
});

describe("combobox markup contract", () => {
  const html = renderToStaticMarkup(h(Combobox, { id: "x", value: "ma", onChange() {}, onSelect() {}, options: [{ id: "a", label: "Mareel" }], noun: "venue suggestions" }));
  test("input is a combobox with list popup wiring", () => {
    assert.match(html, /role="combobox"/); assert.match(html, /aria-autocomplete="list"/); assert.match(html, /aria-expanded="false"/);
    assert.match(html, /aria-controls="x-list-/); assert.match(html, /role="listbox"/); assert.match(html, /role="status"/);
  });
  test("keyboard handling and 44px option height are in the source", async () => {
    const { readFileSync } = await import("node:fs");
    const src = readFileSync(new URL("../components/events/Combobox.tsx", import.meta.url), "utf8");
    for (const k of ["ArrowDown", "ArrowUp", "Enter", "Escape"]) assert.ok(src.includes(`"${k}"`));
    assert.match(src, /min-h-11/); assert.match(src, /aria-activedescendant/);
  });
});

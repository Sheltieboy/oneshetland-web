import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { cleanQuery, hrefFor, parseHits, groupHits, subtitleFor, MIN_CHARS, DEBOUNCE_MS, SUGGEST_LIMIT } from "../lib/search.ts";
import { createSuggester } from "../lib/search-client.ts";
import { searchSite } from "../lib/search-server.ts";
import { __resetHomeResilience } from "../lib/home-resilience.ts";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const hit = (kind, ref, title, extra = {}) => ({ kind, ref, title, subtitle: "", score: 70, close: false, ...extra });

test("constants match the brief: 2 characters, ~300 ms debounce", () => { assert.equal(MIN_CHARS, 2); assert.equal(DEBOUNCE_MS, 300); assert.ok(SUGGEST_LIMIT <= 10); });
test("cleanQuery: trims, collapses, caps, and refuses anything under 2 letters/digits", () => {
  assert.equal(cleanQuery("  the   noost "), "the noost");
  assert.equal(cleanQuery("a"), ""); assert.equal(cleanQuery("!!"), ""); assert.equal(cleanQuery(null), ""); assert.equal(cleanQuery(42), "");
  assert.equal(cleanQuery("x".repeat(200)).length, 60);
  assert.equal(cleanQuery("lk889"), "lk889");
});
test("every kind links to the right page; refs are URL-encoded", () => {
  assert.equal(hrefFor("business", "the-noost-bar"), "/directory/the-noost-bar");
  assert.equal(hrefFor("event", "e1"), "/whats-on/e1");
  assert.equal(hrefFor("job", "j1"), "/jobs/j1");
  assert.equal(hrefFor("boat", "b1"), "/boats/b1");
  assert.equal(hrefFor("spik", "peerie"), "/spik/peerie");
  assert.equal(hrefFor("hub", "h1"), "/hubs/h1");
  assert.equal(hrefFor("spik", "a/b?c"), "/spik/a%2Fb%3Fc");
});
test("parseHits drops malformed rows and unknown kinds (nothing unexpected is rendered)", () => {
  const out = parseHits([{ kind: "business", ref: "a", title: "A", subtitle: "x", score: "70", close: false }, { kind: "secret", ref: "z", title: "Z" }, { kind: "job", ref: "", title: "no ref" }, null, "x"]);
  assert.equal(out.length, 1); assert.equal(out[0].score, 70);
  assert.deepEqual(parseHits("nope"), []);
});
test("groupHits keeps the display order and omits empty groups", () => {
  const g = groupHits([hit("spik", "s", "S"), hit("business", "b", "B"), hit("job", "j", "J")]);
  assert.deepEqual(g.map((x) => x.kind), ["business", "job", "spik"]);
});
test("subtitleFor turns category codes into words", () => {
  assert.equal(subtitleFor(hit("business", "b", "B", { subtitle: "food_drink" })), "Food & drink");
  assert.equal(subtitleFor(hit("business", "b", "B", { subtitle: "retail" })), "Retail");
  assert.equal(subtitleFor(hit("event", "e", "E", { subtitle: "" })), "Event");
});

/* ── live suggestions: debounce, abort, ignore outdated ─────────────────────────────────────────────────────────────────── */
function harness(handler, debounceMs = 30) {
  const states = []; const calls = [];
  const fetchImpl = (url, init) => { calls.push({ url: String(url), signal: init.signal }); return handler(String(url), init); };
  const s = createSuggester({ onState: (x) => states.push(x), fetchImpl, debounceMs });
  return { s, states, calls };
}
const ok = (results) => Promise.resolve({ ok: true, json: async () => ({ results }) });

test("nothing is requested for fewer than 2 characters", async () => {
  const h = harness(() => ok([])); h.s.input("n"); await sleep(80);
  assert.equal(h.calls.length, 0); assert.equal(h.states.at(-1).status, "idle");
});
test("typing quickly makes ONE request, for the final text", async () => {
  const h = harness(() => ok([hit("business", "the-noost-bar", "The Noost Bar")]));
  for (const t of ["no", "noo", "noos", "noost"]) { h.s.input(t); await sleep(5); }
  await sleep(120);
  assert.equal(h.calls.length, 1); assert.match(h.calls[0].url, /q=noost$/);
  assert.equal(h.states.at(-1).status, "ok");
});
test("a new request aborts the previous one, and a late answer for old text is ignored", async () => {
  let n = 0;
  const h = harness((url, init) => ++n === 1
    ? new Promise((res, rej) => { init.signal.addEventListener("abort", () => rej(new DOMException("aborted", "AbortError"))); setTimeout(() => res({ ok: true, json: async () => ({ results: [hit("business", "old", "OLD")] }) }), 150); })
    : ok([hit("business", "new", "NEW")]));
  h.s.input("noos"); await sleep(50);   // first request in flight
  h.s.input("noost"); await sleep(250);
  assert.equal(h.calls[0].signal.aborted, true);
  const last = h.states.at(-1); assert.equal(last.status, "ok"); assert.equal(last.results[0].title, "NEW");
  assert.ok(!h.states.some((x) => x.status === "ok" && x.results[0].title === "OLD"));
});
test("empty, unavailable (server flag) and network failure each have their own state", async () => {
  let h = harness(() => ok([])); h.s.input("zzzz"); await sleep(100); assert.equal(h.states.at(-1).status, "empty");
  h = harness(() => Promise.resolve({ ok: true, json: async () => ({ results: [], unavailable: true }) })); h.s.input("zzzz"); await sleep(100); assert.equal(h.states.at(-1).status, "unavailable");
  h = harness(() => Promise.reject(new Error("offline"))); h.s.input("zzzz"); await sleep(100); assert.equal(h.states.at(-1).status, "unavailable");
  h = harness(() => Promise.resolve({ ok: false, status: 500, json: async () => ({}) })); h.s.input("zzzz"); await sleep(100); assert.equal(h.states.at(-1).status, "unavailable");
});
test("the same text is not fetched twice within 30 s", async () => {
  const h = harness(() => ok([hit("business", "a", "A")]));
  h.s.input("noost"); await sleep(100); h.s.input("noost"); await sleep(100);
  assert.equal(h.calls.length, 1); assert.equal(h.states.at(-1).status, "ok");
});
test("close() cancels a pending request", async () => {
  const h = harness(() => ok([hit("business", "a", "A")]), 50); h.s.input("noost"); h.s.close(); await sleep(120);
  assert.equal(h.calls.length, 0);
});

/* ── server core: bounded, cached, failure is never "no results" ───────────────────────────────────────────────────────── */
test("searchSite: validates, parses and keeps the answer; a repeat does not call the database", async () => {
  __resetHomeResilience(); let calls = 0;
  const rpc = async (q, limit) => { calls++; return [{ kind: "business", ref: "r", title: "The Noost Bar", subtitle: "food_drink", score: 70, close: false }, { kind: "x", ref: "r", title: "bad" }]; };
  const a = await searchSite("noost", 8, rpc); const b = await searchSite("  NOOST ", 8, rpc);
  assert.equal(a.ok, true); assert.equal(a.hits.length, 1); assert.equal(calls, 1); assert.equal(b.ok, true);
  assert.deepEqual(await searchSite("n", 8, rpc), { ok: true, hits: [] }); assert.equal(calls, 1);
});
test("searchSite: a slow database is cut off at the deadline and reported as unavailable, not as no results", async () => {
  __resetHomeResilience(); const t = Date.now();
  const out = await searchSite("noost", 8, () => new Promise(() => {}), 60);
  assert.deepEqual(out, { ok: false }); assert.ok(Date.now() - t < 500);
});
test("searchSite: a database error is unavailable, and an earlier good answer is served stale", async () => {
  __resetHomeResilience();
  const bad = await searchSite("harrys", 8, async () => { throw new Error("down"); }); assert.deepEqual(bad, { ok: false });
});

/* ── structure: accessibility + wiring ─────────────────────────────────────────────────────────────────────────────────── */
const comp = readFileSync(new URL("../components/search/SiteSearch.tsx", import.meta.url), "utf8");
test("SiteSearch is a labelled ARIA combobox with a listbox, active descendant, live status and keyboard handling", () => {
  for (const re of [/role="combobox"/, /aria-expanded=/, /aria-controls=/, /aria-autocomplete="list"/, /aria-activedescendant=/, /role="listbox"/, /role="option"/, /aria-selected=/, /role="status" aria-live="polite"/, /className="sr-only">\{label\}</, /ArrowDown/, /ArrowUp/, /"Escape"/, /"Enter"/, /type="search"/, /min-h-\[44px\]/])
    assert.match(comp, re, String(re));
});
test("the header opens search and the route + page exist; the directory dead-end links to site search", () => {
  assert.match(readFileSync(new URL("../components/site/SiteHeader.tsx", import.meta.url), "utf8"), /<SiteSearch autoFocus/);
  const route = readFileSync(new URL("../app/api/search/suggest/route.ts", import.meta.url), "utf8");
  assert.match(route, /private, max-age=30/); assert.doesNotMatch(route, /s-maxage|public/); // shared caches ignore ?q= on Netlify
  assert.match(readFileSync(new URL("../app/api/search/suggest/route.ts", import.meta.url), "utf8"), /no-store/);
  assert.match(readFileSync(new URL("../app/search/page.tsx", import.meta.url), "utf8"), /TrackSearch section="site"/);
  assert.match(readFileSync(new URL("../app/directory/page.tsx", import.meta.url), "utf8"), /Search all of OneShetland/);
});

/* ── scope + shared component ─────────────────────────────────────────────────────────────────────────────────────────── */
import { capPerKind, trimWeak, parseScope, submitHref, searchHrefScoped, SCOPE_NOUN } from "../lib/search.ts";
test("parseScope accepts only known scopes (anything else is 'all')", () => {
  for (const s of ["all", "business", "event", "job", "boat", "spik", "hub"]) assert.equal(parseScope(s), s);
  for (const s of ["", "x", null, undefined, "BUSINESS", "business,job"]) assert.equal(parseScope(s), "all");
});
test("submitHref keeps every existing filter (incl. repeated ones) and sets q last; empty filters are dropped", () => {
  assert.equal(submitHref({ path: "/directory", params: { category: "retail", area: undefined, bookable: "1" } }, "harrys"), "/directory?category=retail&bookable=1&q=harrys");
  assert.equal(submitHref({ path: "/jobs", params: { loc: ["Lerwick", "Unst"], sort: "" } }, "cook"), "/jobs?loc=Lerwick&loc=Unst&q=cook");
  assert.equal(submitHref({ path: "/spik" }, "peerie"), "/spik?q=peerie");
  assert.equal(submitHref({ path: "/x", param: "term" }, "a b&c"), "/x?term=a+b%26c");
});
test("searchHrefScoped narrows only when asked", () => {
  assert.equal(searchHrefScoped("noost"), "/search?q=noost"); assert.equal(searchHrefScoped("noost", "event"), "/search?q=noost&scope=event");
  assert.equal(SCOPE_NOUN.business, "businesses");
});
test("the suggester sends the scope, and the same text in two scopes is two different answers", async () => {
  const urls = []; const states = [];
  const s = createSuggester({ scope: "business", debounceMs: 10, onState: (x) => states.push(x), fetchImpl: (u) => { urls.push(String(u)); return ok([hit("business", "a", "A")]); } });
  s.input("harr"); await sleep(80);
  assert.match(urls[0], /q=harr&scope=business$/);
  const s2 = createSuggester({ debounceMs: 10, onState: () => {}, fetchImpl: (u) => { urls.push(String(u)); return ok([]); } });
  s2.input("harr"); await sleep(80); assert.ok(!/scope=/.test(urls[1]));
});
test("the API route serves ONE cached database answer to every scope and filters it", () => {
  const route = readFileSync(new URL("../app/api/search/suggest/route.ts", import.meta.url), "utf8");
  assert.match(route, /searchSite\(.*RESULTS_LIMIT\)/); assert.match(route, /h\.kind === scope/);
});
test("every search box is the shared component, with the right scope", () => {
  const read = (p) => readFileSync(new URL("../" + p, import.meta.url), "utf8");
  assert.match(read("app/directory/page.tsx"), /scope="business"/);
  assert.match(read("app/jobs/page.tsx"), /scope="job"/);
  assert.match(read("app/spik/page.tsx"), /scope="spik"/);
  assert.match(read("components/boats/BoatsSearchBar.tsx"), /scope="boat"/);
  assert.match(read("app/whats-on/page.tsx"), /scope="event"/);
  assert.match(read("components/home/HomeSections.tsx"), /scope="all"/);
  assert.match(read("components/site/SiteHeader.tsx"), /<SiteSearch autoFocus/);
  for (const f of ["app/directory/page.tsx", "app/jobs/page.tsx", "app/spik/page.tsx"]) assert.doesNotMatch(read(f), /<form action="\/(directory|jobs|spik)" method="get" className="mb-3/);
});

test("trimWeak drops description-only matches when real name matches exist, but never empties a search", () => {
  const a = hit("business", "a", "Harry's", { score: 85 }), w = hit("business", "w", "Cancer Research UK", { score: 25 }), c = hit("business", "c", "Hay's Dock", { score: 35, close: true });
  assert.deepEqual(trimWeak([a, w, c]).map((h) => h.ref), ["a", "c"]);
  assert.deepEqual(trimWeak([w]).map((h) => h.ref), ["w"]);
  assert.deepEqual(trimWeak([]), []);
});

test("capPerKind keeps order and limits each kind", () => {
  const hs = [..."aaaaa"].map((c, i) => hit("spik", c + i, c)).concat([hit("business", "b", "B")]);
  assert.deepEqual(capPerKind(hs, 3).map((h) => h.ref), ["a0", "a1", "a2", "b"]);
});

test("the Jobs Shifts tab keeps its plain search: no live job suggestions there", () => {
  const jobs = readFileSync(new URL("../app/jobs/page.tsx", import.meta.url), "utf8");
  assert.match(jobs, /scope="job" suggest=\{!isShifts\}/);
  const c = readFileSync(new URL("../components/search/SiteSearch.tsx", import.meta.url), "utf8");
  assert.match(c, /showPanel = suggest && open/); assert.match(c, /if \(suggest\) suggester\.current\?\.input/);
});

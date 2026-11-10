/** Editions R3: calendar export, plan grouping and clashes, search sanitising, save/plan buttons, source guards. Run: node --test --import ./tests/support/register.mjs tests/editions-visitor.test.mjs */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement as h } from "react";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

await import("./support/register-jsx.mjs");
const ics = await import("../lib/editions/ics.ts");
const plan = await import("../lib/editions/plan.ts");
const { searchTerm } = await import("../lib/editions/data.server.ts");
const { SaveEditionButton, PlanToggle } = await import("../components/editions/SaveButtons.tsx");
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => readFileSync(join(ROOT, p), "utf8");

describe("calendar file hardening", () => {
  test("a semicolon is escaped and a bare carriage return cannot start a new calendar property", () => {
    assert.equal(ics.icsEscape("a;b"), "a\\;b");
    const out = ics.buildIcs({ name: "Fest", now: new Date("2027-01-01T00:00:00Z"), items: [{ uid: "s", title: "Evil\rATTENDEE:mailto:x@y.z", starts_at: "2027-06-10T09:00:00Z" }] });
    assert.ok(!/\r(?!\n)/.test(out), "no bare CR survives");
    assert.ok(!/\r\nATTENDEE:/.test(out), "no injected property line");
  });
});

describe("calendar file", () => {
  const NOW = new Date("2027-01-01T00:00:00Z");
  test("valid structure, CRLF, UTC times, stable UID, escaped text", () => {
    const out = ics.buildIcs({ name: "Fest; 2027, big", now: NOW, items: [{ uid: "s1", title: "Opening, with; commas\\and newline\nx", starts_at: "2027-06-10T09:00:00Z", ends_at: "2027-06-10T10:30:00Z", location: "Hall, Lerwick", description: "About", url: "https://oneshetland.com/e" }] });
    assert.ok(out.startsWith("BEGIN:VCALENDAR\r\nVERSION:2.0\r\n") && out.endsWith("END:VCALENDAR\r\n"));
    assert.ok(!/[^\r]\n/.test(out), "every line ends CRLF");
    assert.match(out, /UID:s1@oneshetland\.com/); assert.match(out, /DTSTART:20270610T090000Z/); assert.match(out, /DTEND:20270610T103000Z/); assert.match(out, /DTSTAMP:20270101T000000Z/);
    assert.match(out, /SUMMARY:Opening\\, with\\; commas\\\\and newline\\nx/);
    assert.match(out, /X-WR-CALNAME:Fest\\; 2027\\, big/);
    assert.match(out, /LOCATION:Hall\\, Lerwick/);
  });
  test("a missing or invalid end becomes one hour; cancelled items stay as CANCELLED", () => {
    const out = ics.buildIcs({ name: "x", now: NOW, items: [{ uid: "a", title: "A", starts_at: "2027-06-10T09:00:00Z", ends_at: "2027-06-10T08:00:00Z", status: "cancelled" }, { uid: "b", title: "B", starts_at: "2027-06-10T12:00:00Z" }] });
    assert.match(out, /DTEND:20270610T100000Z/); assert.match(out, /DTEND:20270610T130000Z/); assert.equal(out.split("STATUS:CANCELLED").length - 1, 1);
  });
  test("long lines fold at 75 octets, including multi-byte characters, and unfold back exactly", () => {
    const title = "Ceilidh ".repeat(20) + "café ☕ " .repeat(10);
    const out = ics.buildIcs({ name: "x", now: NOW, items: [{ uid: "a", title, starts_at: "2027-06-10T09:00:00Z" }] });
    for (const l of out.split("\r\n")) assert.ok(new TextEncoder().encode(l).length <= 75, l);
    assert.ok(out.replace(/\r\n /g, "").includes(`SUMMARY:${ics.icsEscape(title)}`));
  });
  test("no items still yields a valid empty calendar", () => { assert.match(ics.buildIcs({ name: "x", items: [] }), /BEGIN:VCALENDAR[\s\S]*END:VCALENDAR/); });
});

describe("plan grouping and clashes", () => {
  const row = (o) => ({ edition_id: "e1", edition_title: "Fest", edition_slug: "fest", edition_starts_on: "2027-06-10", edition_ends_on: "2027-06-12", edition_saved: true, kind: null, item_id: null, title: null, starts_at: null, ends_at: null, venue: null, status: null, item_href: null, last_update_at: null, ...o });
  const it = (id, s, e, o = {}) => row({ kind: "session", item_id: id, title: id, starts_at: s, ends_at: e, ...o });
  test("groups by Edition, sorts by time, keeps the header row's saved flag and latest update", () => {
    const g = plan.groupPlan([row({ last_update_at: "2027-01-02T00:00:00Z" }), it("b", "2027-06-10T12:00:00Z", null), it("a", "2027-06-10T09:00:00Z", null), row({ edition_id: "e0", edition_slug: "early", edition_starts_on: "2027-05-01", edition_saved: false })]);
    assert.deepEqual(g.map((e) => e.slug), ["early", "fest"]);
    assert.deepEqual(g[1].items.map((i) => i.id), ["a", "b"]); assert.equal(g[1].lastUpdateAt, "2027-01-02T00:00:00Z"); assert.equal(g[0].saved, false);
  });
  test("overlap is a clash; back-to-back, different days and cancelled items are not", () => {
    const mk = (id, s, e, st = null) => ({ editionId: "e", editionSlug: "e", kind: "session", id, title: id, starts_at: s, ends_at: e, venue: null, status: st, href: null });
    assert.deepEqual([...plan.clashes([mk("a", "2027-06-10T09:00:00Z", "2027-06-10T10:00:00Z"), mk("b", "2027-06-10T09:30:00Z", "2027-06-10T11:00:00Z")])].sort(), ["a", "b"]);
    assert.equal(plan.clashes([mk("a", "2027-06-10T09:00:00Z", "2027-06-10T10:00:00Z"), mk("b", "2027-06-10T10:00:00Z", "2027-06-10T11:00:00Z")]).size, 0);
    assert.equal(plan.clashes([mk("a", "2027-06-10T09:00:00Z", "2027-06-10T10:00:00Z", "cancelled"), mk("b", "2027-06-10T09:30:00Z", "2027-06-10T11:00:00Z")]).size, 0);
    assert.equal(plan.clashes([mk("a", "2027-06-10T09:00:00Z", null), mk("b", "2027-06-10T09:45:00Z", null)]).size, 2, "no end means one hour");
  });
  test("days use the Europe/London day: 23:30Z in summer is already tomorrow", () => {
    const g = plan.groupPlan([it("late", "2027-06-10T23:30:00Z", null), it("early", "2027-06-10T09:00:00Z", null)]);
    assert.deepEqual(plan.planDays(g).map((d) => d.day), ["2027-06-10", "2027-06-11"]);
  });
});

describe("search term", () => {
  test("cannot break out of the filter expression", () => {
    assert.equal(searchTerm("wool, week)"), "wool week");
    assert.equal(searchTerm("a%b_c(d).e,f"), "a b c d e f");
    assert.equal(searchTerm("title.eq.x),or(summary.ilike.%"), "title eq x or summary ilike");
    assert.equal(searchTerm("x".repeat(200)).length, 60); assert.equal(searchTerm(undefined), ""); assert.equal(searchTerm(["a"]), "");
    assert.equal(searchTerm("Ceilidh & Craic's café"), "Ceilidh & Craic's café");
  });
});

describe("buttons", () => {
  test("signed out: plain sign-in links that return to the same page", () => {
    const a = renderToStaticMarkup(h(SaveEditionButton, { editionId: "e", initial: false, signedIn: false, nextPath: "/editions/fest" }));
    assert.match(a, /href="\/sign-in\?next=%2Feditions%2Ffest"/); assert.ok(!a.includes("<button"));
    const b = renderToStaticMarkup(h(PlanToggle, { editionId: "e", kind: "session", itemId: "s", title: "Opening", initial: false, signedIn: false, nextPath: "/editions/fest/programme" }));
    assert.match(b, /sign-in\?next=%2Feditions%2Ffest%2Fprogramme/); assert.ok(b.includes("Opening"));
  });
  test("signed in: pressed state is announced and the label names the item", () => {
    const a = renderToStaticMarkup(h(SaveEditionButton, { editionId: "e", initial: true, signedIn: true, nextPath: "/x" }));
    assert.ok(a.includes('aria-pressed="true"') && a.includes("Saved"));
    const b = renderToStaticMarkup(h(PlanToggle, { editionId: "e", kind: "event", itemId: "s", title: "Quiz", initial: false, signedIn: true, nextPath: "/x" }));
    assert.ok(b.includes('aria-pressed="false"') && b.includes("Add to my plan") && b.includes("Quiz"));
  });
});

describe("source guards", () => {
  test("visitor actions require sign-in and validate ids; plan and calendar routes are private", () => {
    const a = read("app/editions/actions.ts");
    for (const b of a.split(/^export async function /m).slice(1)) assert.match(b, /authed\(\)/);
    assert.match(a, /isUuid\(editionId\)/); assert.ok(!/service[_-]?role|createAdminClient/i.test(a));
    assert.match(read("app/account/editions/plan/calendar.ics/route.ts"), /status: 401|401/);
    assert.match(read("app/account/editions/plan/page.tsx"), /redirect\(`\/sign-in/);
  });
  test("the public calendar refuses unpublished and test Editions", () => {
    assert.match(read("app/editions/[slug]/calendar.ics/route.ts"), /status !== "published" \|\| b\.edition\.is_test/);
  });
  test("My Saved's own code is untouched by Editions (no edition item type in saved libs)", () => {
    assert.ok(!/edition/i.test(read("lib/saved.server.ts")));
  });
});

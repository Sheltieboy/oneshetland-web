import test from "node:test";
import assert from "node:assert/strict";
import { dateProblem, slugify, validSlug, safeAccent, contrast, dateRangeLabel, phaseOf, groupSessionsByDay, navFor, parseReadiness, missingRequired, canSubmit, friendlyError, can } from "../lib/editions/rules.ts";
import { parseMarkdown, parseInline, safeHref } from "../lib/editions/markdown.ts";

test("date rules mirror the database for each kind", () => {
  assert.equal(dateProblem("single_day", "2027-05-01", "2027-05-01"), null);
  assert.match(dateProblem("single_day", "2027-05-01", "2027-05-02"), /same day/);
  assert.equal(dateProblem("multi_day", "2027-05-01", "2027-05-03"), null);
  assert.ok(dateProblem("multi_day", "2027-05-01", "2027-05-01"));
  assert.ok(dateProblem("multi_day", "2027-05-01", "2027-05-20"));
  assert.equal(dateProblem("week", "2027-10-02", "2027-10-10"), null);
  assert.ok(dateProblem("week", "2027-10-02", "2027-10-04"));
  assert.equal(dateProblem("season", "2027-06-01", "2027-08-31"), null);
  assert.ok(dateProblem("campaign", "2027-06-01", "2029-01-01"));
  assert.ok(dateProblem("campaign", "2027-06-10", "2027-06-01"));
  assert.ok(dateProblem("campaign", "", ""));
});

test("slugs", () => {
  assert.equal(slugify("Café & Crafts Fair 2027!"), "cafe-and-crafts-fair-2027");
  assert.ok(validSlug("zz-test-edition-2027"));
  assert.ok(!validSlug("Bad Slug")); assert.ok(!validSlug("a")); assert.ok(!validSlug("-x-"));
});

test("accent colours are made AA-safe for white text", () => {
  assert.ok(contrast("#000000", "#ffffff") > 20);
  const light = safeAccent("#ffee00");
  assert.ok(contrast(light, "#ffffff") >= 4.5, light);
  assert.equal(safeAccent("#0b5a73"), "#0b5a73");
  assert.equal(safeAccent(null, "not a colour", "#0b5a73"), "#0b5a73");
  assert.ok(contrast(safeAccent(), "#ffffff") >= 4.5);
});

test("date labels and phases use Shetland days", () => {
  assert.equal(dateRangeLabel("2027-05-14", "2027-05-16"), "14 to 16 May 2027");
  assert.equal(dateRangeLabel("2027-10-30", "2027-11-03"), "30 Oct to 3 Nov 2027");
  assert.match(dateRangeLabel("2027-05-14", "2027-05-14"), /14 May 2027/);
  const ed = { starts_on: "2027-05-14", ends_on: "2027-05-16" };
  assert.equal(phaseOf(ed, new Date("2027-05-13T22:30:00Z")), "upcoming"); // 23:30 BST on the 13th
  assert.equal(phaseOf(ed, new Date("2027-05-13T23:30:00Z")), "running");  // 00:30 BST on the 14th: already the first day in London
  assert.equal(phaseOf(ed, new Date("2027-05-15T10:00:00Z")), "running");
  assert.equal(phaseOf(ed, new Date("2027-05-16T23:30:00Z")), "ended");   // 00:30 BST on the 17th
});

test("programme groups by London day in time order", () => {
  const s = (id, iso, pos = 0) => ({ id, edition_id: "e", title: id, description: null, starts_at: iso, ends_at: null, venue_id: null, kind: "session", ticket_mode: "none", ticket_url: null, price_text: null, status: "scheduled", position: pos });
  const g = groupSessionsByDay([s("late", "2027-05-14T22:30:00Z"), s("early", "2027-05-14T08:00:00Z"), s("next", "2027-05-15T09:00:00Z")]);
  assert.equal(g.length, 2, "22:30Z in May is 23:30 BST: the same London day as 08:00Z");
  assert.deepEqual(g[0].items.map((i) => i.id), ["early", "late"]);
  const g2 = groupSessionsByDay([s("a", "2027-05-14T22:30:00Z"), s("b", "2027-05-14T23:30:00Z")]);
  assert.equal(g2.length, 2, "23:30Z is 00:30 BST the next London day");
});

test("navigation puts home first then position order and hides in_nav=false", () => {
  const p = (slug, position, in_nav = true, is_home = false) => ({ slug, nav_label: slug, position, in_nav, is_home });
  assert.deepEqual(navFor([p("b", 2), p("hide", 1, false), p("home", 5, true, true), p("a", 1)]).map((n) => n.slug), ["home", "a", "b"]);
});

test("the checklist is the database's: required items gate submission, recommended ones do not", () => {
  const item = (key, required, ok) => ({ key, label: key, required, ok, hint: "h" });
  const all = [item("summary", true, true), item("page", true, true), item("cover", false, false)];
  assert.ok(canSubmit(all));
  assert.ok(!canSubmit([item("summary", true, false), ...all.slice(1)]));
  assert.deepEqual(missingRequired([item("summary", true, false), item("cover", false, false)]).map((x) => x.key), ["summary"]);
  assert.ok(!canSubmit([]), "a checklist that did not load never counts as ready");
  assert.deepEqual(parseReadiness("nope"), []);
  assert.deepEqual(parseReadiness([{ key: "a", label: "A", required: true, ok: false, hint: "x" }, { bad: 1 }]).length, 1);
});

test("roles", () => { assert.ok(can("owner", "admin")); assert.ok(!can("editor", "admin")); assert.ok(!can(null, "editor")); });

test("database refusals become plain language", () => {
  assert.match(friendlyError("ERROR: no live publish entitlement for this edition"), /package/);
  assert.match(friendlyError("new row violates row-level security policy"), /permission/);
  assert.match(friendlyError("weird"), /try again/);
});

test("markdown: structure, emphasis and safe links only", () => {
  const b = parseMarkdown("## Hello\n\nA **bold** and *soft* [link](https://example.com) and [bad](javascript:alert(1)).\n\n- one\n- two\n\n<script>alert(1)</script>");
  assert.equal(b[0].t, "h2");
  const inl = b[1].inline;
  assert.ok(inl.some((i) => i.t === "strong") && inl.some((i) => i.t === "em") && inl.some((i) => i.t === "link" && i.href === "https://example.com"));
  assert.ok(!inl.some((i) => i.t === "link" && /javascript/.test(i.href)), "unsafe link must stay text");
  assert.equal(b[2].t, "ul"); assert.equal(b[2].items.length, 2);
  assert.equal(b[3].t, "p");
  assert.ok(b[3].inline[0].t === "text" && b[3].inline[0].v.includes("<script>"), "raw HTML is text, never markup");
  assert.ok(safeHref("/editions/x")); assert.ok(!safeHref("//evil.example")); assert.ok(!safeHref("http://x.example"));
  assert.deepEqual(parseInline("plain"), [{ t: "text", v: "plain" }]);
});

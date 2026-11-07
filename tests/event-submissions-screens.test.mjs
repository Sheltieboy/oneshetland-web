/**
 * Screen logic: contributor decisions, change diff, admin data shaping and LABELS (true classification), copy, gating, and source-level guarantees.
 * Run: node --test --import ./tests/support/register.mjs tests/event-submissions-screens.test.mjs
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { buildChange, currentFutureDates, restoreOption, sameDates, isPast } from "../lib/event-contributor-logic.ts";
import { adminEventLabel, describeChange, viewSubmission, queueBadge, ageLabel, publicCredit, CURATED_LABEL, OFFICIAL_LABEL } from "../lib/event-submissions-shape.ts";
import * as copy from "../lib/contributor-copy.ts";
import { frontDoorAccess } from "../lib/event-front-door.ts";
import { blankRow } from "../lib/event-dates-builder.ts";

const read = (p) => readFileSync(new URL("../" + p, import.meta.url), "utf8");
const NOW = Date.parse("2026-11-06T12:00:00Z");
const EV = { id: "e", title: "Winter Fair", description: "Tea", venue: "Hall", locality: "Unst", status: "published", starts_at: "2026-12-05T14:00:00Z", ends_at: null, ticket_url: null, contact_info: null, price_text: "Free", cover_url: null, organiser_name: "G", is_dated_run: false };
const form = (over = {}) => ({ title: EV.title, description: EV.description, venue: EV.venue, price_text: "Free", contact_info: "", ticket_url: "", cover_url: null, rows: [blankRow({ date: "2026-12-05", start: "14:00" })], ...over });

describe("labels use the TRUE classification, never is_platform_event", () => {
  test("every classification", () => {
    assert.equal(adminEventLabel({ source: "community_submission", organiser_name: "Unst Quilters", is_platform_event: true }), "Community event · Unst Quilters");
    assert.equal(adminEventLabel({ business: { name: "The Cafe" } }), "Business · The Cafe");
    assert.equal(adminEventLabel({ hub: { name: "Yell Hub" } }), "Hub · Yell Hub");
    assert.equal(adminEventLabel({ source: "oneshetland", is_platform_event: true }), OFFICIAL_LABEL);
    assert.equal(adminEventLabel({ is_platform_event: true }), CURATED_LABEL);
    assert.equal(adminEventLabel({ is_platform_event: true, organiser_name: "Shetland Drama" }), "Curated listing · Shetland Drama");
    assert.equal(adminEventLabel({ is_platform_event: false }), "No organiser shown");
    assert.equal(adminEventLabel(null), "No organiser shown");
  });
  test("a plain platform-owned event is never 'official' or OneShetland", () => {
    for (const e of [{ is_platform_event: true }, { is_platform_event: true, source: null, organiser_name: null }, { is_platform_event: true, source: "unknown" }]) {
      const l = adminEventLabel(e);
      assert.doesNotMatch(l, /official|oneshetland-organised/i, l);
    }
    assert.equal(CURATED_LABEL, "Curated listing (added by staff)");
  });
  test("a community event with no name is neutral, never OneShetland", () => {
    assert.equal(adminEventLabel({ source: "community_submission", organiser_name: " " }), "Community event · Community organiser");
  });
  test("no screen decides a label from is_platform_event", () => {
    const shape = read("lib/event-submissions-shape.ts");
    assert.ok(shape.indexOf("eventOrganiser(e ?? null)") < shape.indexOf("e?.is_platform_event ?"), "classification first; the platform flag only picks between curated and no-claim");
    for (const f of ["lib/event-submissions-admin.server.ts", "components/admin/EventSubmissionsQueue.tsx", "components/admin/EventChangesQueue.tsx"]) {
      assert.doesNotMatch(read(f).replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, "").replace(/is_platform_event\??: boolean \| null/g, "").replace(/select\("[^"]*"\)/g, ""), /\.is_platform_event|\bis_platform_event\s*\?/, f);
    }
  });
  test("the public credit is exactly what the contributor typed", () => {
    assert.equal(publicCredit("  Unst Quilters "), "Shown to the public as: Unst Quilters");
    const v = viewSubmission({ id: "a", status: "pending", title: "T", organiser_name: "Unst Quilters", category: "community", occurrences: [], review_reason: null, event_id: null });
    assert.equal(v.credit, "Shown to the public as: Unst Quilters");
  });
  test("approval wording says community event credited to the organiser, never OneShetland's", () => {
    const t = copy.APPROVE_CONFIRM("Unst Quilters");
    assert.match(t, /community event credited to Unst Quilters/); assert.match(t, /not be shown as organised by OneShetland/);
    assert.match(read("components/admin/EventSubmissionsQueue.tsx"), /APPROVE_CONFIRM\(s\.organiser_name\)/);
    assert.match(read("app/admin/events/submissions/page.tsx"), /never as OneShetland's/);
  });
});

describe("contributor decisions", () => {
  const occ = (id, starts, status = "scheduled", note = null) => ({ id, event_id: "e", starts_at: starts, ends_at: null, status, note });
  test("future dates: occurrence rows if present, else the event's own times; past ones excluded", () => {
    assert.equal(currentFutureDates(EV, [], NOW).length, 1);
    assert.equal(currentFutureDates({ starts_at: "2026-01-01T10:00:00Z", ends_at: null }, [], NOW).length, 0);
    const f = currentFutureDates(EV, [occ("a", "2026-10-01T10:00:00Z"), occ("b", "2026-12-05T10:00:00Z", "cancelled", "x")], NOW);
    assert.deepEqual(f, [{ starts_at: "2026-12-05T10:00:00Z", note: "x" }]);
    assert.equal(isPast("2026-10-01T10:00:00Z", NOW), true);
  });
  test("restore is offered only for the latest contributor action inside 24 hours", () => {
    const L = (o) => ({ id: 1, occurrence_id: "o1", actor_kind: "contributor", action: "performance_cancelled", detail: {}, created_at: "2026-11-06T06:00:00Z", ...o });
    assert.deepEqual(restoreOption([L()], NOW), { kind: "performance", occurrenceId: "o1" });
    assert.deepEqual(restoreOption([L({ action: "event_cancelled", occurrence_id: null })], NOW), { kind: "event" });
    assert.equal(restoreOption([L({ created_at: "2026-11-05T11:00:00Z" })], NOW), null);       // 25h
    assert.equal(restoreOption([L({ actor_kind: "staff" })], NOW), null);
    assert.equal(restoreOption([L({ action: "performance_note" })], NOW), null);
    assert.equal(restoreOption([], NOW), null); assert.equal(restoreOption(null, NOW), null);
  });
  test("a change request carries only what changed; nothing changed is a friendly stop", () => {
    const cur = { event: EV, future: currentFutureDates(EV, [], NOW) };
    assert.equal(buildChange(cur, form(), NOW, true).nothingChanged, true);
    const r = buildChange(cur, form({ venue: "Uyeasound Hall", rows: [blankRow({ date: "2026-12-06", start: "14:00" })] }), NOW, true);
    assert.equal(r.ok, true);
    assert.deepEqual(r.changed.sort(), ["occurrences", "venue"]);
    assert.deepEqual(r.payload.occurrences, [{ starts_at: "2026-12-06T14:00:00Z" }]);
    assert.equal("title" in r.payload, false);
  });
  test("untouched dates are never sent (so they are not re-validated or re-timed)", () => {
    const cur = { event: EV, future: currentFutureDates(EV, [], NOW) };
    const r = buildChange(cur, form({ venue: "New Hall", rows: [blankRow({ date: "2020-01-01", start: "10:00" })] }), NOW, false);
    assert.equal(r.ok, true); assert.deepEqual(Object.keys(r.payload), ["venue"]);
  });
  test("same checks as a first submission: links, past dates, http tickets", () => {
    const cur = { event: EV, future: [] };
    assert.equal(buildChange(cur, form({ description: "see https://x.org" }), NOW, false).errors.description !== undefined, true);
    assert.equal(buildChange(cur, form({ ticket_url: "http://x.org" }), NOW, false).errors.ticket_url !== undefined, true);
    const p = buildChange(cur, form({ rows: [blankRow({ date: "2020-01-01", start: "10:00" })] }), NOW, true);
    assert.equal(p.ok, false); assert.equal(p.rowIssues.length, 1);
    assert.equal(sameDates([{ starts_at: "2026-12-05T14:00:00Z" }], [{ starts_at: "2026-12-05T14:00:00.000Z" }]), true);
  });
  test("clearing an optional field sends null", () => {
    const r = buildChange({ event: { ...EV, price_text: "Free" }, future: [] }, form({ price_text: "" }), NOW, false);
    assert.deepEqual(r.payload, { price_text: null });
  });
});

describe("admin data shaping", () => {
  test("change lines: dates become add / remove / change, details become was / now, and always-checked fields are marked", () => {
    const lines = describeChange(
      { title: "New", occurrences: [{ starts_at: "2026-12-06T14:00:00Z" }, { starts_at: "2026-12-07T14:00:00Z", note: "n" }] },
      { title: "Old", occurrences: [{ starts_at: "2026-12-05T14:00:00Z" }, { starts_at: "2026-12-07T14:00:00Z" }] });
    const t = lines.find((l) => l.field === "title"), d = lines.find((l) => l.field === "occurrences");
    assert.deepEqual([t.before, t.after, t.needsLook], ["Old", "New", true]);
    assert.equal(d.added.length, 1); assert.equal(d.removed.length, 1); assert.equal(d.changed.length, 1); assert.equal(d.needsLook, false);
  });
  test("queue badge counts only what exists", () => {
    assert.deepEqual(queueBadge({ pending: 2 }, null), { pending: 2, changes: 0, total: 2, hasAny: true });
    assert.equal(queueBadge(null, null).hasAny, false);
  });
  test("age wording", () => {
    assert.equal(ageLabel("2026-11-06T11:30:00Z", NOW), "less than an hour ago");
    assert.equal(ageLabel("2026-11-06T09:00:00Z", NOW), "3 hours ago");
    assert.equal(ageLabel("2026-11-01T12:00:00Z", NOW), "5 days ago");
  });
  test("my-submissions statuses, reasons and actions", () => {
    const base = { id: "a", title: "T", organiser_name: "G", category: "community", occurrences: [], review_reason: "Please fix the date", event_id: null };
    const pend = viewSubmission({ ...base, status: "pending" });
    assert.deepEqual([pend.statusLabel, pend.canWithdraw, pend.canManage, pend.reason], ["With us", true, false, null]);
    const appr = viewSubmission({ ...base, status: "approved", event_id: "e" });
    assert.deepEqual([appr.statusLabel, appr.canWithdraw, appr.canManage], ["Approved", false, true]);
    assert.equal(viewSubmission({ ...base, status: "changes_requested" }).reason, "Please fix the date");
    assert.equal(viewSubmission({ ...base, status: "rejected" }).statusLabel, "Not accepted");
    assert.equal(viewSubmission({ ...base, status: "withdrawn" }).canWithdraw, false);
  });
});

describe("copy", () => {
  test("plain words: no jargon, no 'wee', no promise of notifications", () => {
    const strings = Object.values(copy).flatMap((v) => (typeof v === "string" ? [v] : typeof v === "object" ? Object.values(v) : []));
    strings.push(copy.historyLine({ action: "event_cancelled", actor_kind: "contributor" }), copy.changeOutcomeLine("pending"), copy.cannotChangeLine("past"), copy.APPROVE_CONFIRM("X"));
    for (const s of strings) {
      assert.doesNotMatch(s, /\bwee\b|payload|\bAPI\b|\bRPC\b|whitelist|moderat|queue|trusted organiser/i, s);
    }
    assert.doesNotMatch(copy.CANCEL_CONFIRM_PROMPT, /will be told|notified/i);
  });
  test("change outcomes are honest", () => {
    assert.equal(copy.changeOutcomeLine("auto_approved"), copy.CHANGE_APPLIED_LINE);
    assert.equal(copy.changeOutcomeLine("pending"), copy.CHANGE_PENDING_LINE);
  });
  test("the status sentence set is complete", () => {
    for (const s of ["pending", "approved", "changes_requested", "rejected", "withdrawn"]) { assert.ok(copy.STATUS_LABEL[s]); assert.ok(copy.STATUS_EXPLAINER[s]); }
  });
  test("history lines say who did what", () => {
    assert.equal(copy.historyLine({ action: "change_approved", actor_kind: "staff" }), "OneShetland approved a change you asked for");
    assert.match(copy.historyLine({ action: "change_auto_approved", actor_kind: "trusted_auto" }), /straight away/);
    assert.equal(copy.historyLine({ action: "mystery", actor_kind: "staff" }), "A change was made");
  });
});

describe("gating and dark launch", () => {
  test("the gate: flag on => open; admin => preview; else hidden", () => {
    assert.equal(frontDoorAccess({ flag: "on", isStaff: false }), "open");
    assert.equal(frontDoorAccess({ flag: undefined, isStaff: true }), "staff_preview");
    assert.equal(frontDoorAccess({ flag: "ON", isStaff: false }), "hidden");
    assert.equal(frontDoorAccess({ flag: "", isStaff: false }), "hidden");
  });
  test("every public-facing page of the feature calls the gate before anything else, and is noindex", () => {
    for (const f of ["app/whats-on/add/page.tsx", "app/account/event-submissions/page.tsx", "app/account/event-submissions/event/[id]/page.tsx"]) {
      const s = read(f);
      assert.match(s, /gateFeature(SignedIn)?\(/, f); assert.match(s, /index: false/, f);
    }
    const g = read("lib/event-submissions-access.server.ts");
    assert.match(g, /notFound\(\)/); assert.match(g, /process\.env\.EVENT_FRONT_DOOR/); assert.doesNotMatch(g, /NEXT_PUBLIC_EVENT/);
  });
  test("admin pages sit under the admin layout (requireAdmin) and are noindex", () => {
    assert.match(read("app/admin/layout.tsx"), /requireAdmin\(\)/);
    for (const f of ["app/admin/events/submissions/page.tsx", "app/admin/events/changes/page.tsx"]) assert.match(read(f), /index: false/);
  });
  test("nothing in navigation, footers, sitemap or other pages links to the feature", () => {
    const hits = [];
    const walk = (d) => { for (const n of readdirSync(d)) { if (["node_modules", ".next", ".git", "tests"].includes(n)) continue; const p = join(d, n); if (statSync(p).isDirectory()) walk(p); else if (/\.(tsx?|mjs)$/.test(n) && /event-submissions|whats-on\/add/.test(readFileSync(p, "utf8"))) hits.push(p); } };
    for (const d of ["app", "components", "lib"]) walk(d);
    const allowed = /(^|\/)(app\/whats-on\/add|app\/account\/event-submissions|app\/admin\/events|components\/events|components\/admin\/Event(Submissions|Changes)Queue|lib\/event-)/;
    assert.deepEqual(hits.filter((h) => !allowed.test(h)), []);
    assert.doesNotMatch(read("app/sitemap.ts"), /event-submissions|whats-on\/add/);
    assert.doesNotMatch(read("components/account/AccountSidebar.tsx"), /event-submissions/);
  });
  test("the only change to the existing admin events page is the small link row", () => {
    assert.match(read("app/admin/events/page.tsx"), /counts\.unavailable/);
    assert.doesNotMatch(read("components/admin/AdminSidebar.tsx"), /submissions/);
  });
  test("the form never sends anything until the review step, and has the exact confirmation wording and a heading focus per step", () => {
    const f = read("components/events/front-door/SubmissionForm.tsx");
    assert.match(f, /heading\.current\?\.focus\(\)/); assert.match(f, /ADULT_CONFIRM_TEXT/); assert.match(f, /requestId\.current \?\?= crypto\.randomUUID\(\)/);
    assert.match(f, /disabled=\{busy\}/);
  });
});

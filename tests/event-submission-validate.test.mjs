/**
 * Submission validators mirror the database rules, in friendly words. Pure.
 * Run: node --test --import ./tests/support/register.mjs tests/event-submission-validate.test.mjs
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { validateSubmission, validateStep, checkField, textProblem, posterProblem, posterFileName, ADULT_CONFIRM_TEXT, STEP_FIELDS } from "../lib/event-submission-validate.ts";
import { blankRow } from "../lib/event-dates-builder.ts";

const NOW = Date.parse("2026-11-06T12:00:00Z");
const UID = "11111111-2222-3333-4444-555555555555";
const good = () => ({
  request_id: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee", organiser_name: " Unst Quilters ", title: "Winter Fair", description: "Come along for tea.\nAll welcome.", category: "community",
  venue: "Baltasound Hall", locality: "Unst", price_text: "Free", contact_info: "quilt@example.org or 01957 755 123", ticket_url: "", cover_url: null,
  adult_confirmed: true, rows: [blankRow({ date: "2026-12-05", start: "14:00" })],
});

test("the confirmation wording is exactly the owner-specified sentence", () => {
  assert.equal(ADULT_CONFIRM_TEXT, "I confirm I am 18 or over and am authorised to submit this event.");
});

describe("whole form", () => {
  test("a good form becomes a clean payload", () => {
    const r = validateSubmission(good(), NOW, UID);
    assert.equal(r.ok, true);
    assert.equal(r.payload.organiser_name, "Unst Quilters");
    assert.equal(r.payload.ticket_url, null);
    assert.equal(r.payload.adult_confirmed, true);
    assert.equal(r.payload.category, "community");
    assert.deepEqual(r.payload.occurrences, [{ starts_at: "2026-12-05T14:00:00Z" }]);
    assert.equal(r.payload.contact_info, "quilt@example.org or 01957 755 123");
  });
  test("every required thing is asked for kindly", () => {
    const r = validateSubmission({ ...good(), organiser_name: "", title: " ", description: "", venue: "", adult_confirmed: false, rows: [] }, NOW, UID);
    assert.equal(r.ok, false);
    assert.deepEqual(r.order, ["organiser_name", "title", "description", "venue", "occurrences", "adult_confirmed"]);
    for (const m of Object.values(r.errors)) assert.doesNotMatch(m, /null|undefined|constraint|payload|violat/i);
  });
  test("no links, emails or phone numbers in the description", () => {
    for (const d of ["see https://x.org", "see www.example.com", "mail me a@b.co", "call 01957 755123", "ring +44 1957 755123", "visit oneshetland.co.uk today"]) {
      assert.equal(validateSubmission({ ...good(), description: d }, NOW, UID).ok, false, d);
    }
    assert.equal(validateSubmission({ ...good(), description: "Doors 7.30pm, tickets 12-11-2026 at £5" }, NOW, UID).ok, true);
  });
  test("contact details may hold an email and a phone, but not a link", () => {
    assert.equal(textProblem("a@b.org", true), null);
    assert.equal(textProblem("0800 123 4567", true), null);
    assert.equal(textProblem("https://x.org", true), "links");
  });
  test("ticket link must be https", () => {
    assert.match(checkField("ticket_url", "http://x.org/t").error, /https:\/\//);
    assert.match(checkField("ticket_url", "x.org").error, /https:\/\//);
    assert.equal(checkField("ticket_url", "https://tickets.example.org/e?id=1").error, undefined);
    assert.equal(checkField("ticket_url", "").value, null);
  });
  test("length limits are friendly", () => {
    assert.match(checkField("title", "x".repeat(201)).error, /200/);
    assert.match(checkField("description", "x".repeat(2001)).error, /2000/);
    assert.equal(checkField("title", "x".repeat(200)).error, undefined);
  });
  test("control characters are removed, description keeps its line breaks", () => {
    assert.equal(checkField("title", "Fair\u0000\u0007").value, "Fair");
    assert.equal(checkField("description", "a\r\nb").value, "a\nb");
  });
  test("a poster must be this person's own upload", () => {
    const ok = `https://nkrtmakxygkvxuxriiil.supabase.co/storage/v1/object/public/event-media/${UID}/events/cover-1.jpg`;
    assert.equal(validateSubmission({ ...good(), cover_url: ok }, NOW, UID).ok, true);
    assert.equal(validateSubmission({ ...good(), cover_url: ok.replace(UID, "99999999-2222-3333-4444-555555555555") }, NOW, UID).ok, false);
    assert.equal(validateSubmission({ ...good(), cover_url: "https://evil.example/x.jpg" }, NOW, UID).ok, false);
  });
  test("a malformed request id is caught before sending", () => {
    assert.equal(validateSubmission({ ...good(), request_id: "nope" }, NOW, UID).ok, false);
  });
  test("steps are checked on their own", () => {
    const f = { ...good(), title: "", rows: [] };
    assert.equal(validateStep(f, STEP_FIELDS.where, NOW, UID).ok, true);
    assert.deepEqual(validateStep(f, STEP_FIELDS.about, NOW, UID).order, ["title"]);
    assert.deepEqual(validateStep(f, STEP_FIELDS.when, NOW, UID).order, ["occurrences"]);
  });
});

test("poster file rules", () => {
  assert.equal(posterProblem({ type: "image/png", size: 1000 }), null);
  assert.match(posterProblem({ type: "image/gif", size: 1000 }), /JPG, PNG or WebP/);
  assert.match(posterProblem({ type: "image/jpeg", size: 11 * 1024 * 1024 }), /10 MB/);
  assert.equal(posterFileName("My Poster (1).HEIC", "image/webp", 5), "cover-5.webp");
  assert.match(posterFileName("../x", "image/jpeg", 7), /^cover-7\.jpg$/);
});

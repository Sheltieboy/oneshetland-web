/**
 * The typed client against a FAKE rpc layer: missing function, closed switch, validation, limits, idempotent retry, tolerant reads, poster upload.
 * Run: node --test --import ./tests/support/register.mjs tests/event-submissions-client.test.mjs
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import * as C from "../lib/event-submissions-client.ts";

/** A fake Supabase client: rpc replies are scripted per function; tables are arrays; every call is recorded. */
function fake({ rpc = {}, tables = {}, tableErrors = {}, storage } = {}) {
  const calls = [];
  const sb = {
    calls,
    rpc: async (fn, args) => {
      calls.push([fn, args]);
      const r = rpc[fn];
      if (r === undefined) return { data: null, error: { code: "PGRST202", message: `Could not find the function public.${fn} in the schema cache` }, status: 404 };
      if (r instanceof Error) throw r;
      return typeof r === "function" ? r(args, calls.filter((c) => c[0] === fn).length) : r;
    },
    from: (t) => {
      const q = { t, filters: [] };
      const chain = new Proxy({}, { get: (_, k) => {
        if (k === "then") return (res, rej) => {
          if (tableErrors[t]) return Promise.resolve({ data: null, error: tableErrors[t] }).then(res, rej);
          let rows = tables[t] ?? [];
          for (const [m, a, b] of q.filters) if (m === "eq") rows = rows.filter((r) => String(r[a]) === String(b)); else if (m === "in") rows = rows.filter((r) => b.includes(r[a]));
          return Promise.resolve({ data: rows, error: null }).then(res, rej);
        };
        return (...a) => { q.filters.push([k, ...a]); return chain; };
      } });
      return chain;
    },
    storage,
  };
  return sb;
}
const ok = (data) => ({ data, error: null });
const err = (code, message, hint) => ({ data: null, error: { code, message, hint } });

describe("error mapping", () => {
  test("missing function / table of every shape is 'unavailable'", () => {
    for (const e of [{ code: "PGRST202", message: "x" }, { code: "42883", message: "function does not exist" }, { code: "PGRST205", message: "x" }, { code: "42P01", message: "x" }, { message: "Could not find the function public.foo" }]) {
      assert.equal(C.mapError(e).kind, "unavailable", JSON.stringify(e));
    }
    assert.equal(C.mapError(null, 404).kind, "unavailable");
  });
  test("closed switch, sign in, forbidden, rules, limits, decided, restore window, past", () => {
    assert.equal(C.mapError({ code: "P0001", message: "Event submissions are not open yet.", hint: "closed" }).kind, "closed");
    assert.equal(C.mapError({ code: "42501", message: "Please sign in." }).kind, "signin");
    const f = C.mapError({ code: "42501", message: "You cannot change that performance" });
    assert.equal(f.kind, "forbidden"); assert.equal(f.message, "You cannot change that performance");
    const v = C.mapError({ code: "P0001", message: "Please fill in the title field.", hint: "title" });
    assert.deepEqual([v.kind, v.field], ["validation", "title"]);
    assert.equal(C.mapError({ code: "P0001", message: "You already have 3 submissions waiting", hint: "pending_limit" }).kind, "limit");
    assert.equal(C.mapError({ code: "P0001", message: "Already decided", hint: "decided" }).kind, "decided");
    assert.equal(C.mapError({ code: "P0001", message: "Too late", hint: "restore_window" }).kind, "restore_window");
    assert.equal(C.mapError({ code: "P0001", message: "Started", hint: "past" }).kind, "past");
  });
  test("technical messages are never shown", () => {
    const e = C.mapError({ code: "XX000", message: 'duplicate key value violates unique constraint "event_submissions_request_key"' });
    assert.equal(e.kind, "unknown"); assert.doesNotMatch(e.message, /constraint|duplicate|key/);
    assert.equal(C.mapError({ code: "22023", message: "Send the event as an object" }).kind, "unknown");
    assert.equal(C.mapError({ message: "TypeError: Failed to fetch" }).kind, "network");
  });
});

describe("master switch", () => {
  test("open / closed / missing", async () => {
    assert.deepEqual(await C.submissionsOpen(fake({ rpc: { event_submissions_open: ok(true) } })), { ok: true, data: true });
    assert.deepEqual(await C.submissionsOpen(fake({ rpc: { event_submissions_open: ok(false) } })), { ok: true, data: false });
    const m = await C.submissionsOpen(fake());
    assert.equal(m.ok, false); assert.equal(m.error.kind, "unavailable");
    assert.equal((await C.submissionsOpen(fake({ rpc: { event_submissions_open: ok("yes") } }))).ok, false);   // a surprising shape is an error, not a guess
  });
});

describe("submit", () => {
  const payload = { request_id: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee", title: "T" };
  test("sends the payload as the single argument and returns the id", async () => {
    const sb = fake({ rpc: { submit_event_submission: ok("11111111-1111-1111-1111-111111111111") } });
    const r = await C.submitEvent(sb, payload);
    assert.deepEqual(r, { ok: true, data: { id: "11111111-1111-1111-1111-111111111111" } });
    assert.deepEqual(sb.calls[0], ["submit_event_submission", { payload }]);
  });
  test("an idempotent retry (same request_id) gets the same id back", async () => {
    const sb = fake({ rpc: { submit_event_submission: () => ok("22222222-2222-2222-2222-222222222222") } });
    const a = await C.submitEvent(sb, payload), b = await C.submitEvent(sb, payload);
    assert.deepEqual(a, b);
    assert.equal(sb.calls.length, 2);
    assert.equal(sb.calls[0][1].payload.request_id, sb.calls[1][1].payload.request_id);
  });
  test("closed, validation (field kept), limit, missing, thrown network error", async () => {
    assert.equal((await C.submitEvent(fake({ rpc: { submit_event_submission: err("P0001", "Event submissions are not open yet.", "closed") } }), payload)).error.kind, "closed");
    const v = await C.submitEvent(fake({ rpc: { submit_event_submission: err("P0001", "Dates must be in the future.", "occurrences") } }), payload);
    assert.deepEqual([v.error.kind, v.error.field, v.error.message], ["validation", "occurrences", "Dates must be in the future."]);
    assert.equal((await C.submitEvent(fake({ rpc: { submit_event_submission: err("P0001", "3 waiting", "pending_limit") } }), payload)).error.kind, "limit");
    assert.equal((await C.submitEvent(fake(), payload)).error.kind, "unavailable");
    const n = await C.submitEvent(fake({ rpc: { submit_event_submission: new Error("Failed to fetch") } }), payload);
    assert.equal(n.error.kind, "network");
  });
});

describe("withdraw and my submissions", () => {
  test("withdraw", async () => {
    assert.deepEqual(await C.withdrawSubmission(fake({ rpc: { withdraw_event_submission: ok("withdrawn") } }), "x"), { ok: true, data: true });
    assert.equal((await C.withdrawSubmission(fake({ rpc: { withdraw_event_submission: err("P0001", "This submission has already been decided", "decided") } }), "x")).error.kind, "decided");
  });
  test("list shapes rows, drops garbage, and is tolerant of a missing table", async () => {
    const sb = fake({ tables: { event_submissions: [
      { id: "a", submitter_id: "u", status: "pending", title: "A", organiser_name: "G", occurrences: [{ starts_at: "2026-12-05T19:00:00Z" }, { nope: 1 }], created_at: "2026-11-06T10:00:00Z" },
      { id: "b", submitter_id: "u", status: "weird" }, { id: "c", submitter_id: "other", status: "pending" },
    ] } });
    const r = await C.listMySubmissions(sb, "u");
    assert.equal(r.ok, true); assert.equal(r.data.length, 1); assert.equal(r.data[0].occurrences.length, 1);
    assert.equal((await C.listMySubmissions(fake({ tableErrors: { event_submissions: { code: "42P01", message: "relation does not exist" } } }), "u")).error.kind, "unavailable");
  });
});

describe("staff", () => {
  test("review: reason required for reject / changes, none for approve, sent as the contract says", async () => {
    const sb = fake({ rpc: { admin_review_event_submission: ok({ id: "i", status: "approved", event_id: "e", duplicate: false }) } });
    assert.equal((await C.adminReviewSubmission(sb, "i", "reject", "  ")).error.field, "reason");
    assert.equal(sb.calls.length, 0);
    assert.equal((await C.adminReviewSubmission(sb, "i", "approve")).data.event_id, "e");
    assert.deepEqual(sb.calls[0], ["admin_review_event_submission", { p_id: "i", p_decision: "approve", p_reason: null }]);
    await C.adminReviewSubmission(sb, "i", "changes_requested", " fix the date ");
    assert.equal(sb.calls[1][1].p_reason, "fix the date");
    assert.equal((await C.adminReviewSubmission(sb, "i", "reject", "x".repeat(501))).ok, false);
  });
  test("counts and lists tolerate array or object and missing functions", async () => {
    assert.deepEqual((await C.adminSubmissionCounts(fake({ rpc: { admin_event_submission_counts: ok([{ pending: 2, changes_requested: 1, oldest_pending_at: "t" }]) } }))).data, { pending: 2, changes_requested: 1, oldest_pending_at: "t" });
    assert.equal((await C.adminSubmissionCounts(fake())).error.kind, "unavailable");
    const l = await C.adminListSubmissions(fake({ rpc: { admin_list_event_submissions: ok([{ id: "a", title: "T", organiser_name: "G", occurrence_count: 3 }]) } }), "pending", 20);
    assert.equal(l.data[0].occurrence_count, 3);
    assert.equal((await C.adminListSubmissions(fake({ rpc: { admin_list_event_submissions: err("42501", "Only OneShetland staff can do this") } }))).error.kind, "forbidden");
  });
  test("changes: review, trust, counts", async () => {
    const sb = fake({ rpc: { admin_review_event_change: ok({ id: "c", status: "approved", duplicate: false }), admin_set_organiser_trust: ok({ user_id: "u", trusted: true }), admin_event_change_counts: ok([{ pending: 4, auto_approved_7d: 2 }]) } });
    assert.equal((await C.adminReviewChange(sb, "c", "reject", "")).ok, false);
    assert.equal((await C.adminReviewChange(sb, "c", "approve")).data.status, "approved");
    assert.deepEqual((await C.adminSetTrust(sb, "u", true, "known to us")).data, { trusted: true });
    assert.deepEqual(sb.calls.at(-1), ["admin_set_organiser_trust", { p_user: "u", p_trusted: true, p_note: "known to us" }]);
    assert.deepEqual((await C.adminChangeCounts(sb)).data, { pending: 4, auto_approved_7d: 2 });
  });
});

describe("contributor self-service", () => {
  test("each action calls the right function with the right arguments", async () => {
    const sb = fake({ rpc: Object.fromEntries(["report_performance_cancelled", "report_performance_restored", "report_event_cancelled", "report_event_restored"].map((f) => [f, ok({ id: "i", status: "cancelled", duplicate: false })]).concat([["set_performance_note", ok({ id: "i", note: "n" })]])) });
    await C.reportPerformanceCancelled(sb, "o1", " Snow "); await C.reportPerformanceRestored(sb, "o1"); await C.reportEventCancelled(sb, "e1"); await C.reportEventRestored(sb, "e1"); await C.setPerformanceNote(sb, "o1", "  Matinee ");
    assert.deepEqual(sb.calls, [
      ["report_performance_cancelled", { p_occurrence: "o1", p_note: "Snow" }], ["report_performance_restored", { p_occurrence: "o1" }],
      ["report_event_cancelled", { p_event: "e1", p_note: null }], ["report_event_restored", { p_event: "e1" }], ["set_performance_note", { p_occurrence: "o1", p_note: "Matinee" }],
    ]);
  });
  test("restore after the window and past performances come back as their own kinds", async () => {
    assert.equal((await C.reportPerformanceRestored(fake({ rpc: { report_performance_restored: err("P0001", "This can only be undone within 24 hours", "restore_window") } }), "o")).error.kind, "restore_window");
    assert.equal((await C.reportPerformanceCancelled(fake({ rpc: { report_performance_cancelled: err("P0001", "already started", "past") } }), "o")).error.kind, "past");
    assert.equal((await C.reportEventCancelled(fake({ rpc: { report_event_cancelled: err("42501", "You cannot change that event") } }), "e")).error.kind, "forbidden");
  });
  test("change request tells the truth: pending vs auto_approved, and a duplicate retry", async () => {
    const pend = fake({ rpc: { request_event_change: ok({ id: "c", status: "pending", duplicate: false }) } });
    assert.equal((await C.requestChange(pend, "e", { venue: "V" }, "rq")).data.status, "pending");
    assert.deepEqual(pend.calls[0], ["request_event_change", { p_event: "e", p_payload: { venue: "V" }, p_request: "rq" }]);
    assert.equal((await C.requestChange(fake({ rpc: { request_event_change: ok({ id: "c", status: "auto_approved", duplicate: false }) } }), "e", {}, "rq")).data.status, "auto_approved");
    assert.equal((await C.requestChange(fake({ rpc: { request_event_change: ok({ id: "c", status: "pending", duplicate: true }) } }), "e", {}, "rq")).data.duplicate, true);
    assert.equal((await C.requestChange(fake({ rpc: { request_event_change: err("P0001", "Nothing has changed.", "no_change") } }), "e", {}, "rq")).error.field, "no_change");
    assert.equal((await C.requestChange(fake({ rpc: { request_event_change: err("P0001", "5 waiting", "pending_limit") } }), "e", {}, "rq")).error.kind, "limit");
  });
  test("loading the contributor view: parts degrade independently; not-yours is null", async () => {
    const tables = { event_submissions: [{ id: "s", submitter_id: "u", status: "approved", event_id: "e", title: "T", organiser_name: "G" }], events: [], event_occurrences: [{ id: "o", event_id: "e", starts_at: "2026-12-05T19:00:00Z", status: "cancelled" }] };
    const r = await C.loadContributorView(fake({ tables, tableErrors: { event_change_log: { code: "42P01", message: "x" } } }), "u", "e");
    assert.equal(r.ok, true); assert.equal(r.data.event, null); assert.equal(r.data.occurrences[0].status, "cancelled"); assert.equal(r.data.log, null); assert.deepEqual(r.data.changes, []);
    assert.deepEqual(await C.loadContributorView(fake({ tables }), "someone-else", "e"), { ok: true, data: null });
  });
});

describe("trusted organiser, and the contributor view with and without the new read policy", () => {
  test("true / false / unknown (missing function or a surprising answer is unknown, never a guess)", async () => {
    assert.equal(await C.myOrganiserTrusted(fake({ rpc: { my_event_organiser_trusted: ok(true) } })), true);
    assert.equal(await C.myOrganiserTrusted(fake({ rpc: { my_event_organiser_trusted: ok(false) } })), false);
    assert.equal(await C.myOrganiserTrusted(fake()), null);
    assert.equal(await C.myOrganiserTrusted(fake({ rpc: { my_event_organiser_trusted: ok("yes") } })), null);
    assert.equal(await C.myOrganiserTrusted(fake({ rpc: { my_event_organiser_trusted: err("42501", "Please sign in.") } })), null);
  });
  const tables = { event_submissions: [{ id: "s", submitter_id: "u", status: "approved", event_id: "e", title: "T", organiser_name: "G" }], events: [{ id: "e", title: "Fair", status: "cancelled" }], event_occurrences: [{ id: "o", event_id: "e", starts_at: "2026-12-05T19:00:00Z", status: "scheduled" }] };
  test("with the policy the hidden event and its dates load, and trusted comes through", async () => {
    const r = await C.loadContributorView(fake({ tables, rpc: { my_event_organiser_trusted: ok(true) } }), "u", "e");
    assert.equal(r.data.event.status, "cancelled"); assert.equal(r.data.occurrences.length, 1); assert.equal(r.data.trusted, true);
  });
  test("without the policy (event unreadable) and without the function it still loads from the submission, trusted unknown", async () => {
    const r = await C.loadContributorView(fake({ tables: { ...tables, events: [], event_occurrences: [] } }), "u", "e");
    assert.equal(r.ok, true); assert.equal(r.data.event, null); assert.equal(r.data.trusted, null); assert.equal(r.data.submission.id, "s");
  });
});

describe("poster upload", () => {
  const file = { name: "p.png", type: "image/png", size: 1000 };
  const storage = (log, fail) => ({ from: (b) => ({ upload: async (path, f, o) => { log.push([b, path, o]); return { error: fail ? { message: "x" } : null }; }, getPublicUrl: (p) => ({ data: { publicUrl: `https://nkrtmakxygkvxuxriiil.supabase.co/storage/v1/object/public/event-media/${p}` } }) }) });
  test("goes to <uid>/events/<file> in event-media and returns the public URL the database accepts", async () => {
    const log = [];
    const r = await C.uploadPoster(fake({ storage: storage(log) }), "U1", file, 99);
    assert.deepEqual(log[0].slice(0, 2), ["event-media", "U1/events/cover-99.png"]);
    assert.equal(r.data, "https://nkrtmakxygkvxuxriiil.supabase.co/storage/v1/object/public/event-media/U1/events/cover-99.png");
  });
  test("refuses bad files before uploading, and reports a failed upload kindly", async () => {
    const log = [];
    assert.equal((await C.uploadPoster(fake({ storage: storage(log) }), "U1", { ...file, type: "application/pdf" })).ok, false);
    assert.equal(log.length, 0);
    const f = await C.uploadPoster(fake({ storage: storage([], true) }), "U1", file);
    assert.equal(f.ok, false); assert.match(f.error.message, /try again/);
  });
});

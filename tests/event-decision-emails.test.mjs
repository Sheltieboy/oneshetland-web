/** Contributor decision emails: the admin screen calls the notify function only after a successful, non-duplicate review, and reports honestly. */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { notifyEventDecision } from "../lib/event-submissions-client.ts";

const read = (p) => readFileSync(p, "utf8");
describe("notifyEventDecision", () => {
  test("invokes the function with only the submission id and reports emailed only when the server says exactly 1", async () => {
    const calls = [];
    const sb = (data, error) => ({ functions: { invoke: async (n, o) => { calls.push([n, o]); return { data, error }; } } });
    assert.deepEqual(await notifyEventDecision(sb({ emailed: 1 }, null), "s1"), { emailed: true });
    assert.deepEqual(calls[0], ["notify-event-submission", { body: { submission_id: "s1" } }]);
    assert.deepEqual(await notifyEventDecision(sb({ emailed: 0, reason: "opted_out" }, null), "s1"), { emailed: false });
    assert.deepEqual(await notifyEventDecision(sb({ emailed: 1 }, { message: "boom" }), "s1"), { emailed: false });
    assert.deepEqual(await notifyEventDecision(sb(null, null), "s1"), { emailed: false });
  });
  test("never throws and never blocks: a thrown error or a missing client is just 'not emailed'", async () => {
    assert.deepEqual(await notifyEventDecision({ functions: { invoke: async () => { throw new Error("network"); } } }, "s1"), { emailed: false });
    assert.deepEqual(await notifyEventDecision({}, "s1"), { emailed: false });
  });
});

describe("admin queue wiring", () => {
  const src = read("components/admin/EventSubmissionsQueue.tsx");
  test("emails only after the review succeeded and not for a repeated approval", () => {
    assert.match(src, /const mailed = r\.ok && !r\.data\.duplicate \? \(await notifyEventDecision\(sb, s\.id\)\)\.emailed : false;/);
    assert.ok(src.indexOf("adminReviewSubmission(sb") < src.indexOf("notifyEventDecision(sb"));
  });
  test("the staff message says the member was emailed only when it really happened", () => {
    assert.match(src, /mailed \? " The member has been emailed\." : " The member was not emailed/);
  });
});

/**
 * Controlled acceptance testing: an allowlisted TESTER may reach the otherwise hidden submission pages without the public flag. The tester
 * check can only WIDEN access for an allowlisted signed-in account; the public flag, the admin preview and the 404 for everyone else are unchanged.
 * Run: node --test --import ./tests/support/register.mjs tests/event-testers-gate.test.mjs
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { frontDoorAccess } from "../lib/event-front-door.ts";
import { isSubmissionTester } from "../lib/event-submissions-client.ts";

describe("frontDoorAccess", () => {
  test("the public flag still opens it, an admin still previews it, everyone else is hidden", () => {
    assert.equal(frontDoorAccess({ flag: "on", isStaff: false }), "open");
    assert.equal(frontDoorAccess({ flag: "on", isStaff: false, isTester: true }), "open");
    assert.equal(frontDoorAccess({ flag: undefined, isStaff: true }), "staff_preview");
    assert.equal(frontDoorAccess({ flag: undefined, isStaff: true, isTester: true }), "staff_preview");
    for (const f of [undefined, null, "", "ON", "true", "1", "off", " on", "testers"]) assert.equal(frontDoorAccess({ flag: f, isStaff: false }), "hidden", String(f));
  });
  test("an allowlisted tester (and only a tester) gets in without the flag", () => {
    assert.equal(frontDoorAccess({ flag: undefined, isStaff: false, isTester: true }), "tester");
    assert.equal(frontDoorAccess({ flag: "off", isStaff: false, isTester: true }), "tester");
    for (const t of [false, undefined, null, "true", 1, "yes"]) assert.equal(frontDoorAccess({ flag: undefined, isStaff: false, isTester: t }), "hidden", String(t));
  });
});

describe("isSubmissionTester (tolerant: only a literal true from the database widens access)", () => {
  const sb = (reply) => ({ rpc: async (fn) => { sb.called = fn; if (reply instanceof Error) throw reply; return reply; } });
  test("true only for a literal boolean true", async () => {
    assert.equal(await isSubmissionTester(sb({ data: true, error: null })), true);
    assert.equal(sb.called, "event_submissions_tester");
    for (const data of [false, null, undefined, "true", 1, {}, []]) assert.equal(await isSubmissionTester(sb({ data, error: null })), false, JSON.stringify(data));
  });
  test("the function missing (migration not applied), a permission error, a server error and a network failure all mean 'not a tester'", async () => {
    assert.equal(await isSubmissionTester(sb({ data: null, error: { code: "PGRST202", message: "Could not find the function public.event_submissions_tester" }, status: 404 })), false);
    assert.equal(await isSubmissionTester(sb({ data: null, error: { code: "42501", message: "permission denied for function event_submissions_tester" }, status: 403 })), false);
    assert.equal(await isSubmissionTester(sb({ data: null, error: { message: "boom" }, status: 500 })), false);
    assert.equal(await isSubmissionTester(sb(new Error("network down"))), false);
  });
});

describe("the gate wiring (source level)", () => {
  const gate = readFileSync(new URL("../lib/event-submissions-access.server.ts", import.meta.url), "utf8");
  test("the tester check runs only for a signed-in non-admin while the public flag is off, and a hidden result is a 404", () => {
    assert.match(gate, /const isTester = flag === "on" \|\| isStaff \|\| !account \? false : await isSubmissionTester\(await serverSb\(\)\);/);
    assert.match(gate, /if \(access === "hidden"\) notFound\(\);/);
    assert.match(gate, /frontDoorAccess\(\{ flag, isStaff, isTester \}\)/);
  });
  test("the public entry points still depend ONLY on the flag: a tester is not shown links (they use the direct address)", () => {
    const entry = readFileSync(new URL("../lib/event-entry-points.ts", import.meta.url), "utf8");
    assert.match(entry, /EVENT_FRONT_DOOR === "on"/);
    assert.doesNotMatch(entry, /tester|isSubmissionTester|rpc\(/i);
  });
});

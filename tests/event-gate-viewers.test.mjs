/**
 * WHO CAN SEE THE SUBMISSION PAGES: the REAL gateFeature / gateFeatureSignedIn run against every kind of viewer (signed out, ordinary member,
 * allowlisted tester, admin) with the public flag off and on. Only the fake Supabase client and the next/navigation stubs are substituted
 * (notFound and redirect throw recognisable errors). This is the executable answer to "can an admin preview the front door while the public
 * flag is off?": YES (while entry-point LINKS stay hidden for everyone, admins included).
 * Run: node --test --import ./tests/support/register.mjs tests/event-gate-viewers.test.mjs
 */
import { test, describe, beforeEach, after } from "node:test";
import assert from "node:assert/strict";
import fake, { setDb } from "./support/fake-supabase.mjs";
import { gateFeature, gateFeatureSignedIn } from "../lib/event-submissions-access.server.ts";
import { entryPointsEnabled } from "../lib/event-entry-points.ts";

const ORIGINAL = process.env.EVENT_FRONT_DOOR;
const flag = (v) => { if (v === undefined) delete process.env.EVENT_FRONT_DOOR; else process.env.EVENT_FRONT_DOOR = v; };
after(() => { flag(ORIGINAL); fake.auth.getUser = async () => ({ data: { user: null } }); delete globalThis.__FAKE_RPC__; });

const ADMIN = { id: "a-1", email: "darren@oneshetland.example" }, MEMBER = { id: "m-1", email: "member@example.org" }, TESTER = { id: "t-1", email: "tester@example.org" };
let rpcCalls;
/** viewer: null (signed out) | a user. testerIds: ids the database would report as allowlisted. rpc: override the database function. */
function as(user, { testerIds = [], rpc } = {}) {
  rpcCalls = [];
  setDb({ profiles: [{ id: ADMIN.id, role: "admin" }, { id: MEMBER.id, role: "customer" }, { id: TESTER.id, role: "customer" }] });
  fake.auth.getUser = async () => ({ data: { user } });
  globalThis.__FAKE_RPC__ = async (fn) => { rpcCalls.push(fn); if (rpc) return rpc(fn); return fn === "event_submissions_tester" ? { data: testerIds.includes(user?.id), error: null } : { data: null, error: null }; };
}
const run = async (fn) => { try { return await fn(); } catch (e) { return { threw: e.message }; } };
beforeEach(() => flag(undefined));

describe("public flag OFF (today)", () => {
  test("signed out: 404, and the database is never asked", async () => {
    as(null); assert.deepEqual(await run(gateFeature), { threw: "notFound" }); assert.deepEqual(rpcCalls, []);
  });
  test("an ORDINARY signed-in member: 404 (the journey does not exist for them yet)", async () => {
    as(MEMBER); assert.deepEqual(await run(gateFeature), { threw: "notFound" });
    assert.deepEqual(rpcCalls, ["event_submissions_tester"], "one tester check, nothing else");
    assert.deepEqual(await run(() => gateFeatureSignedIn("/account/event-submissions")), { threw: "notFound" }, "the member pages too");
  });
  test("an ADMIN can preview the front door (staff_preview) without asking the tester function", async () => {
    as(ADMIN); const g = await gateFeature(); assert.equal(g.access, "staff_preview"); assert.equal(g.account.id, ADMIN.id); assert.deepEqual(rpcCalls, []);
    const s = await gateFeatureSignedIn("/whats-on/add"); assert.equal(s.access, "staff_preview");
  });
  test("an allowlisted TESTER gets in (tester); an unlisted member beside them does not", async () => {
    as(TESTER, { testerIds: [TESTER.id] }); assert.equal((await gateFeature()).access, "tester");
    as(MEMBER, { testerIds: [TESTER.id] }); assert.deepEqual(await run(gateFeature), { threw: "notFound" });
  });
  test("the tester function missing (migration absent), erroring or throwing: still 404 for a member, never a crash and never access", async () => {
    as(MEMBER, { rpc: () => ({ data: null, error: { code: "PGRST202", message: "Could not find the function" }, status: 404 }) });
    assert.deepEqual(await run(gateFeature), { threw: "notFound" });
    as(MEMBER, { rpc: () => ({ data: null, error: { message: "boom" }, status: 500 }) }); assert.deepEqual(await run(gateFeature), { threw: "notFound" });
    as(MEMBER, { rpc: () => { throw new Error("network down"); } }); assert.deepEqual(await run(gateFeature), { threw: "notFound" });
  });
  test("a non-boolean answer is not 'yes'", async () => {
    for (const data of ["true", 1, {}, null]) { as(TESTER, { rpc: () => ({ data, error: null }) }); assert.deepEqual(await run(gateFeature), { threw: "notFound" }, JSON.stringify(data)); }
  });
});

describe("public flag ON", () => {
  test("everyone gets in as 'open': signed out (to be sent to sign-in by the page), member, admin; the database is not asked", async () => {
    flag("on");
    for (const u of [null, MEMBER, ADMIN, TESTER]) { as(u); const g = await gateFeature(); assert.equal(g.access, "open", String(u?.id)); assert.deepEqual(rpcCalls, []); }
    as(null); assert.deepEqual(await run(() => gateFeatureSignedIn("/whats-on/add")), { threw: "redirect" }, "signed out is sent to sign in");
  });
  test("only the exact value 'on' counts", async () => {
    for (const f of ["ON", "true", "1", "yes", " on", "testers", ""]) { flag(f); as(MEMBER); assert.deepEqual(await run(gateFeature), { threw: "notFound" }, f); }
  });
});

describe("entry-point LINKS are a separate thing: flag only, for everyone including admins", () => {
  test("with the flag off no link appears even though an admin can open the page directly", () => {
    flag(undefined); assert.equal(entryPointsEnabled(), false);
    flag("testers"); assert.equal(entryPointsEnabled(), false);
    flag("on"); assert.equal(entryPointsEnabled(), true);
  });
});

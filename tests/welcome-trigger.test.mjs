import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { startsWelcome, WELCOME_TYPES, WELCOME_TIMEOUT_MS, triggerWelcome } from "../lib/welcome.server.ts";

const route = readFileSync(new URL("../app/auth/callback/route.ts", import.meta.url), "utf8");

test("only an email-confirmation link starts a welcome", () => {
  assert.equal(startsWelcome("signup", false), true);
  assert.equal(startsWelcome("email", false), true);
  assert.equal(startsWelcome(null, true), true);          // the PKCE code form
  for (const t of ["magiclink", "recovery", "invite", "email_change", null, "x"]) assert.equal(startsWelcome(t, false), false, String(t));
  assert.deepEqual([...WELCOME_TYPES], ["signup", "email"]);
});
test("it passes no recipient, template or content, and waits at most 2.5 s", async () => {
  let args;
  const sb = { functions: { invoke: async (...a) => { args = a; return { data: {} }; } } };
  await triggerWelcome(sb, "signup", false);
  assert.deepEqual(args, ["send-welcome", { body: {} }]); assert.equal(WELCOME_TIMEOUT_MS, 2500);
});
test("a slow function cannot hold up sign-in, and a throwing one cannot break it", async () => {
  const slow = { functions: { invoke: () => new Promise(() => {}) } };
  const t = Date.now(); await triggerWelcome(slow, "email", false); assert.ok(Date.now() - t < 4000);
  await triggerWelcome({ functions: { invoke: async () => { throw new Error("down"); } } }, "email", false);   // resolves
  const calls = []; await triggerWelcome({ functions: { invoke: async () => { calls.push(1); } } }, "magiclink", false); assert.equal(calls.length, 0);
});
test("the callback calls it after consent is recorded, in both confirmation paths, before the redirect", () => {
  assert.match(route, /await triggerWelcome\(sb, type, false\)/); assert.match(route, /await triggerWelcome\(sb, null, true\)/);
  const a = route.indexOf("recordSignupConsent(sb, user)"); assert.ok(route.indexOf("triggerWelcome(sb, type, false)") > a);
  // the sign-in failure branches do not send anything
  assert.equal((route.match(/triggerWelcome/g) || []).length, 3); // import + two calls
});

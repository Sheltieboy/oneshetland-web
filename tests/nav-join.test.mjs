import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const header = readFileSync(new URL("../components/site/SiteHeader.tsx", import.meta.url), "utf8");
const signIn = readFileSync(new URL("../app/sign-in/page.tsx", import.meta.url), "utf8");

test("both logged-out header buttons (desktop bar and mobile menu) say 'Join / Sign in'", () => {
  assert.equal((header.match(/Join \/ Sign in/g) || []).length, 2);
  assert.doesNotMatch(header, />\s*Sign in\s*</);
});
test("destination and styling are unchanged: the same /sign-in link with the return path", () => {
  assert.equal((header.match(/href=\{`\/sign-in\?next=\$\{encodeURIComponent\(pathname\)\}`\}/g) || []).length, 2);
  assert.match(header, /hidden rounded-pill border border-line-strong px-4 py-2 text-sm font-semibold text-ink transition-colors hover:bg-sand sm:inline-flex/);
  assert.match(header, /mt-2 rounded-pill bg-navy px-4 py-3 text-center text-base font-semibold text-paper/);
});
test("the destination clearly supports creating an account as well as signing in", () => {
  assert.match(signIn, /\/sign-up/); assert.match(signIn, /Create an account/);
});

test("sign-in page: 'Create an account' is a full-width outlined button directly under the navy Sign in button; the old text link is gone", () => {
  const submitAt = signIn.indexOf('{busy ? "Signing in…" : "Sign in"}');
  const createAt = signIn.indexOf("Create an account");
  assert.ok(submitAt > 0 && createAt > submitAt && createAt - submitAt < 900, "Create an account directly follows the Sign in button");
  assert.doesNotMatch(signIn, /New to OneShetland\?/);
  assert.equal((signIn.match(/Create an account/g) || []).length, 1);
  assert.match(signIn, /rounded-pill border border-navy bg-navy px-5 py-3 font-semibold text-paper/);        // the navy Sign in button looks the same (its border is navy too, so both buttons are exactly the same height)
  assert.match(signIn, /min-h-\[48px\] w-full items-center justify-center rounded-pill border border-navy/); // outlined, full width
  assert.equal((signIn.match(/min-h-\[48px\]/g) || []).length, 2);                                        // both equally easy to tap
  assert.match(signIn, /href=\{params\.get\("next"\) \? `\/sign-up\?next=\$\{encodeURIComponent\(next\)\}` : "\/sign-up"\}/); // destination + redirect unchanged
});
test("authentication behaviour is untouched: the submit handler and its guards are as before", () => {
  assert.match(signIn, /<form onSubmit=\{submit\}/); assert.match(signIn, /disabled=\{busy \|\| !captchaToken\}/);
});

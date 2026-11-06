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
  assert.match(signIn, /New to OneShetland\?/); assert.match(signIn, /\/sign-up/); assert.match(signIn, /Create an account/);
});

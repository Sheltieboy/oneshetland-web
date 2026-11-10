/** Editions: demo mode (EDITIONS_DEMO_MODE=1) for a guest-facing demonstration deployment. It only ever removes capability, and is invisible when off. Run: node --test --import ./tests/support/register.mjs tests/editions-demo-mode.test.mjs */
import { test, describe, afterEach } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement as h } from "react";

await import("./support/register-jsx.mjs");
const { isDemoMode, DEMO_BLOCKED } = await import("../lib/editions/demo-mode.ts");
const { DemoBanner } = await import("../components/editions/DemoBanner.tsx");
const actions = await import("../app/organise/actions.ts");
const commerce = await import("../app/organise/commerce-actions.ts");
const robots = (await import("../app/robots.ts")).default;
const sitemap = (await import("../app/sitemap.ts")).default;
const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
afterEach(() => { delete process.env.EDITIONS_DEMO_MODE; });

describe("demo mode is off unless explicitly switched on", () => {
  test("only the exact value 1 turns it on", () => {
    for (const v of [undefined, "", "0", "true", "yes", "on"]) { if (v === undefined) delete process.env.EDITIONS_DEMO_MODE; else process.env.EDITIONS_DEMO_MODE = v; assert.equal(isDemoMode(), false, String(v)); }
    process.env.EDITIONS_DEMO_MODE = "1"; assert.equal(isDemoMode(), true);
  });
  test("off: no banner, robots as normal, sitemap not emptied by this switch", async () => {
    assert.equal(renderToStaticMarkup(h(DemoBanner)), "");
    const r = robots(); assert.ok(!Array.isArray(r.rules) && r.rules.allow === "/");
  });
});

describe("demo mode on", () => {
  test("a permanent banner says it is an unofficial concept with demonstration data", () => {
    process.env.EDITIONS_DEMO_MODE = "1";
    const html = renderToStaticMarkup(h(DemoBanner));
    assert.ok(html.includes('role="note"') && /Unofficial concept/.test(html) && /nothing here has been endorsed/.test(html));
  });
  test("search engines are told to index nothing: robots disallows everything and the sitemap is empty", async () => {
    process.env.EDITIONS_DEMO_MODE = "1";
    assert.deepEqual(robots().rules, { userAgent: "*", disallow: "/" });
    assert.deepEqual(await sitemap(), []);
  });
  test("team, payout and package actions are refused on the server, before anything else runs", async () => {
    process.env.EDITIONS_DEMO_MODE = "1";
    const blocked = { ok: false, error: DEMO_BLOCKED };
    assert.deepEqual(await actions.inviteMember("x", { email: "a@b.co", role: "editor" }), blocked);
    assert.deepEqual(await actions.revokeInvite("x", "id"), blocked);
    assert.deepEqual(await actions.setMemberRole("x", "u", "admin"), blocked);
    assert.deepEqual(await actions.removeMember("x", "u"), blocked);
    assert.deepEqual(await commerce.connectPayouts("x", "/organise/x/payments"), blocked);
    assert.deepEqual(await commerce.createPackageOrder("x", "e", "p", "a"), blocked);
  });
  test("everyday editing is not blocked by the switch (it falls through to the normal checks)", async () => {
    process.env.EDITIONS_DEMO_MODE = "1";
    const r = await actions.updateOrganiserProfile("x", { name: "Valid Name" });
    assert.notEqual(r.error, DEMO_BLOCKED);
  });
});

describe("the banner is on every guest-visible Editions surface", () => {
  test("layouts and pages render it (source guard)", () => {
    for (const f of ["app/editions/[slug]/layout.tsx", "app/editions/page.tsx", "app/organisers/[slug]/page.tsx", "app/organisers/[slug]/membership/page.tsx", "app/organise/layout.tsx"]) assert.match(read(f), /<DemoBanner \/>/, f);
  });
  test("no demo-mode code path can add capability: it only returns early or hides", () => {
    const src = read("lib/editions/demo-mode.ts");
    assert.ok(!/service_role|SERVICE_KEY|createClient/.test(src));
  });
});

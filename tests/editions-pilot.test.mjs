/**
 * Editions controlled pilot (web). Pilot pages are reachable by direct link only: never indexed, never in the sitemap, until Editions is opened to everyone. Every pilot admin
 * action is administrator-only and goes through the database functions; nothing on the web side can open registration or payments. Pure rules plus source guards; no network.
 * Run: node --test --import ./tests/support/register-jsx.mjs tests/editions-pilot.test.mjs
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const SEO = await import("../lib/editions/seo.ts");
const H = await import("../app/admin/editions/helpers.ts");
const { previewReason } = await import("../components/editions/PreviewBanner.tsx");

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => readFileSync(join(ROOT, p), "utf8");
const BUNDLE = { edition: { slug: "zz-pilot", title: "ZZ Pilot", summary: "x", description: null, status: "published", is_test: false }, organiser: { name: "ZZ Org" } };

describe("search engines: pilot pages are direct-link only", () => {
  test("while Editions is not open to everyone, every Edition page says noindex,nofollow", () => {
    for (const open of [undefined, false]) assert.deepEqual(SEO.editionMetadata(BUNDLE, { openToEveryone: open }).robots, { index: false, follow: false });
    assert.deepEqual(SEO.editionMetadata(BUNDLE, {}).robots, { index: false, follow: false }, "fails closed when the flag is not supplied");
  });
  test("once Editions is open, a published non-test Edition is indexable again; drafts and tests never are", () => {
    assert.equal(SEO.editionMetadata(BUNDLE, { openToEveryone: true }).robots, undefined);
    assert.deepEqual(SEO.editionMetadata({ ...BUNDLE, edition: { ...BUNDLE.edition, status: "draft" } }, { openToEveryone: true }).robots, { index: false, follow: false });
    assert.deepEqual(SEO.editionMetadata({ ...BUNDLE, edition: { ...BUNDLE.edition, is_test: true } }, { openToEveryone: true }).robots, { index: false, follow: false });
  });
  test("every public Edition page and the organiser page read the flag for their robots", () => {
    for (const f of ["app/editions/[slug]/page.tsx", "app/editions/[slug]/programme/page.tsx", "app/editions/[slug]/programme/[item]/page.tsx", "app/editions/[slug]/partners/page.tsx", "app/editions/[slug]/updates/page.tsx", "app/editions/[slug]/[page]/page.tsx"]) {
      const s = read(f);
      const calls = s.match(/editionMetadata\(/g)?.length ?? 0;
      assert.ok(calls >= 1, f);
      assert.equal((s.match(/openToEveryone: await getEditionsEnabled\(\)/g) ?? []).length, calls, `${f}: every editionMetadata call passes the flag`);
    }
    assert.match(read("app/organisers/[slug]/page.tsx"), /\(await getEditionsEnabled\(\)\)/);
  });
  test("the calendar files carry X-Robots-Tag while pilot-only", () => {
    for (const f of ["app/editions/[slug]/calendar.ics/route.ts", "app/editions/[slug]/programme/[item]/calendar.ics/route.ts"]) assert.match(read(f), /X-Robots-Tag": "noindex, nofollow"/, f);
  });
});

describe("the sitemap leaves pilot Editions out", () => {
  const s = read("app/sitemap.ts");
  test("Editions, organisers and sessions are only fetched when editions.enabled is on, and the flag read fails closed", () => {
    assert.match(s, /const editionsOpen = await \(async \(\) => \{ try \{ const \{ data, error \} = await publicClient\(\)\.rpc\("editions_enabled"\); return !error && data === true; \} catch \{ return false; \} \}\)\(\);/);
    for (const t of ["editions", "edition_organisers", "edition_sessions"]) assert.match(s, new RegExp(`editionsOpen \\? rowsFiltered\\("${t}"`), t);
    assert.doesNotMatch(s, /editions_pilot|edition_pilot/, "the sitemap never consults the pilot");
  });
});

describe("the preview banner and the public pages understand pilot visibility", () => {
  test("the layout asks the database whether the organiser is visible through the pilot, and only then treats Editions as on", () => {
    const l = read("app/editions/[slug]/layout.tsx");
    assert.match(l, /rpc\("edition_pilot_visible", \{ p_org: organiser\.id \}\)/);
    assert.match(l, /previewReason\(\{ edition, enabled: publiclyOn, entitled \}\)/);
  });
  test("a published, entitled pilot Edition shows no preview banner to its team; an unentitled or draft one still does", () => {
    const e = { status: "published", is_test: false, suspended_reason: null };
    assert.equal(previewReason({ edition: e, enabled: true, entitled: true }), null);
    assert.equal(previewReason({ edition: e, enabled: false, entitled: true }).key, "disabled");
    assert.equal(previewReason({ edition: e, enabled: true, entitled: false }).key, "unentitled");
    assert.equal(previewReason({ edition: { ...e, status: "draft" }, enabled: true, entitled: true }).key, "draft");
  });
  test("the /editions index and the membership page stay closed unless Editions is open or the visitor is on a team", () => {
    assert.match(read("app/editions/page.tsx"), /if \(!\(await getEditionsEnabled\(\)\) && !\(await getEditionsAccess\(\)\)\.allowed\) notFound\(\)/);
    assert.match(read("app/organisers/[slug]/membership/page.tsx"), /if \(!\(await getEditionsEnabled\(\)\) && !\(await getEditionsAccess\(\)\)\.allowed\) notFound\(\)/);
  });
  test("getEditionsEnabled still reads only editions_enabled (the pilot never counts as 'open to everyone')", () => {
    const d = read("lib/editions/data.server.ts");
    assert.match(d, /rpc\("editions_enabled"\)/);
    assert.doesNotMatch(d, /editions_pilot|edition_pilot_visible/);
  });
});

describe("administrator-only pilot actions", () => {
  const a = read("app/admin/editions/actions.ts");
  const names = ["setPilotSwitchAction", "setupHubOrganiserAction", "approvePilotAction", "revokePilotAction", "grantPilotPublishAction"];
  const body = (n) => { const i = a.indexOf(`export async function ${n}`); const j = a.indexOf("\nexport async function", i + 10); return a.slice(i, j === -1 ? undefined : j); };
  test("each starts with requireAdmin() and calls exactly its database function; no service key, no direct table write", () => {
    const rpc = { setPilotSwitchAction: "admin_set_editions_pilot", setupHubOrganiserAction: "admin_create_edition_organiser_for_hub", approvePilotAction: "admin_approve_edition_pilot", revokePilotAction: "admin_revoke_edition_pilot", grantPilotPublishAction: "admin_grant_edition_pilot_publish" };
    for (const n of names) {
      const b = body(n);
      assert.match(b, /^export async function [^\n]*\n  await requireAdmin\(\);/, `${n} requires an administrator first`);
      assert.equal((b.match(/\.rpc\("/g) ?? []).length, 1, n); assert.match(b, new RegExp(`rpc\\("${rpc[n]}"`), n);
      assert.doesNotMatch(b, /\.from\(|service|SERVICE/, n);
    }
  });
  test("the web side cannot open registration or payments: it never writes editions.enabled or the commerce flag in the pilot actions", () => {
    for (const n of names) assert.doesNotMatch(body(n), /editions\.enabled|commerce/, n);
  });
  test("renewal is a fixed 90 days (the database also caps it); notes and reasons need five characters before a call is made", () => {
    assert.match(body("grantPilotPublishAction"), /p_days: 90/);
    for (const n of ["approvePilotAction", "revokePilotAction", "grantPilotPublishAction"]) assert.match(body(n), /length < 5/, n);
  });
  test("web address and Hub id are validated before the call", () => {
    assert.equal(H.isPilotSlug("your-hub-festivals"), true);
    for (const bad of ["ab", "Bad Slug", "-x-", "a".repeat(61), "has_underscore", ""]) assert.equal(H.isPilotSlug(bad), false, bad);
    assert.match(body("setupHubOrganiserAction"), /isUuid\(hub\)/);
  });
  test("the database's pilot refusals reach the administrator in words", () => {
    for (const m of ["the Hub must be verified by a OneShetland administrator first", "already approved for the pilot", "the organiser is not approved for the pilot", "this Edition already has a pilot grant running for more than 30 days", "a pilot grant is 1 to 90 days"]) assert.equal(H.adminError(m), m);
  });
  test("a Pilot tab exists in the admin area, and the pilot pages read approvals only as the signed-in administrator", () => {
    assert.ok(H.TABS.some((t) => t.key === "pilot"));
    assert.equal(H.parseTab("pilot"), "pilot");
    const p = read("app/admin/editions/page.tsx");
    assert.match(p, /async function Pilot\(\)/); assert.match(p, /\.from\("edition_pilot_approvals"\)/);
    assert.doesNotMatch(p, /service|SERVICE/);
    assert.match(read("app/admin/layout.tsx"), /(requireAdmin|isAdmin|admin)/i, "the whole admin area sits behind the admin layout");
  });
});

describe("nothing else moved", () => {
  test("registration stays closed on the web: the organiser gate and the Hub entry still depend on the open flag, staff or an existing organiser", () => {
    const d = read("lib/editions/data.server.ts");
    assert.match(d, /allowed: enabled \|\| isStaff \|\| isMember/);
    assert.match(d, /const show = !!row && \(access\.enabled \|\| access\.staff \|\| !!row\.organiser_id\)/);
  });
  test("no new public route, no new environment variable, no service-role import in the Editions web code", () => {
    const sm = read("app/sitemap.ts");
    assert.doesNotMatch(sm, /editions_pilot|edition_pilot/);
    for (const f of ["app/admin/editions/actions.ts", "components/admin/EditionsAdminForms.tsx", "app/admin/editions/page.tsx"]) assert.doesNotMatch(read(f), /SUPABASE_SERVICE|service_role|createServiceClient/i, f);
  });
});

describe("Hub verification from the admin area (no database edits)", () => {
  const a = read("app/admin/editions/actions.ts");
  const i = a.indexOf("export async function setHubVerifiedAction");
  const b = a.slice(i);
  test("administrator-only: requireAdmin first, exactly one database function, no table write, a note of five characters", () => {
    assert.match(b, /^export async function setHubVerifiedAction[^\n]*\n  await requireAdmin\(\);/);
    assert.equal((b.match(/\.rpc\("/g) ?? []).length, 1); assert.match(b, /rpc\("admin_set_hub_verified"/);
    assert.doesNotMatch(b, /\.from\(|\.update\(|service|SERVICE/);
    assert.match(b, /length < 5/); assert.match(b, /isUuid\(input\.hubId\)/);
  });
  test("the Pilot tab lists active Hubs with verify / remove, the organiser page offers it when the Hub is not verified, and nothing writes hubs directly", () => {
    const p = read("app/admin/editions/page.tsx");
    assert.match(p, /Verify a Hub/); assert.match(p, /HubVerifyForm/);
    assert.match(read("app/admin/editions/organisers/[id]/page.tsx"), /!hub\.is_verified && <div className="my-3"><HubVerifyForm/);
    for (const f of ["app/admin/editions/page.tsx", "app/admin/editions/actions.ts", "components/admin/EditionsAdminForms.tsx"]) assert.doesNotMatch(read(f), /from\("hubs"\)\s*\.(update|insert|upsert|delete)/, f);
  });
  test("the warning that verification affects the calendar is shown, and the database's refusals read in words", () => {
    assert.match(read("app/admin/editions/page.tsx"), /calendar-approved without review/);
    assert.equal(H.adminError("the Hub is already in that state"), "the Hub is already in that state");
  });
});

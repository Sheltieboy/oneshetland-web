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
      assert.match(b, /^export async function [^\n]*\n  (const admin = )?await requireAdmin\(\);/, `${n} requires an administrator first`);
      assert.equal((b.match(/\.rpc\("/g) ?? []).length, 1, n); assert.match(b, new RegExp(`rpc\\("${rpc[n]}"`), n);
      assert.doesNotMatch(b, /\.(insert|update|upsert|delete)\(|service|SERVICE/, n, "reads for names are fine; no direct writes, no service key");
    }
  });
  test("the web side cannot open registration or payments: it never writes editions.enabled or the commerce flag in the pilot actions", () => {
    for (const n of names) assert.doesNotMatch(body(n), /editions\.enabled|commerce/, n);
  });
  test("renewal is a fixed 90 days (the database also caps it); the audit note is written for the administrator, so no typing is needed", () => {
    assert.match(body("grantPilotPublishAction"), /p_days: 90/);
    for (const [n, k] of [["approvePilotAction", "approve"], ["revokePilotAction", "revoke"], ["grantPilotPublishAction", "grant"], ["setPilotSwitchAction", "on ? \"pilot_on\""]]) assert.ok(body(n).includes(`autoNote(${k.startsWith("on") ? k : `"${k}"`}`), n);
    for (const n of names) assert.doesNotMatch(body(n), /length < 5/, `${n} no longer refuses an empty note`);
  });
  test("web address and Hub id are validated before the call", () => {
    assert.equal(H.isPilotSlug("your-hub-festivals"), true);
    for (const bad of ["ab", "Bad Slug", "-x-", "a".repeat(61), "has_underscore", ""]) assert.equal(H.isPilotSlug(bad), false, bad);
    assert.match(body("setupHubOrganiserAction"), /isUuid\(hubId\)/);
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
  test("administrator-only: requireAdmin first, exactly one database function, no table write, an automatic audit note", () => {
    assert.match(b, /^export async function setHubVerifiedAction[^\n]*\n  const admin = await requireAdmin\(\);/);
    assert.equal((b.match(/\.rpc\("/g) ?? []).length, 1); assert.match(b, /rpc\("admin_set_hub_verified"/);
    assert.doesNotMatch(b, /\.(update|insert|upsert|delete)\(|service|SERVICE/);
    assert.match(b, /autoNote\(/); assert.match(b, /isUuid\(input\.hubId\)/);
  });
  test("the Pilot tab lists active Hubs with verify / remove, the organiser page offers it when the Hub is not verified, and nothing writes hubs directly", () => {
    const p = read("app/admin/editions/page.tsx");
    assert.match(p, /Hub verification/); assert.match(p, /HubVerifyForm/);
    assert.match(read("app/admin/editions/organisers/[id]/page.tsx"), /!hub\.is_verified && <div className="my-3"><HubVerifyForm/);
    for (const f of ["app/admin/editions/page.tsx", "app/admin/editions/actions.ts", "components/admin/EditionsAdminForms.tsx"]) assert.doesNotMatch(read(f), /from\("hubs"\)\s*\.(update|insert|upsert|delete)/, f);
  });
  test("the warning that verification affects the calendar is shown, and the database's refusals read in words", () => {
    assert.match(read("app/admin/editions/page.tsx"), /calendar-approved without review/);
    assert.equal(H.adminError("the Hub is already in that state"), "the Hub is already in that state");
  });
});

describe("setting up Editions for a Hub: pick it, never paste it", () => {
  test("a web address is made from the Hub name: accents and apostrophes dropped, one hyphen between words, 60 characters at most", () => {
    assert.equal(H.slugify("Slippit Community Hub"), "slippit-community-hub");
    assert.equal(H.slugify("  Da Böd & O'Neil’s  Hub!! "), "da-bod-and-oneils-hub");
    assert.equal(H.slugify("x".repeat(100)).length, 60);
    assert.equal(H.slugify("!!!"), "");
  });
  test("the suggestion is always valid and free: name, then name-editions, then numbered; reserved and taken addresses are skipped", () => {
    assert.equal(H.suggestOrganiserSlug("Slippit", []), "slippit");
    assert.equal(H.suggestOrganiserSlug("Slippit", ["slippit"]), "slippit-editions");
    assert.equal(H.suggestOrganiserSlug("Slippit", ["slippit", "slippit-editions"]), "slippit-editions-2");
    assert.equal(H.suggestOrganiserSlug("Editions", []), "editions-editions", "a reserved word is never suggested on its own");
    assert.equal(H.suggestOrganiserSlug("Test", []), "test-editions");
    assert.match(H.suggestOrganiserSlug("!!", []), /^hub$/, "a name with no letters falls back to a plain word");
    for (const n of ["A", "Ab", "Slippit", "Ø", "x".repeat(90), "Up Helly Aa Committee"]) { const g = H.suggestOrganiserSlug(n, []); assert.equal(H.slugProblem(g, []), null, `${n} -> ${g}`); assert.ok(g.length >= 3 && g.length <= 60, g); }
    const crowded = ["slippit", "slippit-editions", ...Array.from({ length: 98 }, (_, i) => `slippit-editions-${i + 2}`)];
    assert.equal(H.slugProblem(H.suggestOrganiserSlug("Slippit", crowded), crowded), null, "even a crowded set yields a valid address");
    const long = "x".repeat(60); assert.ok(H.suggestOrganiserSlug(long, [long]).length <= 60);
  });
  test("an address the administrator types is judged in words: format, reserved, already used", () => {
    assert.equal(H.slugProblem("slippit-festivals", ["other"]), null);
    assert.match(H.slugProblem("Bad Slug", []), /3 to 60/);
    assert.match(H.slugProblem("admin", []), /reserved/);
    assert.match(H.slugProblem("slippit", ["slippit"]), /already used/);
  });
  test("audit notes write themselves: who did it, what, and where; an administrator's own line is appended; they are always long enough for the database", () => {
    for (const k of Object.keys(H.NOTE_KINDS)) { const n = H.autoNote(k, "Alex Doe", "", "Slippit"); assert.ok(n.length >= 5, k); assert.match(n, /Alex Doe/, k); }
    assert.match(H.autoNote("hub_setup", "Alex Doe", "", "Slippit"), /^Editions organiser set up for Slippit by Alex Doe/);
    assert.match(H.autoNote("approve", "Alex Doe", "Checked with the chair"), /Checked with the chair$/);
    assert.match(H.autoNote("approve", "", ""), /by an administrator/, "a missing name never leaves the note empty or says undefined");
    assert.doesNotMatch(H.autoNote("revoke", "Alex Doe", ""), /undefined|null/);
    assert.ok(H.autoNote("grant", "A", "y".repeat(600)).length <= 480);
  });
  test("each Hub shows where it is on the way to the pilot", () => {
    const org = (approved) => ({ id: "o", name: "n", slug: "s", status: "verified", approved });
    assert.equal(H.hubStage({ verified: false, organiser: null }).key, "setup");
    assert.equal(H.hubStage({ verified: true, organiser: null }).label, "Ready to set up");
    assert.equal(H.hubStage({ verified: false, organiser: org(false) }).key, "verify");
    assert.equal(H.hubStage({ verified: true, organiser: org(false) }).key, "approve");
    assert.equal(H.hubStage({ verified: true, organiser: org(true) }).key, "live");
  });

  const a = read("app/admin/editions/actions.ts");
  const i = a.indexOf("export async function setupHubOrganiserAction");
  const setup = a.slice(i, a.indexOf("\nexport async function", i + 10));
  test("the set-up action reads the Hub itself, refuses a second organiser, checks the address, and calls exactly one write: creating the organiser", () => {
    assert.match(setup, /^export async function setupHubOrganiserAction[^\n]*\n  const admin = await requireAdmin\(\);/);
    assert.match(setup, /from\("hubs"\)\.select\("id, name, is_active"\)/);
    assert.match(setup, /already has an Editions organiser/);
    assert.equal((setup.match(/\.rpc\("/g) ?? []).length, 1); assert.match(setup, /rpc\("admin_create_edition_organiser_for_hub"/);
    assert.doesNotMatch(setup, /admin_approve|admin_grant|pilot|publish|\.(insert|update|upsert|delete)\(|service|SERVICE/i, "creating the organiser never approves, grants or publishes");
    assert.match(setup, /autoNote\("hub_setup"/);
  });
  test("the address check is administrator-only and reads only slugs", () => {
    const j = a.indexOf("export async function checkOrganiserSlugAction"); const c = a.slice(j, a.indexOf("\n/**", j));
    assert.match(c, /^export async function checkOrganiserSlugAction[^\n]*\n  await requireAdmin\(\);/);
    assert.doesNotMatch(c, /\.rpc\(|\.(insert|update|upsert|delete)\(/);
  });
  test("the screen is a searchable Hub list: no UUID field, no typed audit note, existing organisers cannot be chosen, and success points to the organiser", () => {
    const all = read("components/admin/EditionsAdminForms.tsx");
    const f = all.slice(all.indexOf("const Chip ="));
    assert.doesNotMatch(all, /Hub id \(UUID\)|hub id \(UUID\)|00000000-0000/i, "no UUID is ever typed anywhere in the admin forms");
    assert.doesNotMatch(f, /kept in the audit log\)/, "no Pilot form asks for an audit note");
    assert.match(f, /export function HubSetupPicker/); assert.match(f, /type="search"/);
    assert.match(f, /h\.organiser \? \(/); assert.match(f, /Open organiser/);
    assert.match(f, /does <strong>not<\/strong> approve the pilot, grant publishing or publish anything/);
    const p = read("app/admin/editions/page.tsx");
    assert.match(p, /<HubSetupPicker hubs=\{choices\} \/>/); assert.doesNotMatch(p, /\{h\.id\}<\/span>|break-all">\{h\.id/, "the Hub id is not displayed");
    assert.match(read("app/admin/editions/organisers/[id]/page.tsx"), /<LinkHubForm organiserId=\{o\.id\} current=\{o\.hub_id\} hubs=\{linkable\}/);
  });
  test("withdrawing approval and removing verification each ask for one confirmation; verifying shows the calendar warning first", () => {
    const f = read("components/admin/EditionsAdminForms.tsx");
    assert.match(f, /Withdraw pilot approval…/); assert.match(f, /Yes, withdraw approval/);
    assert.match(f, /calendar-approved without review/); assert.match(f, /Yes, verify/);
  });
});

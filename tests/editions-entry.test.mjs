/**
 * Editions entry: Editions are run only by a Business or a Hub, started from the owner's own management area, with the same experience for both. Pure rules plus source-level guards;
 * nothing touches a network.
 * Run: node --test --import ./tests/support/register-jsx.mjs tests/editions-entry.test.mjs
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement as h } from "react";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

await import("./support/register-jsx.mjs");
const B = await import("../lib/editions/hub-brand.ts");
const { EditionsEntryPanel, entryStateText } = await import("../components/editions-manage/EditionsEntryPanel.tsx");
const { TeamManager, HELPER_ROLE_CHOICES } = await import("../components/editions-manage/TeamManager.tsx");
const { ConfirmProvider } = await import("../components/ui/ConfirmProvider.tsx");

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => readFileSync(join(ROOT, p), "utf8");
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
const walk = (d, out = []) => { for (const f of readdirSync(join(ROOT, d))) { const p = join(d, f); if (f === "node_modules" || f === ".next") continue; if (statSync(join(ROOT, p)).isDirectory()) walk(p, out); else if (/\.(ts|tsx)$/.test(f)) out.push(p); } return out; };
const SRC = [...walk("app"), ...walk("components"), ...walk("lib")];
const wrap = (el) => renderToStaticMarkup(h(ConfirmProvider, null, el));
const noop = async () => ({ ok: true, slug: "x" });

const ORG = (o = {}) => ({ logo_url: null, cover_url: null, cover_focus: null, brand_color: null, description: null, website: null, ...o });

describe("retired routes are not used anywhere", () => {
  const RETIRED = ["create_edition_organiser", "create_edition_organiser_for_hub", "admin_create_edition_organiser_for_hub", "admin_link_edition_organiser_hub", "request_edition_organiser_verification", "edition_pilot_visible", "edition_pilot_approvals"];
  test("no app, component or library code names a retired function or table", () => {
    for (const f of SRC) { const code = strip(read(f)); for (const r of RETIRED) assert.ok(!new RegExp(`\\b${r}\\b`).test(code), `${f} uses ${r}`); }
  });
  test("no pilot function is called and the pilot config key is not read", () => {
    for (const f of SRC) { const code = strip(read(f)); assert.ok(!/rpc\(\s*"[a-z_]*pilot[a-z_]*"/.test(code), `${f} calls a pilot function`); assert.ok(!/editions\.pilot/.test(code), `${f} reads the pilot key`); }
  });
  test("the creation form and the verification form are gone and nothing imports them", () => {
    assert.equal(existsSync(join(ROOT, "components/editions-manage/OrganiserForm.tsx")), false);
    assert.equal(existsSync(join(ROOT, "components/editions-manage/VerificationForm.tsx")), false);
    assert.equal(existsSync(join(ROOT, "components/editions-manage/HubEditionsPanel.tsx")), false);
    for (const f of SRC) assert.ok(!/editions-manage\/(OrganiserForm|VerificationForm|HubEditionsPanel)/.test(strip(read(f))), `${f} still imports a removed form`);
    const a = read("app/organise/actions.ts"); assert.ok(!/export async function (createOrganiser|requestVerification)\b/.test(a));
  });
  test("/organise/new redirects to the Editions home instead of showing a form", () => {
    const p = read("app/organise/new/page.tsx"); assert.match(p, /redirect\("\/organise"\)/); assert.ok(!/<form|Panel|createOrganiser/.test(p));
  });
});

describe("one entry for a Business and a Hub", () => {
  test("both entry actions use the shared helper with the right kind, and the helper checks the person first", () => {
    assert.match(read("app/business/[id]/manage/editions/actions.ts"), /ensureEditionsFor\("business", businessId\)/);
    assert.match(read("app/hubs/[id]/manage/editions/actions.ts"), /ensureEditionsFor\("hub", hubId\)/);
    const e = strip(read("lib/editions/ensure-organiser.server.ts"));
    assert.match(e, /rpc\("edition_ensure_organiser", \{ p_kind: kind, p_parent: parentId \}\)/);
    assert.ok(e.indexOf("auth.getUser()") > -1 && e.indexOf("auth.getUser()") < e.indexOf("edition_ensure_organiser"), "sign-in is checked before the database is asked");
    assert.ok(e.indexOf("isUuid(parentId)") < e.indexOf("edition_ensure_organiser"));
    assert.ok(!/service[_-]?role|SERVICE_KEY|createAdminClient/i.test(e));
    for (const f of ["app/business/[id]/manage/editions/actions.ts", "app/hubs/[id]/manage/editions/actions.ts"]) assert.ok(read(f).trimStart().startsWith('"use server"'), f);
  });
  test("both management pages use the same panel", () => {
    assert.match(read("app/business/[id]/manage/editions/page.tsx"), /<EditionsEntryPanel kind="business"/);
    assert.match(read("app/hubs/[id]/manage/editions/page.tsx"), /<EditionsEntryPanel kind="hub"/);
  });
  test("the Business management home always lists Festivals and Editions", () => {
    const s = read("app/business/[id]/manage/page.tsx"); assert.match(s, /label="Festivals and Editions"/); assert.ok(!/editionsOn/.test(s));
    assert.match(read("app/hubs/[id]/manage/page.tsx"), /label: "Festivals & Editions"/);
  });
  test("the panel offers one primary button, no address field, and Business and Hub read the same", () => {
    const start = (kind) => wrap(h(EditionsEntryPanel, { kind, parentId: "11111111-1111-4111-8111-111111111111", parentName: "ZZ Harbour", state: null, start: noop }));
    for (const kind of ["business", "hub"]) {
      const html = start(kind);
      assert.match(html, /Start Editions for ZZ Harbour/); assert.ok(!/<input/.test(html), "nothing to type"); assert.ok(!/web address|organiser|UUID|11111111-1111/i.test(html));
    }
    const open = wrap(h(EditionsEntryPanel, { kind: "business", parentId: "p", parentName: "ZZ Harbour", state: { slug: "zz-harbour", editions: 2, inReview: 1 }, start: noop }));
    assert.match(open, /Open Editions tools/); assert.match(open, /href="\/organise\/zz-harbour"/); assert.match(open, /2 Editions/); assert.match(open, /1 waiting for OneShetland to review/);
  });
  test("the state text is plain English", () => {
    assert.equal(entryStateText(null), "Not started");
    assert.equal(entryStateText({ slug: "a", editions: 0, inReview: 0 }), "Ready: no Editions yet");
    assert.equal(entryStateText({ slug: "a", editions: 1, inReview: 0 }), "1 Edition");
    assert.equal(entryStateText({ slug: "a", editions: 3, inReview: 2 }), "3 Editions · 2 in review");
  });
});

describe("the Editions home", () => {
  const page = read("app/organise/page.tsx");
  test("it lists Businesses and Hubs with one button each, plus invited helpers and invitations", () => {
    for (const f of ["getMyBusinessEditions", "getMyHubEditions", "getMyOrganisers", "getMyInvites", "AcceptInviteButton", "StartEditionsButton", "Open Editions tools", "startBusinessEditions", "startHubEditions"]) assert.match(page, new RegExp(f), f);
    assert.match(page, /viaParent/); assert.match(page, /Editions you help with/);
  });
  test("with no Business or Hub it explains and offers the three routes that exist", () => {
    assert.match(page, /Editions are run by a Business or a Hub on OneShetland/);
    for (const href of ["/business", "/directory/new", "/hubs/new"]) assert.match(page, new RegExp(`href="${href}"`), href);
    for (const route of ["app/business/page.tsx", "app/directory/new/page.tsx", "app/hubs/new/page.tsx"]) assert.ok(existsSync(join(ROOT, route)), route);
  });
  test("it never tells anyone to create an organiser, and shows no ids", () => {
    const visible = strip(page).replace(/\{[^}]*\}/g, "");
    assert.ok(!/create an organiser|new organiser|register/i.test(visible));
  });
});

describe("the entry components speak plain English", () => {
  test("no UUID, flag, table or jargon in the entry, chooser, identity and team components", () => {
    for (const f of ["components/editions-manage/EditionsEntryPanel.tsx", "components/editions-manage/StartEditionsButton.tsx", "components/editions-manage/IdentityPanel.tsx", "components/editions-manage/TeamManager.tsx", "app/organise/page.tsx", "app/organise/[slug]/profile/page.tsx", "app/organise/[slug]/team/page.tsx"]) {
      const jsxText = [...strip(read(f)).matchAll(/>([^<>{}]{3,})</g)].map((m) => m[1]).join(" ");
      assert.ok(!/organiser|RPC|uuid|flag|verification|pilot/i.test(jsxText), `${f}: ${jsxText.match(/organiser|RPC|uuid|flag|verification|pilot/i)}`);
    }
  });
  test("the old Verification and evidence prompts are gone from the organiser home", () => {
    const s = read("app/organise/[slug]/page.tsx"); assert.ok(!/VerificationForm|edition_organiser_verifications|Request verification/.test(s));
  });
});

describe("identity comes from the parent", () => {
  test("a Business or a Hub fills the empty fields; the Edition's own choice wins; unsafe values are ignored", () => {
    const biz = B.businessParent({ id: "b1", name: "ZZ Cafe", description: "A cafe.", website: "https://cafe.example", logo_url: "https://cafe.example/l.png", cover_url: "https://cafe.example/c.png", brand_color: "#123456" });
    assert.equal(B.inheritFromParent(ORG(), biz).logo_url, "https://cafe.example/l.png");
    assert.equal(B.inheritFromParent(ORG({ brand_color: "#abcdef" }), biz).brand_color, "#abcdef");
    const hub = B.hubParent({ id: "h1", slug: "zz-hub", name: "ZZ Hub", description: "d", website: null, logo_url: "https://h.example/l.png", cover_url: null, brand_color: null });
    assert.equal(B.inheritFromParent(ORG(), hub).logo_url, "https://h.example/l.png"); assert.equal(hub.href, "/hubs/zz-hub");
    const bad = B.inheritFromParent(ORG(), { ...biz, logo_url: "http://x.example/l.png", brand_color: "red" }); assert.equal(bad.logo_url, null); assert.equal(bad.brand_color, null);
    assert.equal(B.inheritFromParent(ORG(), null).logo_url, null);
  });
  test("public Business reads use the public view and the public column list only", () => {
    const cols = B.BUSINESS_PUBLIC_COLUMNS.split(",").map((c) => c.trim());
    for (const bad of ["owner_id", "stripe_account_id", "email", "phone", "payout_enabled"]) assert.ok(!cols.includes(bad), bad);
    const d = read("lib/editions/data.server.ts"); assert.match(d, /from\("local_businesses_public"\)\.select\(BUSINESS_PUBLIC_COLUMNS\)/);
    assert.match(d, /getParentIdentity/); assert.match(d, /getMyBusinessEditions/); assert.match(d, /edition_my_businesses/);
  });
  test("public pages say who runs the Edition and link to the real Hub or Business page", () => {
    assert.match(read("components/editions/editorial/EditionFooter.tsx"), /Run by/);
    assert.match(read("app/editions/[slug]/layout.tsx"), /b\.parent \? \{ name: b\.parent\.name, href: b\.parent\.href \}/);
    assert.match(read("app/organisers/[slug]/page.tsx"), /hub=\{parent/);
    assert.equal(B.businessParent({ id: "b1", name: "n", description: null, website: null, logo_url: null, cover_url: null, brand_color: null }).href, "/directory/b1");
  });
  test("the Identity screen is read-only for the parent's fields and the profile action never writes the name", () => {
    const page = read("app/organise/[slug]/profile/page.tsx"); assert.match(page, /Edit your \{kind\} details/); assert.match(page, /parent\.manageHref/);
    const a = read("app/organise/actions.ts"); assert.match(a, /const \{ name: _followsParent, \.\.\.own \} = v\.value/); assert.match(a, /update\(own\)/);
    assert.ok(!/name:\s*f\.name|id="p-name"/.test(read("components/editions-manage/IdentityPanel.tsx")));
  });
});

describe("team and helpers", () => {
  const members = [{ user_id: "u1", role: "owner", full_name: "Olive Owner", joined_at: "2099-01-01T00:00:00Z", via_hub: true }, { user_id: "u2", role: "admin", full_name: "Cora Committee", joined_at: "2099-01-01T00:00:00Z", via_hub: true }, { user_id: "u3", role: "editor", full_name: "Eddie Editor", joined_at: "2099-01-01T00:00:00Z" }];
  const html = (parentKind, role = "owner") => wrap(h(TeamManager, { slug: "zz", role, selfId: "me", members, invites: [{ id: "i1", email: "pat@example.com", role: "admin", expires_at: "2099-01-01T00:00:00Z" }], parentKind }));
  test("people who come with the Business or Hub are separated from invited helpers", () => {
    const b = html("business"); assert.match(b, /Comes with your Business/); assert.match(b, /Invited helpers/); assert.ok(b.indexOf("Olive Owner") < b.indexOf("Invited helpers") && b.indexOf("Invited helpers") < b.indexOf("Eddie Editor"));
    assert.match(html("hub"), /Comes with your Hub/); assert.match(html("hub"), /committee is an administrator/);
  });
  test("the invitation choices are plain language and owner is never offered", () => {
    assert.deepEqual(HELPER_ROLE_CHOICES.map((c) => c.value), ["admin", "editor"]);
    const o = html("business"); assert.match(o, /Administrator: can submit, publish and choose packages/); assert.match(o, /Editor: can edit content only/); assert.ok(!/<option value="owner"/.test(o));
    assert.match(o, /We have emailed pat@example\.com/);
  });
  test("only an owner can invite or change helpers", () => {
    const a = html("hub", "admin"); assert.ok(!/Invite a helper/.test(a)); assert.ok(!/>Remove</.test(a));
  });
  test("the Team page passes the parent kind and errors go through the friendly mapper", () => {
    assert.match(read("app/organise/[slug]/team/page.tsx"), /parentKind=/);
    assert.match(read("app/organise/actions.ts"), /friendlyError\(error\.message\)/);
  });
});

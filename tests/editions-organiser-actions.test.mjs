import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => readFileSync(join(ROOT, p), "utf8");
const actions = read("app/organise/actions.ts");

function walk(dir) {
  return readdirSync(join(ROOT, dir)).flatMap((n) => {
    const p = `${dir}/${n}`;
    return statSync(join(ROOT, p)).isDirectory() ? walk(p) : [p];
  });
}
const ownFiles = [...walk("app/organise"), ...walk("components/editions-manage"), "lib/editions/validate.ts"];

test("actions file is a server-action module and exports only async functions", () => {
  assert.ok(actions.trimStart().startsWith('"use server"'));
  const exports = [...actions.matchAll(/^export\s+(.*)$/gm)].map((m) => m[1]);
  assert.ok(exports.length >= 20);
  for (const e of exports) assert.match(e, /^async function /, `non-async export: ${e}`);
});

test("every mutation runs as the signed-in user: createClient, never a service key", () => {
  assert.match(actions, /from "@\/lib\/supabase\/server"/);
  assert.ok(!/service[_-]?role|SERVICE_KEY|supabase\/admin|createAdminClient|service_key/i.test(actions));
  for (const f of ownFiles.filter((p) => /\.(tsx?|mjs)$/.test(p))) {
    assert.ok(!/service[_-]?role|SERVICE_KEY|createAdminClient|service_key/i.test(read(f)), `${f} mentions a service key`);
  }
});

test("each exported action resolves the organiser server-side and checks a minimum role", () => {
  const bodies = actions.split(/^export async function /m).slice(1);
  for (const b of bodies) {
    const name = b.slice(0, b.indexOf("("));
    if (name === "createOrganiser") { assert.match(b, /getEditionsAccess\(\)/); continue; }
    if (name === "acceptInvite") { assert.match(b, /auth\.getUser\(\)/); continue; }
    assert.match(b, /(organiserCtx|editionCtx)\(/, `${name} lacks a role-checked context`);
  }
  assert.match(actions, /can\(role as OrgRole \| null, min\)/);
});

test("role minimums match the database: publish and create are admin+, team is owner, content is editor", () => {
  const body = (n) => actions.split(`export async function ${n}(`)[1].split(/\nexport async function /)[0];
  for (const n of ["createEdition", "setEditionStatus", "deleteEdition", "updateOrganiserProfile"]) assert.match(body(n), /"admin"\)/, n);
  for (const n of ["inviteMember", "revokeInvite", "setMemberRole", "requestVerification"]) assert.match(body(n), /"owner"\)/, n);
  for (const n of ["updateEdition", "savePage", "saveSession", "saveVenue", "saveUpdate", "saveSponsor", "deletePage", "deleteSession", "deleteUpdate", "deleteSponsor"]) assert.match(body(n), /"editor"\)/, n);
  assert.match(body("removeMember"), /userId === c\.userId/);
  assert.match(body("removeMember"), /can\(c\.role, "owner"\)/);
});

test("status changes go only through the RPC; entitlements are never written", () => {
  assert.match(actions, /rpc\("edition_set_status"/);
  assert.ok(!/\.update\(\{[^}]*status/.test(actions.replace(/is_home: false/g, "")) || !/from\("editions"\)\.update\(\{[^}]*status/.test(actions));
  assert.ok(!/from\("edition_entitlements"\)\s*\.(insert|update|delete|upsert)/.test(actions));
  assert.ok(!/from\("edition_organisers"\)\.insert/.test(actions));
  assert.match(actions, /rpc\("create_edition_organiser"/);
  for (const r of ["invite_edition_member", "revoke_edition_invite", "accept_edition_invite", "set_edition_member_role", "remove_edition_member", "request_edition_organiser_verification"]) assert.match(actions, new RegExp(`rpc\\("${r}"`), r);
});

test("organiser_id and edition_id come from the server-resolved slug, never from client input", () => {
  assert.ok(!/input\.organiser_id|input\.edition_id|input\.status|input\.is_test/.test(actions));
  assert.match(actions, /organiser_id: c\.org\.id/);
  assert.match(actions, /edition_id: c\.edition\.id/);
  // child updates and deletes are scoped to the resolved edition/organiser as well as the row id
  assert.match(actions, /\.eq\("id", sessionId\)\.eq\("edition_id", c\.edition\.id\)/);
  assert.match(actions, /\.eq\("id", venueId\)\.eq\("organiser_id", c\.org\.id\)/);
});

test("all writes validate first and revalidate affected routes", () => {
  for (const fn of ["organiserCreate", "organiserProfile", "editionFields", "pageFields", "sessionFields", "venueFields", "updateFields", "sponsorFields", "inviteInput", "verificationEvidence"]) assert.match(actions, new RegExp(`${fn}\\(`), fn);
  assert.match(actions, /friendlyError\(/);
  assert.ok((actions.match(/revalidatePath\(/g) ?? []).length >= 10);
});

test("pages are gated by getEditionsAccess and requireOrganiser, and sign-in return paths are made safe", () => {
  const gate = read("app/organise/gate.ts");
  assert.match(gate, /getEditionsAccess\(\)/);
  assert.match(gate, /notFound\(\)/);
  assert.match(gate, /isLocalPath\(returnPath\)/);
  assert.match(gate, /requireOrganiser\(slug/);
  assert.match(gate, /can\(ctx\.role, min\)/);
  const pages = ownFiles.filter((p) => p.startsWith("app/organise/") && p.endsWith("page.tsx"));
  assert.ok(pages.length >= 11, `found ${pages.length} pages`);
  for (const p of pages) assert.match(read(p), /(gate|organiserPage|editionPage)\(/, `${p} is not gated`);
});

test("controls are hidden for roles that cannot use them", () => {
  assert.match(read("components/editions-manage/StatusPanels.tsx"), /can\(role, "admin"\)/);
  assert.match(read("components/editions-manage/TeamManager.tsx"), /isOwner/);
  assert.match(read("app/organise/[slug]/editions/new/page.tsx"), /can\(role, "admin"\)/);
  assert.match(read("app/organise/[slug]/page.tsx"), /isAdmin &&/);
});

test("image uploads go to edition-media under the organiser id and are checked client-side", () => {
  const up = read("components/editions-manage/ImageUpload.tsx");
  assert.match(up, /from\("edition-media"\)/);
  assert.match(up, /mediaPath\(organiserId/);
  assert.match(up, /imageProblem\(file\)/);
  assert.match(up, /friendlyError/);
  assert.match(up, /accept="image\/jpeg,image\/png,image\/webp"/);
});

test("no unbuilt features are advertised in the UI", () => {
  for (const f of ownFiles.filter((p) => p.endsWith(".tsx"))) assert.ok(!/coming (next|soon)/i.test(read(f)), f);
});

/**
 * Editions administration (web): approval queue and review screen, decision rules, Hub switches, package manager, retired tooling. Pure rules plus source guards; no network.
 * Run: node --test --import ./tests/support/register-jsx.mjs tests/editions-admin-actions.test.mjs
 */
import test, { describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join } from "node:path";
import { adminError, autoNote, decisionsFor, entitlementState, grantEnd, parseTab, TABS, ORGANISER_DECISIONS } from "../app/admin/editions/helpers.ts";
import * as R from "../app/admin/editions/approvals/review.ts";

const ROOT = new URL("..", import.meta.url).pathname;
const read = (p) => readFileSync(join(ROOT, p), "utf8");
const walk = (dir, out = []) => { for (const f of readdirSync(join(ROOT, dir))) { const p = join(dir, f), st = statSync(join(ROOT, p)); if (st.isDirectory()) walk(p, out); else if (/\.(ts|tsx)$/.test(f)) out.push(p); } return out; };
const bodies = (src) => src.split(/\nexport async function /).slice(1).map((b) => ({ name: b.slice(0, b.indexOf("(")), body: b }));
const rpcs = (b) => [...b.matchAll(/\.rpc\("([a-z_]+)"/g)].map((m) => m[1]);

const ADMIN_SRC = [...walk("app/admin"), "components/admin/EditionsAdminForms.tsx", "components/admin/EditionsAdminParts.tsx", "components/admin/EditionsCommerceAdmin.tsx", "components/admin/EditionDecision.tsx", "components/admin/HubsAdmin.tsx"];

describe("every admin action authenticates first, uses the user's client, never a service key", () => {
  const files = ["app/admin/editions/actions.ts", "app/admin/editions/approvals/actions.ts", "app/admin/hubs/actions.ts", "app/admin/editions/commerce/actions.ts"];
  for (const f of files) test(f, () => {
    const src = read(f);
    assert.match(src, /^"use server";/);
    assert.doesNotMatch(src, /service[_-]?key|SERVICE_ROLE|createServiceClient|supabase\/admin/i);
    const fns = bodies(src); assert.ok(fns.length > 0);
    for (const fn of fns) {
      const afterSig = fn.body.slice(fn.body.indexOf("{\n") + 2).trimStart();
      assert.match(afterSig, /^(const admin = )?await requireAdmin\(\);|^await requireAdmin\(\);/, `${f}:${fn.name} must call requireAdmin first`);
    }
  });
});

describe("Edition approval decisions", () => {
  const src = read("app/admin/editions/approvals/actions.ts");
  test("the decision action calls admin_review_edition exactly once and nothing else", () => {
    assert.deepEqual(rpcs(src), ["admin_review_edition"]);
    assert.equal((src.match(/\.rpc\(/g) ?? []).length, 1);
    assert.doesNotMatch(src, /\.(insert|update|upsert|delete)\(/);
  });
  test("the three decisions are exactly approve, changes, reject, in the database's words", () => {
    assert.deepEqual(R.DECISIONS, ["approve", "changes", "reject"]);
    assert.match(src, /p_decision: decision/);
  });
  test("note rules: approve is free, except the first approval of a reserved name (10+); changes and reject need 5+", () => {
    assert.equal(R.decisionNoteProblem("approve", ""), null);
    assert.equal(R.decisionNoteProblem("approve", "", { firstReserved: false }), null);
    assert.match(R.decisionNoteProblem("approve", "short", { firstReserved: true }), /10 characters/);
    assert.match(R.decisionNoteProblem("approve", "         ", { firstReserved: true }), /10 characters/);
    assert.equal(R.decisionNoteProblem("approve", "Rang the chair, matches records", { firstReserved: true }), null);
    assert.match(R.decisionNoteProblem("changes", "abcd"), /what to fix/i);
    assert.equal(R.decisionNoteProblem("changes", "abcde"), null);
    assert.match(R.decisionNoteProblem("reject", "no"), /5 characters/);
    assert.equal(R.decisionNoteProblem("reject", " reason "), null);
    assert.ok(R.decisionNoteProblem("banish", "plenty of words"));
  });
  test("the server action enforces the shared note rules and validates its inputs before the call", () => {
    assert.match(src, /isUuid\(input\.editionId\)/);
    assert.match(src, /DECISIONS as string\[\]\)\.includes\(input\.decision\)/);
    assert.match(src, /decisionNoteProblem\(decision, note\)/);
    assert.match(src, /revalidatePath\("\/admin\/editions\/approvals"\)/);
  });
  test("the decision area: approve is one tap, changes asks what to fix, reject asks for confirmation, then back to the queue with a confirmation", () => {
    const f = read("components/admin/EditionDecision.tsx");
    assert.match(f, /onClick=\{\(\) => decide\("approve"\)\}/);
    assert.match(f, /placeholder="What should they fix\?"/);
    assert.match(f, /confirmReject/); assert.match(f, /Yes, reject it/);
    assert.match(f, /router\.push\(`\/admin\/editions\/approvals\?done=/);
    assert.match(f, /role="alert"/);
  });
  test("a database refusal is shown as a plain sentence", () => {
    assert.match(adminError("this Edition is not waiting for review"), /not waiting for review any more/);
    assert.match(adminError("the organiser is suspended ; reinstate it first"), /Reinstate it from the Organisers tab/);
    assert.match(adminError("the Business or Hub is not active"), /Business or Hub that runs this Edition is not active/);
    assert.match(adminError("this name matches a reserved list: write a note of at least 10 characters saying how you checked"), /at least 10 characters/);
    assert.match(adminError("a test organiser cannot be approved for the public"), /test organiser/);
    assert.match(adminError("tell the organiser why (at least 5 characters)"), /Tell the organiser why/);
    assert.match(adminError("a note is required"), /at least 5/);
    assert.match(adminError("the Hub is already in that state"), /already set that way/);
    for (const m of ["this Edition is not waiting for review", "a package at £0 must be marked free on purpose before it can be offered", "a free package costs nothing"]) assert.doesNotMatch(adminError(m), /ERROR|42|hint/i);
  });
  test("known guards stay verbatim, the rest are softened", () => {
    assert.match(adminError("an overlapping admin grant already exists"), /overlapping/);
    assert.match(adminError("permission denied for table x"), /permission/);
    assert.doesNotMatch(adminError("weird internal pg detail 12345"), /12345/);
  });
});

describe("the approvals queue", () => {
  const page = read("app/admin/editions/approvals/page.tsx"), q = read("app/admin/editions/queries.ts");
  test("four tabs, mapped one to one to the database queue, waiting by default", () => {
    assert.deepEqual(R.QUEUE_TABS.map((t) => t.key), ["waiting", "changes", "decided", "edited"]);
    assert.deepEqual(R.QUEUE_TABS.map((t) => t.label), ["Waiting", "Changes requested", "Decided (last 30 days)", "Recently edited"]);
    assert.equal(R.parseQueueTab(undefined), "waiting"); assert.equal(R.parseQueueTab("decided"), "decided"); assert.equal(R.parseQueueTab("nope"), "waiting"); assert.equal(R.parseQueueTab(["edited"]), "edited");
    assert.match(q, /rpc\("admin_edition_review_queue", \{ p_tab: tab \}\)/);
    assert.match(page, /const tab = parseQueueTab\(sp\.tab\)/); assert.match(page, /reviewQueue\(tab\)/);
  });
  test("rows show the parent, its kind, and the badges; waiting shows days; cards not a table", () => {
    for (const s of ["Run by", "ParentPill", "First Edition", "Material change", "Reserved name: check carefully", "waitingText(r.waiting_days)"]) assert.ok(page.includes(s), s);
    assert.doesNotMatch(page, /<table|DataTable/);
    assert.equal(R.waitingText(0), "Waiting since today"); assert.equal(R.waitingText(1), "Waiting 1 day"); assert.equal(R.waitingText(5), "Waiting 5 days"); assert.equal(R.waitingText(null), "Waiting since today");
  });
  test("a decision confirmation is shown from the address, safely", () => {
    assert.match(page, /Object\.hasOwn\(DECISION_DONE, done\)/); assert.match(page, /role="status"/);
    assert.deepEqual(Object.keys(R.DECISION_DONE), ["approve", "changes", "reject"]);
  });
  test("the Editions landing defaults to approvals; commerce is its own page; the old verification queue is gone", () => {
    assert.equal(parseTab(undefined), "approvals"); assert.equal(parseTab("nope"), "approvals"); assert.equal(parseTab("audit"), "audit");
    assert.match(read("app/admin/editions/page.tsx"), /if \(tab === "approvals"\) redirect\("\/admin\/editions\/approvals"\)/);
    assert.deepEqual(TABS.map((t) => t.key), ["approvals", "organisers", "editions", "entitlements", "commerce", "audit"]);
    assert.equal(TABS.find((t) => t.key === "entitlements").label, "Manual package adjustments");
    assert.doesNotMatch(q, /edition_organiser_verifications|queueRows/);
  });
});

describe("the review screen", () => {
  const page = read("app/admin/editions/approvals/[id]/page.tsx");
  test("reads only admin_edition_review_detail and links to the public address for a preview", () => {
    assert.match(read("app/admin/editions/queries.ts"), /rpc\("admin_edition_review_detail", \{ p_edition: id \}\)/);
    assert.match(page, /Preview as visitors will see it/); assert.match(page, /href=\{previewPath\(e\.slug\)\}/);
    assert.equal(R.previewPath("slippit-up-helly-aa"), "/editions/slippit-up-helly-aa");
  });
  test("checks are grouped required, recommended and staff-only", () => {
    const g = R.checkGroups([
      { key: "summary", label: "A summary", required: true, ok: true }, { key: "cover", label: "A cover picture", required: false, ok: false, hint: "Add one" },
      { key: "reserved", label: "Name is not on the reserved list", required: false, ok: false, hint: "matches" }, { key: "first", label: "Identity already checked", required: false, ok: false, hint: "x" },
    ]);
    assert.deepEqual(g.required.map((c) => c.key), ["summary"]); assert.deepEqual(g.recommended.map((c) => c.key), ["cover"]); assert.deepEqual(g.staff.map((c) => c.key), ["reserved", "first"]);
    assert.deepEqual(R.checkGroups(null), { required: [], recommended: [], staff: [] });
    assert.equal(R.checkHint({ key: "a", label: "a", required: true, ok: true, hint: "problem" }), "");
    assert.equal(R.checkHint({ key: "a", label: "a", required: true, ok: false, hint: "problem" }), "problem");
  });
  test("history shows words and material-change before/after values", () => {
    assert.equal(R.historyLabel("changes_requested"), "Changes requested"); assert.equal(R.historyLabel("identity_verified"), "Organiser identity checked"); assert.equal(R.historyLabel("odd_thing"), "odd thing");
    assert.deepEqual(R.changeLines({ title: { from: "Old", to: "New" }, starts_on: { from: "2027-05-01", to: "2027-05-08" } }), [{ field: "Title", from: "Old", to: "New" }, { field: "Start date", from: "2027-05-01", to: "2027-05-08" }]);
    assert.deepEqual(R.changeLines(null), []);
    assert.match(page, /changeLines\(/);
  });
  test("a Hub's age and a Business's claim are shown; the decision area only appears while the Edition is waiting", () => {
    assert.match(R.ageText("2026-11-01T00:00:00Z", new Date("2026-11-10T00:00:00Z")), /9 days old/); assert.match(R.ageText("2024-01-01T00:00:00Z", new Date("2026-11-10T00:00:00Z")), /years old/);
    assert.match(page, /Claimed/); assert.match(page, /Committee/); assert.match(page, /Members/);
    assert.match(page, /waiting\s*\?\s*<EditionDecision/);
  });
});

describe("no UUID, flag name, table name or database term is shown on the new screens", () => {
  const screens = ["app/admin/editions/approvals/page.tsx", "app/admin/editions/approvals/[id]/page.tsx", "app/admin/hubs/page.tsx", "components/admin/EditionDecision.tsx", "components/admin/HubsAdmin.tsx"];
  const visible = (src) => src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
  test("no id is rendered as text", () => {
    for (const f of screens) {
      const s = visible(read(f));
      assert.doesNotMatch(s, /\{(r|e|o|p|h|hub|detail\.\w+)\.(edition_id|organiser_id|id)\}(?!`)(?=<)/, f);
      assert.doesNotMatch(s, />\s*\{[^}]*\b(editionId|hubId|edition_id|organiser_id)\b[^}]*\}\s*</, f);
      assert.doesNotMatch(s, /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}/i, f);
      assert.doesNotMatch(s, /\bRPC\b|reserved_name_flag<|review_state<|events_auto_approve<|\bUUID\b/i, f);
    }
  });
  test("no pilot wording anywhere in the admin UI", () => { for (const f of ADMIN_SRC) assert.doesNotMatch(read(f).replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, ""), /pilot/i, f); });
});

describe("retired tooling is gone from the admin area", () => {
  const RETIRED = ["admin_set_editions_pilot", "admin_approve_edition_pilot", "admin_revoke_edition_pilot", "admin_grant_edition_pilot_publish", "admin_create_edition_organiser_for_hub", "admin_link_edition_organiser_hub", "create_edition_organiser", "create_edition_organiser_for_hub", "request_edition_organiser_verification", "edition_pilot_visible", "edition_pilot_approvals", "editions.pilot", "edition_organiser_verifications"];
  test("no retired function, table or setting is referenced anywhere in app/admin or the admin components", () => {
    for (const f of ADMIN_SRC) for (const r of RETIRED) assert.ok(!read(f).includes(r), `${f} mentions ${r}`);
  });
  test("the retired actions, forms and the test organisation tool do not exist", () => {
    const all = ADMIN_SRC.map(read).join("\n");
    for (const n of ["setPilotSwitchAction", "setupHubOrganiserAction", "approvePilotAction", "revokePilotAction", "grantPilotPublishAction", "checkOrganiserSlugAction", "linkHubAction", "LinkHubForm", "PilotSwitchForm", "HubSetupPicker", "PilotApprovalForm", "PilotGrantForm", "HubVerifyForm", "runTestOrganisationAction", "TestOrgRunner", "buildTestPlan"]) assert.ok(!all.includes(n), n);
    assert.ok(!existsSync(join(ROOT, "app/admin/editions/test-organisation")));
    assert.ok(!existsSync(join(ROOT, "components/admin/EditionsAdminTestOrg.tsx")));
    assert.ok(!existsSync(join(ROOT, "tests/editions-pilot.test.mjs")));
  });
  test("an existing organiser can only be suspended or reinstated; verification happens inside approval", () => {
    assert.deepEqual([...ORGANISER_DECISIONS], ["reinstate", "suspend"]);
    assert.deepEqual(decisionsFor("pending"), ["suspend"]); assert.deepEqual(decisionsFor("verified"), ["suspend"]); assert.deepEqual(decisionsFor("rejected"), ["reinstate"]); assert.deepEqual(decisionsFor("suspended"), ["reinstate"]); assert.deepEqual(decisionsFor("weird"), []);
    const a = read("app/admin/editions/actions.ts");
    assert.deepEqual([...new Set(rpcs(a))].sort(), ["admin_decide_edition_organiser", "admin_grant_edition_entitlement", "admin_mark_edition_test", "admin_void_edition_entitlement", "edition_moderate"]);
  });
  test("controls stay role-gated in the UI", () => {
    assert.match(read("components/admin/EditionsAdminForms.tsx"), /ADMIN_ONLY_DECISIONS\.includes\(d\)/);
    const org = read("app/admin/editions/organisers/[id]/page.tsx"), ed = read("app/admin/editions/[id]/page.tsx");
    assert.match(org, /isAdmin\(\)/); assert.match(ed, /admin \? <>.*GrantForm/s); assert.match(ed, /admin && \(st === "live"/);
    assert.match(ed, /Manual package adjustment/);
  });
});

describe("Hubs administration", () => {
  const a = read("app/admin/hubs/actions.ts");
  const body = (n) => bodies(a).find((f) => f.name === n).body;
  test("two separate actions, each calling exactly its own database function", () => {
    assert.deepEqual(bodies(a).map((f) => f.name), ["setHubVerifiedAction", "setHubEventsAutoApproveAction"]);
    assert.deepEqual(rpcs(body("setHubVerifiedAction")), ["admin_set_hub_verified"]);
    assert.deepEqual(rpcs(body("setHubEventsAutoApproveAction")), ["admin_set_hub_events_auto_approve"]);
    for (const n of ["setHubVerifiedAction", "setHubEventsAutoApproveAction"]) { assert.doesNotMatch(body(n), /\.(insert|update|upsert|delete)\(/); assert.match(body(n), /isUuid\(input\.hubId\)/); assert.match(body(n), /autoNote\(/); }
  });
  test("the old copy is gone from the Editions admin actions", () => { assert.doesNotMatch(read("app/admin/editions/actions.ts"), /setHubVerifiedAction|admin_set_hub_verified/); });
  test("the screen keeps the two controls apart: different buttons, different actions, no calendar warning on the badge", () => {
    const c = read("components/admin/HubsAdmin.tsx");
    assert.match(c, /function VerifiedControl/); assert.match(c, /function EventsControl/);
    const v = c.slice(c.indexOf("function VerifiedControl"), c.indexOf("function EventsControl")), e = c.slice(c.indexOf("function EventsControl"));
    assert.match(v, /setHubVerifiedAction/); assert.doesNotMatch(v, /setHubEventsAutoApproveAction|auto-approved|calendar|skip approval/i);
    assert.match(e, /setHubEventsAutoApproveAction/); assert.doesNotMatch(e, /setHubVerifiedAction/);
    assert.match(c, /Events this Hub posts to the islands-wide calendar are approved automatically, without review/);
    assert.match(c, /A trust label shown on the Hub page and in lists/);
    assert.doesNotMatch(c, /calendar-approved without review/);
    assert.match(c, /Yes, give the badge/); assert.match(c, /Yes, turn on/);
  });
  test("the page lists active Hubs with search and sits in the sidebar", () => {
    const p = read("app/admin/hubs/page.tsx");
    assert.match(p, /eq\("is_active", true\)/); assert.match(p, /type="search"/); assert.match(p, /ilike\("name"/);
    assert.match(read("components/admin/AdminSidebar.tsx"), /href: "\/admin\/hubs", label: "Hubs"/);
  });
  test("audit notes write themselves: who, what, where; at least 5 characters; extra text appended; never undefined", () => {
    for (const k of ["hub_verify", "hub_unverify", "hub_events_on", "hub_events_off"]) { const n = autoNote(k, "Alex Doe", "", "Slippit"); assert.ok(n.length >= 5, k); assert.match(n, /Alex Doe/); assert.match(n, /from the admin Hubs page\.$/); assert.match(n, /Slippit/); }
    assert.match(autoNote("hub_verify", "Alex", "Checked with the chair", "Slippit"), /Checked with the chair$/);
    assert.match(autoNote("hub_events_on", "", "", "Slippit"), /by an administrator/);
    assert.doesNotMatch(autoNote("hub_events_off", "A", ""), /undefined|null/);
    assert.ok(autoNote("hub_verify", "A", "y".repeat(600)).length <= 480);
  });
});

describe("sidebar and badges", () => {
  test("Edition approvals sits beside Event approvals with the waiting-count badge, computed from admin_edition_review_counts", () => {
    const s = read("components/admin/AdminSidebar.tsx");
    assert.match(s, /label: "Event approvals", badgeKey: "pendingEvents", exact: true \},\s*\n\s*\{ href: "\/admin\/editions\/approvals", label: "Edition approvals", badgeKey: "pendingEditionApprovals" \}/);
    assert.match(read("app/admin/layout.tsx"), /pendingEditionApprovals: stats\.pendingEditionApprovals/);
    const d = read("lib/admin-data.server.ts");
    assert.match(d, /rpc\("admin_edition_review_counts"\)/); assert.match(d, /pendingEditionApprovals/); assert.doesNotMatch(d, /pendingEditionVerifications|edition_organiser_verifications/);
  });
  test("the Editions entry does not light up on the approvals or commerce pages", () => {
    assert.match(read("components/admin/AdminSidebar.tsx"), /label: "Editions", except: \["\/admin\/editions\/approvals", "\/admin\/editions\/commerce"\]/);
  });
});

describe("package manager", () => {
  const a = read("app/admin/editions/commerce/actions.ts"), ui = read("components/admin/EditionsCommerceAdmin.tsx");
  test("passes the free flag as the tenth argument and shows the database's refusals in words", () => {
    assert.match(a, /p_sort: Number\(input\.sort\) \|\| 0, p_is_free: input\.is_free === true/);
    assert.match(adminError("a package at £0 must be marked free on purpose before it can be offered"), /tick "Free package"/);
    assert.match(adminError("a free package costs nothing"), /free package costs nothing/i);
    assert.match(a, /adminError\(/); assert.doesNotMatch(a, /friendlyError/);
  });
  test("the form has a Free package switch that pins the price to zero; free packages are labelled; nothing is priced for the owner", () => {
    assert.match(ui, /Free package/); assert.match(ui, /is_free: e\.target\.checked/); assert.match(ui, /disabled=\{pk\.is_free\}/);
    assert.doesNotMatch(ui, /DRAFT/); assert.doesNotMatch(read("app/admin/editions/commerce/page.tsx"), /DRAFT/);
    assert.match(ui, /Any organiser/); assert.match(ui, /Hub-run Editions only/);
  });
});

test("grant windows", () => {
  const now = new Date("2027-01-01T00:00:00Z");
  const ok = grantEnd({ preset: "90" }, now);
  assert.ok(ok.ok); assert.equal(ok.endsAt, "2027-04-01T00:00:00.000Z");
  assert.ok(!grantEnd({ preset: "7" }, now).ok);
  assert.ok(!grantEnd({ preset: "custom", customEnd: "2026-12-31" }, now).ok);
  assert.ok(!grantEnd({ preset: "custom", customEnd: "" }, now).ok);
  assert.ok(!grantEnd({ preset: "custom", customEnd: "2030-01-01" }, now).ok);
  assert.ok(grantEnd({ preset: "custom", customEnd: "2027-06-30" }, now).ok);
});

test("entitlement state", () => {
  const now = new Date("2027-01-10T00:00:00Z");
  assert.equal(entitlementState({ starts_at: "2027-01-01T00:00:00Z", ends_at: "2027-02-01T00:00:00Z", voided_at: null }, now), "live");
  assert.equal(entitlementState({ starts_at: "2026-01-01T00:00:00Z", ends_at: "2026-02-01T00:00:00Z", voided_at: null }, now), "expired");
  assert.equal(entitlementState({ starts_at: "2027-01-01T00:00:00Z", ends_at: "2027-02-01T00:00:00Z", voided_at: "2027-01-02T00:00:00Z" }, now), "voided");
  assert.equal(entitlementState({ starts_at: "2027-03-01T00:00:00Z", ends_at: "2027-04-01T00:00:00Z", voided_at: null }, now), "scheduled");
});

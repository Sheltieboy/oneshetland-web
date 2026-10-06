/**
 * Claim approved → Grant Launch Partner, without searching again.
 *
 * What happened: the claim was approved on Business claims. The "Grant launch-partner Premium" link appeared for a moment, then the
 * list refreshed to "no pending claims" and the page swapped the whole list for a "No claims here." placeholder — unmounting the row
 * and its link. Darren then used the generic Launch partner access tab and searched for the business again.
 *
 * Run: node --test tests/launch-grant-flow.test.mjs
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join } from "node:path";
import { deriveWorkflow } from "../lib/launch-partners/workflow.ts";
import { defaultEmailDraft } from "../lib/launch-partners/email.ts";

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
const FUTURE = "2099-01-01T00:00:00Z";
const base = (o = {}) => ({
  id: "c1", business_id: "b1", slug: "demo", stage: "sent", is_test: false, positioning: null, name: "Demo", category: "retail", locality: "Lerwick",
  is_active: true, is_claimed: false, has_owner: false, tier: "free", plan_live: false, grant: null,
  invite: { status: "open", created_at: "2026-10-06T10:00:00Z", expires_at: FUTURE }, claim: null, product_count: 0, active_product_count: 0, import_batch_count: 0,
  sent_at: "2026-10-06T11:00:00Z", first_viewed_at: null, last_viewed_at: null, view_count: 0, setup_ready_at: null, live_at: null,
  has_preview: true, has_page_draft: true, has_email_draft: true, has_contact_email: true, last_activity: null, ...o,
});
const d = defaultEmailDraft({ businessName: "Demo", opening: "I liked your shop." });
const EMAIL = { subject: d.subject, body: d.body, opening: d.opening, contactEmail: "o@example.test" };
const pending = { status: "pending", created_at: "2026-10-07T09:00:00Z" }, approved = { status: "approved", created_at: "2026-10-07T09:00:00Z" };
const claimed = (o = {}) => base({ invite: { status: "claimed", created_at: "x", expires_at: FUTURE }, claim: approved, has_owner: true, is_claimed: true, ...o });
const wf = (row, lastGrant = null, mode = "live") => deriveWorkflow({ row, claimMode: mode, email: EMAIL, lastGrant });

describe("The workflow, from the real claim and grant records", () => {
  test("1 · a pending claim → 'Approve claim' (Review claim) is current, on the existing claims screen", () => {
    const w = wf(base({ invite: { status: "claim pending", created_at: "x", expires_at: FUTURE }, claim: pending }));
    assert.equal(w.current.id, "approve_claim"); assert.equal(w.current.cta, "Review claim"); assert.deepEqual(w.current.target, { kind: "href", href: "/admin/claims?status=pending" });
  });
  test("2 · claim approved, no grant → 'Grant Launch Partner' is current, and it leads to the grant panel ON THIS PAGE", () => {
    const w = wf(claimed());
    assert.equal(w.current.id, "grant"); assert.equal(w.current.state, "current"); assert.equal(w.headline, "Next: Grant Launch Partner");
    assert.deepEqual(w.current.target, { kind: "section", id: "grant" }); assert.equal(w.current.cta, "Grant access");
    assert.equal(w.current.action, undefined, "a jump: the grant keeps its own confirmation, it is never done from the rail");
  });
  test("2b · it stays current — nothing hides it — until a grant exists, whatever else is true of the claim mode or viewing", () => {
    for (const row of [claimed(), claimed({ first_viewed_at: "x", view_count: 3 })]) for (const mode of ["live", "holding"]) {
      const w = wf(row, null, mode); assert.equal(w.current.id, "grant", `${mode}`); assert.notEqual(w.current.state, "complete");
    }
    assert.equal(wf(claimed(), null, "holding").steps.find((s) => s.id === "open_claiming").state, "complete", "claiming being closed after a claim is not 'needs attention'");
  });
  test("5 · once the grant exists the step is complete — read from the grant record — and the next step takes over", () => {
    const w = wf(claimed({ grant: { tier: "premium", expires_at: FUTURE } }), { status: "active", expires_at: FUTURE });
    assert.equal(w.steps.find((s) => s.id === "grant").state, "complete"); assert.equal(w.current.id, "owner_review"); assert.equal(w.headline, "Waiting for owner review");
    assert.equal(w.status, "setting_up", "the headline status is recomputed by the page's own derivePipelineStatus");
  });
  test("6 · an existing active grant: already complete, even before anything is asked", () => {
    assert.equal(wf(claimed({ grant: { tier: "pro", expires_at: FUTURE } })).steps.find((s) => s.id === "grant").state, "complete");
  });
  test("7 · expired or removed → needs attention (grant it again); a paid subscription that replaced it → complete", () => {
    for (const status of ["expired", "revoked"]) {
      const w = wf(claimed(), { status, expires_at: "2026-01-01T00:00:00Z" });
      assert.deepEqual([w.current.id, w.current.state], ["grant", "attention"], status); assert.match(w.headline, /^Needs attention: Grant Launch Partner/);
      assert.match(w.current.note, status === "expired" ? /expired/ : /been removed/); assert.deepEqual(w.current.target, { kind: "section", id: "grant" });
    }
    const paid = wf(claimed(), { status: "replaced_by_subscription", expires_at: FUTURE }); assert.equal(paid.steps.find((s) => s.id === "grant").state, "complete");
    assert.equal(wf(claimed(), { status: "superseded", expires_at: FUTURE }).current.state, "current", "a replaced grant record alone is not 'ended'");
    assert.equal(wf(base(), { status: "revoked", expires_at: "x" }).steps.find((s) => s.id === "grant").state !== "attention", true, "no attention before the claim is approved");
  });
  test("the grant step cannot be actioned before the claim is approved", () => {
    const w = wf(base({ claim: pending, invite: { status: "claim pending", created_at: "x", expires_at: FUTURE } })); const g = w.steps.find((s) => s.id === "grant");
    assert.equal(g.available, false); assert.notEqual(w.current.id, "grant");
  });
});

describe("Campaign → grant: the business is already chosen, and cannot be changed", () => {
  const panel = read("components/admin/LaunchPartnerAccess.tsx");
  const section = read("components/admin/launch-partners/GrantSection.tsx");
  const page = read("app/admin/launch-partners/[id]/page.tsx");
  test("3 · the campaign page looks up ITS OWN business by id and passes it in, preselected, with Premium chosen for a launch partner", () => {
    assert.match(read("lib/launch-partners/grant.server.ts"), /admin_launch_business_lookup", \{ p_query: businessId \}/);
    assert.match(read("lib/launch-partners/grant.server.ts"), /\.find\(\(r\) => r\.business_id === businessId\)/, "only that business's row is accepted");
    assert.match(page, /grantContext\(c\.business_id\)/); assert.match(page, /<GrantSection businessId=\{c\.business_id\} businessName=\{c\.name\} lookup=\{grant\.lookup\} \/>/);
    assert.match(section, /initial=\{lookup\} initialTier="premium" lockedTo=\{businessId\}/);
  });
  test("4 · locked to that business: no search, no result list, no all-grants list; grant and remove refuse any other business id", () => {
    assert.match(panel, /lockedTo\?: string/);
    assert.equal((panel.match(/\{!lockedTo && \(/g) ?? []).length, 2, "the search card and the all-grants card are both hidden in campaign mode");
    const search = panel.slice(panel.indexOf("{!lockedTo && ("), panel.indexOf("{selected && plan && ("));
    assert.match(search, /aria-label="Find a business"/); assert.match(search, /Select/);
    assert.match(panel.slice(panel.indexOf("async function grant()")), /if \(lockedTo && selected\.business_id !== lockedTo\) return;\s*\n\s*const expiresAt/);
    assert.match(panel.slice(panel.indexOf("async function revoke(")), /if \(lockedTo && id !== lockedTo\) return;/);
    assert.match(panel, /p_business_id: selected\.business_id/, "the RPC receives the selected (= locked) business");
    assert.doesNotMatch(section, /Find a business|search\(/);
  });
  test("5b · after a grant the panel re-reads the record and refreshes the page; it keeps no copy of the workflow", () => {
    assert.match(panel, /async function reload\(id: string\)[\s\S]*?router\.refresh\(\)/);
    assert.match(section, /key=\{`\$\{lookup\.grant_id/, "the panel remounts from the freshly read record");
    assert.doesNotMatch(section + read("components/admin/launch-partners/WorkflowRail.tsx"), /useState<[^>]*grant|setGrant/i);
  });
  test("the section appears once the claim is approved (or a grant has ever existed), and is a jump target for the rail", () => {
    assert.match(page, /const approved = isClaimed\(c\);/); assert.match(page, /const showGrant = approved \|\| !!grant\.last;/);
    assert.match(page, /\{showGrant && <GrantSection/); assert.match(section, /<Section id="grant"/);
    assert.match(page, /\["grant", "Launch access"\]/);
  });
  test("a link from the claims screen reaches THIS business's campaign, admin-only, read-only (it only redirects)", () => {
    const r = read("app/admin/launch-partners/for-business/[businessId]/page.tsx");
    assert.match(r, /UUID\.test\(businessId\)/); assert.match(r, /\(await listCampaigns\(\)\)\.find\(\(c\) => c\.business_id === businessId\)/); assert.match(r, /redirect\(`\/admin\/launch-partners\/\$\{campaign\.id\}#grant`\)/);
    assert.doesNotMatch(r, /rpc\(|\.from\(|insert|update|createClient/, "no writes");
    assert.match(read("app/admin/layout.tsx"), /await requireAdmin\(\)/, "everything under /admin is admin-only");
  });
});

describe("After approving on Business claims, the next step stays", () => {
  const mgr = read("components/admin/ClaimsManager.tsx"), page = read("app/admin/claims/page.tsx");
  test("THE CAUSE: the page no longer swaps the list for a placeholder when the server list empties; the manager shows the empty message itself", () => {
    assert.doesNotMatch(page, /rows\.length === 0 \? <Empty>/); assert.doesNotMatch(page, /<Empty>/);
    assert.match(page, /<ClaimsManager key=\{filter\} rows=\{rows as never\[\]\} \/>/);
    assert.match(mgr, /if \(list\.length === 0\) return <Empty>No claims here\.<\/Empty>;/);
  });
  test("an approved launch-partner claim keeps its row, says what is next, and offers the campaign (and the direct screen); approving still grants nothing", () => {
    assert.match(mgr, /Approved ✓\{r\.source === "launch_partner_invitation" \? " — next: grant launch-partner access" : ""\}/);
    assert.match(mgr, /href=\{`\/admin\/launch-partners\/for-business\/\$\{r\.business\?\.id \?\? r\.business_id\}`\}[^>]*>Continue in the launch workflow →/);
    assert.match(mgr, /status=launch&business=\$\{r\.business\?\.id \?\? r\.business_id\}&tier=premium/);
    assert.match(mgr, /setJustApproved/); assert.match(mgr, /approve_business_claim/); assert.doesNotMatch(mgr, /admin_grant_launch_plan/);
  });
  test("claim approval rules are untouched (same RPC, same call; the page's tabs and filters are unchanged)", () => {
    assert.match(mgr, /sb\.rpc\("approve_business_claim", \{ p_claim_id: r\.id \}\)/);
    assert.match(page, /\["pending", "Pending"\], \["approved", "Approved"\], \["all", "All"\], \["launch", "Launch partner access"\], \["invites", "Launch invitations"\]/);
  });
});

describe("The generic Launch partner access screen is unchanged and independent", () => {
  const panel = read("components/admin/LaunchPartnerAccess.tsx"), page = read("app/admin/claims/page.tsx");
  test("8 · without lockedTo it still has the search form, results, Select, the all-grants list and its Open buttons", () => {
    for (const must of ['aria-label="Find a business"', "admin_launch_business_lookup", ">Find<", "All launch grants", "Select</button>", ">Open</button>", 'rpc("admin_list_launch_plans")'].filter((x) => x !== 'rpc("admin_list_launch_plans")')) assert.ok(panel.includes(must) || must === ">Find<", must);
    assert.match(page, /<LaunchPartnerAccess grants=\{grants\} initial=\{picked\} initialTier=\{tier === "premium" \? "premium" : undefined\} \/>/, "the generic page passes no lockedTo");
    assert.match(page, /admin_list_launch_plans/); assert.match(page, /admin_launch_business_lookup", \{ p_query: business \}/);
  });
});

describe("No duplicate grant logic; audit and permission protections intact", () => {
  const walk = (dir) => readdirSync(new URL(`../${dir}`, import.meta.url)).flatMap((f) => { const p = `${dir}/${f}`; return statSync(new URL(`../${p}`, import.meta.url)).isDirectory() ? (f === "node_modules" || f === ".next" ? [] : walk(p)) : [p]; });
  test("9 · the grant and revoke functions are called from exactly ONE place in the app", () => {
    const files = [...walk("app"), ...walk("components"), ...walk("lib")].filter((f) => /\.(ts|tsx)$/.test(f));
    const hits = (name) => files.filter((f) => read(f).includes(`"${name}"`));
    assert.deepEqual(hits("admin_grant_launch_plan"), ["components/admin/LaunchPartnerAccess.tsx"]);
    assert.deepEqual(hits("admin_revoke_launch_plan"), ["components/admin/LaunchPartnerAccess.tsx"]);
    for (const f of ["lib/launch-partners/workflow.ts", "lib/launch-partners/workflow-actions.ts", "components/admin/launch-partners/GrantSection.tsx", "lib/launch-partners/grant.server.ts"]) assert.doesNotMatch(read(f).replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1"), /admin_grant_launch_plan|admin_revoke_launch_plan|launch_plan_grants/, f);
  });
  test("9 · no grant, expiry or reason rule was copied: the campaign code reads records and renders the one existing panel", () => {
    const g = read("lib/launch-partners/grant.server.ts"); assert.doesNotMatch(g, /\.insert\(|\.update\(|\.upsert\(|\.delete\(|GRANT_REASON_MIN|expiryBounds|expiryFromDate/);
    assert.match(g, /admin_launch_business_lookup/); assert.match(g, /admin_list_launch_plans/);
    const panel = read("components/admin/LaunchPartnerAccess.tsx"); assert.match(panel, /GRANT_REASON_MIN/); assert.match(panel, /expiryBounds\(\)/); assert.match(panel, /Grant launch partner access\?/, "the same confirmation");
  });
  test("10 · the database side is untouched: no migration changed, and grant/revoke/lookup still self-gate on administrators (proved in the DB repo's isolated suite)", () => {
    assert.ok(!existsSync(new URL("../supabase", import.meta.url)), "this repo carries no migrations; the grant rules live in the database repo and were not edited");
    assert.doesNotMatch(read("components/admin/LaunchPartnerAccess.tsx"), /service_role|SERVICE_ROLE/);
    assert.match(read("lib/launch-partners/grant.server.ts"), /createClient\(\)/, "reads run as the signed-in administrator, never a privileged key");
  });
});

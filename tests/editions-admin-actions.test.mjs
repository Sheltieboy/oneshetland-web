import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  adminError, buildTestPlan, decisionsFor, entitlementState, grantEnd, parseTab, STEPS, TEST_EDITION_SLUG,
} from "../app/admin/editions/helpers.ts";
import { dateProblem, validSlug } from "../lib/editions/rules.ts";

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
const actions = read("app/admin/editions/actions.ts");
const testOrg = read("app/admin/editions/test-organisation/actions.ts");

function bodies(src) {
  return src.split(/\nexport async function /).slice(1).map((b) => ({ name: b.slice(0, b.indexOf("(")), body: b }));
}

test("every action authenticates first, uses the user's client, never a service key", () => {
  for (const [file, src] of [["actions", actions], ["test-org", testOrg]]) {
    assert.match(src, /^"use server";/);
    assert.match(src, /createClient\b.*@\/lib\/supabase\/server/);
    assert.doesNotMatch(src, /service[_-]?key|SERVICE_ROLE|createServiceClient|supabase\/admin/i, file);
    const fns = bodies(src);
    assert.ok(fns.length > 0);
    for (const f of fns) {
      const afterSig = f.body.slice(f.body.indexOf("{\n") + 2).trimStart();
      assert.ok(/^(const admin = )?await requireAdmin\(\);/.test(afterSig), `${file}:${f.name} must call requireAdmin first`);
    }
  }
});

test("actions call the staff RPCs and revalidate", () => {
  for (const rpc of ["admin_decide_edition_organiser", "admin_link_edition_organiser_hub", "admin_mark_edition_test", "edition_moderate", "admin_grant_edition_entitlement", "admin_void_edition_entitlement"]) {
    assert.ok(actions.includes(`"${rpc}"`), rpc);
  }
  assert.match(actions, /revalidatePath/);
  assert.doesNotMatch(actions, /\.from\("edition_(organisers|entitlements)"\)\s*\.(insert|update|delete)/);
});

test("test organisation goes through RPCs, not table writes to organisers, entitlements or status", () => {
  for (const rpc of ["create_edition_organiser", "request_edition_organiser_verification", "admin_decide_edition_organiser", "admin_mark_edition_test", "admin_grant_edition_entitlement", "edition_set_status"]) {
    assert.ok(testOrg.includes(`"${rpc}"`), rpc);
  }
  assert.doesNotMatch(testOrg, /from\("edition_organisers"\)\s*\.(insert|update|upsert|delete)/);
  assert.doesNotMatch(testOrg, /from\("edition_entitlements"\)\s*\.(insert|update|upsert|delete)/);
  assert.doesNotMatch(testOrg, /\.update\(\{\s*status/);
  assert.doesNotMatch(testOrg, /\.update\(/);
});

test("controls are role-gated in the UI", () => {
  const forms = read("components/admin/EditionsAdminForms.tsx");
  assert.match(forms, /ADMIN_ONLY_DECISIONS\.includes\(d\)/);
  const org = read("app/admin/editions/organisers/[id]/page.tsx"), ed = read("app/admin/editions/[id]/page.tsx");
  assert.match(org, /isAdmin\(\)/); assert.match(org, /\{admin && \(/);
  assert.match(ed, /admin \? <>.*GrantForm/s); assert.match(ed, /admin && \(st === "live"/);
});

test("sidebar and stats", () => {
  assert.match(read("components/admin/AdminSidebar.tsx"), /href: "\/admin\/editions", label: "Editions", badgeKey: "pendingEditionVerifications"/);
  assert.match(read("lib/admin-data.server.ts"), /count\("edition_organiser_verifications"/);
});

test("decisions per status", () => {
  assert.deepEqual(decisionsFor("pending"), ["verify", "reject", "suspend"]);
  assert.deepEqual(decisionsFor("verified"), ["suspend"]);
  assert.deepEqual(decisionsFor("rejected"), ["reinstate"]);
});

test("tabs default safely", () => {
  assert.equal(parseTab(undefined), "queue"); assert.equal(parseTab("audit"), "audit"); assert.equal(parseTab("nope"), "queue");
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

test("admin errors keep known guard messages and soften the rest", () => {
  assert.match(adminError("a reserved-name organiser needs a written verification note"), /reserved-name/);
  assert.match(adminError("an overlapping admin grant already exists"), /overlapping/);
  assert.match(adminError("permission denied for table x"), /permission/);
  assert.doesNotMatch(adminError("weird internal pg detail 12345"), /12345/);
});

test("test plan is labelled, valid and unambiguous", () => {
  const p = buildTestPlan(new Date("2027-01-01T00:00:00Z"));
  assert.equal(p.edition.slug, TEST_EDITION_SLUG); assert.ok(validSlug(p.edition.slug) && validSlug(p.organiser.slug));
  assert.equal(p.edition.starts_on, "2027-03-02"); assert.equal(p.edition.ends_on, "2027-03-04");
  assert.equal(dateProblem(p.edition.kind, p.edition.starts_on, p.edition.ends_on), null);
  assert.equal(p.pages.length, 3); assert.equal(p.pages.filter((x) => x.is_home).length, 1);
  assert.equal(p.sessions.length, 6); assert.equal(p.sessions.filter((s) => s.status === "cancelled").length, 1);
  assert.ok(p.sessions.some((s) => s.ticket_url === "https://example.com/zz-test-tickets"));
  for (const s of p.sessions) {
    assert.equal(s.ticket_mode === "external", s.ticket_url !== null);
    const d = s.starts_at.slice(0, 10); assert.ok(d >= p.edition.starts_on && d <= p.edition.ends_on);
    assert.ok(Date.parse(s.ends_at) > Date.parse(s.starts_at));
  }
  assert.equal(p.updates.length, 2); assert.equal(p.updates.filter((u) => u.pinned).length, 1);
  assert.equal(p.sponsors.length, 2);
  assert.ok(p.grant.reason.length >= 5 && p.grant.days === 90);
  const all = JSON.stringify(p);
  assert.doesNotMatch(all, /taste of shetland|wool week|up helly|folk festival/i);
  for (const t of [p.organiser.name, p.edition.title, ...p.pages.map((x) => x.title), ...p.sessions.map((x) => x.title), ...p.updates.map((x) => x.title), ...p.sponsors.map((x) => x.name), p.venue.name]) assert.match(t, /ZZ TEST/);
  assert.ok(p.pages.every((x) => x.nav_label.length <= 30 && !/<\s*(script|iframe)/i.test(x.body)));
});

test("steps cover the real path in order", () => {
  const keys = STEPS.map((s) => s.key);
  assert.ok(keys.indexOf("verify") < keys.indexOf("grant") && keys.indexOf("grant") < keys.indexOf("publish"));
  assert.ok(keys.indexOf("mark_edition_test") < keys.indexOf("publish"));
});

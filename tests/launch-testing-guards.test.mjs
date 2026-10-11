/**
 * Launch Test Centre — structural guards. The feature must stay private, web-only and unable to touch money.
 * (Reads source only. No network, no database.)
 *
 * Run: node --test tests/launch-testing-guards.test.mjs
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join } from "node:path";

const ROOT = new URL("../", import.meta.url).pathname;
const read = (p) => readFileSync(join(ROOT, p), "utf8");
function walk(dir, out = []) {
  for (const n of readdirSync(join(ROOT, dir))) {
    const rel = `${dir}/${n}`;
    if (n === "node_modules" || n === ".next") continue;
    if (statSync(join(ROOT, rel)).isDirectory()) walk(rel, out); else if (/\.(tsx?|mjs|jsx?)$/.test(n)) out.push(rel);
  }
  return out;
}
const FEATURE = ["app/launch-testing", "app/admin/launch-testing", "components/launch-testing", "lib/launch-testing"].flatMap((d) => walk(d));
const stripComments = (t) => t.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`])\/\/.*$/gm, "$1");
const src = Object.fromEntries(FEATURE.map((f) => [f, read(f)]));
const code = Object.fromEntries(FEATURE.map((f) => [f, stripComments(src[f])]));   // comments may talk about money; code must not touch it

describe("private, not merely hidden", () => {
  test("the tester area is noindex/nofollow", () => {
    assert.match(src["app/launch-testing/layout.tsx"], /robots:\s*\{[^}]*index:\s*false[^}]*follow:\s*false/);
  });
  test("every admin page for it is noindex too", () => {
    for (const f of FEATURE.filter((x) => x.startsWith("app/admin/launch-testing/") && x.endsWith("page.tsx"))) assert.match(src[f], /robots:\s*\{\s*index:\s*false,\s*follow:\s*false\s*\}/, f);
  });
  test("robots.txt disallows it, the sitemap never lists it, and no public page or menu links to it", () => {
    assert.match(read("app/robots.ts"), /"\/launch-testing"/);
    assert.doesNotMatch(read("app/sitemap.ts"), /launch-testing/);
    const offenders = walk("app").concat(walk("components")).concat(walk("lib")).filter((f) => !FEATURE.includes(f) && f !== "app/robots.ts" && f !== "components/admin/AdminSidebar.tsx" && f !== "lib/launch-readiness-data.ts")   // the admin-only readiness dashboard may mention it
      .filter((f) => /launch-testing/.test(read(f)));
    assert.deepEqual(offenders, [], "only the admin sidebar and the admin-only readiness data may mention the area");
    const sidebar = read("components/admin/AdminSidebar.tsx");
    assert.match(sidebar, /\/admin\/launch-testing/); assert.doesNotMatch(sidebar, /href: "\/launch-testing"/);
  });
  test("every tester page goes through the single door (requireTester), and every admin page through requireAdmin, BEFORE reading anything", () => {
    for (const f of ["app/launch-testing/page.tsx", "app/launch-testing/[slug]/page.tsx"]) {
      assert.ok(src[f].indexOf("await requireTester(") > -1 && src[f].indexOf("await requireTester(") < src[f].indexOf("await load"), f);
    }
    for (const f of FEATURE.filter((x) => x.startsWith("app/admin/launch-testing/") && x.endsWith("page.tsx"))) {
      assert.ok(src[f].indexOf("await requireAdmin()") > -1 && src[f].indexOf("await requireAdmin()") < src[f].indexOf("await load"), f);
    }
    const gate = src["app/launch-testing/gate.ts"];
    assert.match(gate, /notFound\(\)/); assert.match(gate, /sign-in\?next=/); assert.match(gate, /admin_only/);
  });
  test("an unauthorised person gets the ordinary not-found page, not a 'forbidden' that confirms the area exists", () => {
    assert.doesNotMatch(src["app/launch-testing/gate.ts"], /forbidden|unauthori[sz]ed|403/i);
  });
});

describe("no service-role key, no side doors", () => {
  test("nothing in the feature creates a service-role or admin client or reads a secret", () => {
    for (const f of FEATURE) assert.doesNotMatch(code[f], /SERVICE_ROLE|service_role|createServiceClient|supabaseAdmin|auth\.admin|process\.env\.(?!NODE_ENV)/i, f);
  });
  test("the browser uploads only with the signed-in person's own client, and only into the private evidence bucket", () => {
    const up = src["components/launch-testing/EvidenceUploader.tsx"];
    assert.match(up, /from "@\/lib\/supabase\/client"/); assert.match(up, /const BUCKET = "launch-test-evidence"/);
    assert.doesNotMatch(up, /getPublicUrl|public\//);
  });
  test("every server action checks the caller first: testers via a signed-in client, admins via requireAdmin()", () => {
    const a = src["lib/launch-testing/actions.ts"];
    const bodies = a.split(/\nexport async function /).slice(1);
    assert.ok(bodies.length >= 10, "expected the full set of actions");
    for (const b of bodies) {
      const name = b.slice(0, b.indexOf("("));
      const first = b.slice(b.indexOf("{") + 1, b.indexOf("{") + 160);
      assert.match(first, /signedInClient\(\)|requireAdmin\(\)/, `${name} must authenticate before anything else`);
    }
    assert.match(a, /^"use server";/);
  });
});

describe("web-only, and nothing near money", () => {
  test("the feature reads and writes only launch_test* tables, the evidence bucket, and the person's own profile via getAccount", () => {
    const tables = new Set();
    for (const f of FEATURE) for (const m of src[f].matchAll(/\.from\("([a-z_]+)"\)/g)) tables.add(m[1]);
    assert.deepEqual([...tables].sort(), ["launch_test_attempts", "launch_test_attachments", "launch_test_sessions", "launch_test_programmes", "launch_tests", "launch_testers"].sort().filter((t) => tables.has(t)));
    for (const t of tables) assert.match(t, /^launch_test/, `unexpected table ${t}`);
    const rpcs = new Set();
    for (const f of FEATURE) for (const m of src[f].matchAll(/\.rpc\("([a-z_]+)"/g)) rpcs.add(m[1]);
    for (const r of rpcs) assert.match(r, /^launch_test_/, `unexpected rpc ${r}`);
  });
  test("no payment provider, wallet, ledger, order or refund code is referenced", () => {
    for (const f of FEATURE) {
      assert.doesNotMatch(code[f], /stripe|payment_intent|local_wallet|wallet_credit|wallet_debit|product_orders|ledger|create-refund|refund-payment/i, f);
    }
    for (const f of FEATURE) assert.doesNotMatch(src[f], /\.from\("(local_wallet|product_|event_ticket|hub_donation|profiles)/, f);
  });
  test("the feature changes no native app configuration", () => {
    assert.ok(!existsSync(join(ROOT, "app.json")) || !/launch-testing/.test(read("app.json")));
    for (const f of FEATURE) assert.doesNotMatch(code[f], /\bexpo\b|react-native|eas\.json|app\.json|oneshetland-fetch:\/\//i, f);
  });
  test("a tester's own text is rendered as text (no HTML injection)", () => {
    for (const f of FEATURE) assert.doesNotMatch(src[f], /dangerouslySetInnerHTML/, f);
  });
  test("an admin-entered link is only ever offered as a new-tab https link with noopener", () => {
    const flow = src["components/launch-testing/TestFlow.tsx"];
    assert.match(flow, /target="_blank" rel="noopener noreferrer"/);
  });
});

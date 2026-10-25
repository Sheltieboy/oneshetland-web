/**
 * Fetch v2 web — release-candidate integration guards (Step 14A). The v1 Fetch web code is retired to legacy/ (not built, typechecked
 * or linted); nothing that ships writes a Fetch table from the browser, calls the v1 notify functions, imports a v1 Fetch component,
 * or subscribes to a raw job table; the header chip speaks v2; the old Operations screen forwards to the Fetch operations console.
 * Run: node --test tests/fetch-rc-integration.test.mjs
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { headerSummary } from "../lib/fetch/header.ts";

const root = new URL("..", import.meta.url).pathname;
const read = (p) => readFileSync(join(root, p), "utf8");
const walk = (d) => readdirSync(join(root, d)).flatMap((f) => { const p = join(d, f); return statSync(join(root, p)).isDirectory() ? walk(p) : /\.(tsx?|mjs)$/.test(f) ? [p] : []; });
const SHIPPED = ["app", "components", "lib"].flatMap(walk).concat(["proxy.ts"]);
const code = (s) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
const TABLES = "delivery_requests|runs|driver_profiles|waiting_events|fetch_[a-z_]+|driver_verification_[a-z_]+";

test("nothing that ships writes a Fetch table from the browser or the server", () => {
  const re = new RegExp(`from\\(["'](${TABLES})["']\\)[\\s\\S]{0,160}?\\.(insert|update|upsert|delete)\\(`);
  for (const f of SHIPPED) assert.ok(!re.test(code(read(f))), `${f} writes a Fetch table`);
});
test("nothing that ships calls the v1 notify functions or subscribes to a raw Fetch table", () => {
  for (const f of SHIPPED) {
    const s = code(read(f));
    assert.ok(!/["']notify-(drivers|collected)["']/.test(s), `${f} calls a v1 notify function`);
    assert.ok(!(/postgres_changes/.test(s) && new RegExp(`table:\\s*["'](${TABLES})["']`).test(s)), `${f} subscribes to a raw Fetch table`);
  }
});
test("the v1 Fetch components are retired to legacy/ and nothing imports them (PlaceAutocomplete stays: the event form uses it)", () => {
  assert.deepEqual(readdirSync(join(root, "components/fetch")).sort(), ["PlaceAutocomplete.tsx", "v2"]);
  for (const f of SHIPPED) assert.ok(!/(from|import\()\s*["'][^"']*legacy\//.test(code(read(f))), `${f} imports retired code`);
  assert.match(read("tsconfig.json"), /"exclude": \["node_modules", "legacy"\]/);
  assert.match(read("eslint.config.mjs"), /"legacy\/\*\*"/);
  assert.ok(existsSync(join(root, "legacy/fetch-v1/components/fetch/RequestComposer.tsx")), "kept for reference");
});
test("the old Operations screen forwards to Fetch operations and is gone from the menus", () => {
  assert.match(read("app/admin/operations/page.tsx"), /redirect\("\/admin\/fetch"\)/);
  for (const f of ["components/admin/AdminSidebar.tsx", "app/admin/page.tsx"]) assert.ok(!read(f).includes('"/admin/operations"'), f);
});
test("the header chip is v2: the server summary, a server action to refresh, no browser client, no subscription, no animation", () => {
  const chip = read("components/fetch/v2/HeaderChip.tsx");
  assert.ok(!/@\/lib\/supabase|\.channel\(|postgres_changes|animate-/.test(chip));
  assert.match(chip, /headerSummaryAction\(\)/);
  assert.match(read("app/layout.tsx"), /await getFetchHeaderSummary\(\)/);
  assert.match(read("components/site/SiteHeader.tsx"), /<HeaderChip initial=\{fetchStatus\} \/>/);
});
test("the header chip says what the Fetch page says: attention first, then the most progressed; one Fetch links straight to it", () => {
  const row = (o) => ({ id: "11111111-1111-4111-8111-111111111111", status: "pending", payment_status: "none", created_at: "", closed_at: null, route: "A → B",
    item_description: "x", size_class: "small", total_fee_pence: 1, cancel_requested: false, expires_at: null, ...o });
  assert.equal(headerSummary([]), null);
  assert.equal(headerSummary([row({ status: "delivered" })]), null);
  assert.deepEqual(headerSummary([row({})]), { label: "Looking for someone", tone: "neutral", count: 1, href: "/fetch/requests/11111111-1111-4111-8111-111111111111" });
  const two = headerSummary([row({ status: "collected", payment_status: "authorised" }), row({ id: "2", status: "matched", payment_status: "requires_action" })]);
  assert.deepEqual(two, { label: "Payment needs your attention", tone: "attention", count: 2, href: "/fetch" });
  assert.equal(headerSummary([row({ status: "pending" }), row({ id: "2", status: "collected", payment_status: "authorised" })]).label, "On its way");
});

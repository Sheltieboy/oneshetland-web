/**
 * Fetch safety pause (web side). Run: node --test tests/fetch-pause.test.mjs
 * The notice replaces EVERY /fetch route, fails closed, and never invites anyone into a workflow; admin approval cannot silently "succeed".
 * The database enforcement itself is proved by supabase/tests/fetch-safety-pause.verify.sql (rolled-back, real role impersonation) in the backend worktree.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const root = new URL("..", import.meta.url).pathname;
const read = (p) => readFileSync(join(root, p), "utf8");
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");

test("fetchIsOpen fails closed: only an explicit true opens Fetch; errors and exceptions mean paused", () => {
  const s = strip(read("lib/fetch-paused.ts"));
  assert.match(s, /return !error && data === true;/); assert.match(s, /catch \{ return false; \}/);
  assert.match(s, /rpc\("fetch_is_open"\)/);
});
test("every Fetch route sits under the gate: a layout wraps all of app/fetch and renders the notice unless open", () => {
  const l = strip(read("app/fetch/layout.tsx"));
  assert.match(l, /if \(!\(await fetchIsOpen\(\)\)\) return <FetchPaused \/>;/); assert.match(l, /dynamic = "force-dynamic"/);
  const pages = []; const walk = (d) => { for (const f of readdirSync(d)) { const p = join(d, f); statSync(p).isDirectory() ? walk(p) : /^page\.tsx$/.test(f) && pages.push(p); } }; walk(join(root, "app/fetch"));
  assert.ok(pages.length >= 6, "the existing Fetch pages are untouched and all inherit the layout");
  assert.ok(!existsSync(join(root, "app/fetch/route.ts")), "no unguarded route handler under /fetch");
});
test("the notice is calm and invites no one: no request, drive, apply, sign-in or payment link, no promised date", () => {
  const c = strip(read("components/fetch/FetchPaused.tsx"));
  assert.match(c, /Being prepared for launch/);
  const hrefs = [...c.matchAll(/href="([^"]+)"/g)].map((m) => m[1]); assert.deepEqual(hrefs.sort(), ["/", "/whats-on"], "the only links lead away from Fetch");
  assert.doesNotMatch(c, /<button|<form|<input/i);
  assert.doesNotMatch(c, /\b(20\d\d|soon|next week|this month|within)\b/i, "no date or timeline is promised");
  assert.match(c, /Back to the homepage/);
});
test("admin: approving is disabled while paused, a refused or empty update is shown as an error, and an application is only removed after a real change", () => {
  const a = strip(read("components/admin/DriverApprovals.tsx"));
  assert.match(a, /disabled=\{busy === r\.id \|\| approvalsPaused\}/); assert.match(a, /if \(error\) \{ setErr\(error\.message\); return; \}/);
  assert.match(a, /data\.length === 0/); assert.match(a, /role="alert"/);
  assert.ok(a.indexOf("setErr(error.message)") < a.indexOf("setList((l) => l.filter"), "the list changes only after the checks");
  assert.match(strip(read("app/admin/drivers/page.tsx")), /Fetch is paused/);
});
test("the migration (when the backend checkout is present) drops the privacy policies, guards every transaction path, defaults to paused and is reversible", () => {
  const f = join(root, "../oneshetland-social-ac/supabase/migrations/20261212000000_fetch_safety_pause.sql");
  if (!existsSync(f)) return;
  const sql = strip(readFileSync(f, "utf8"));
  assert.match(sql, /'fetch\.operations', 'paused'/); assert.match(sql, /coalesce\(\(select lower\(btrim\(value\)\) from public\.admin_config where key = 'fetch\.operations'\), 'paused'\) = 'open'/);
  for (const p of ["Approved drivers can read all pending requests", "Approved drivers can read pending requests", "Approved drivers can accept pending requests", "Drivers must have bank connected to accept requests"]) assert.match(sql, new RegExp(`drop policy if exists "${p}"`));
  for (const t of ["delivery_requests", "runs", "driver_profiles"]) assert.match(sql, new RegExp(`create trigger ${t}_a_fetch_pause`));
  assert.match(sql, /Accepting jobs is paused/); assert.match(sql, /Driver approvals are paused/); assert.match(sql, /Driver applications are paused/);
  assert.doesNotMatch(sql, /delete from public\.(delivery_requests|driver_profiles|runs)|update public\.driver_profiles|drop table|truncate/i, "no record is deleted or altered");
  assert.ok(existsSync(f.replace("migrations/20261212000000_fetch_safety_pause.sql", "rollbacks/20261212000000_fetch_safety_pause.rollback.sql")));
});

/**
 * Fetch operations console — source contracts for the pages and components (they are .tsx, which plain node cannot render).
 * Admin-gated on the server; reads only through the admin functions; changes only through fetch-v2-admin; no direct table
 * writes; no storage paths or permanent links; no card data; no optimistic success; the old direct-write approval screen gone.
 * Run: node --test tests/fetch-admin-console.test.mjs
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const ROOT = new URL("..", import.meta.url).pathname;
const read = (p) => readFileSync(join(ROOT, p), "utf8");
const walk = (d) => readdirSync(join(ROOT, d)).flatMap((f) => { const p = join(d, f); return statSync(join(ROOT, p)).isDirectory() ? walk(p) : [p]; });
const FILES = [...walk("app/admin/fetch"), ...walk("components/admin/fetch"), ...walk("lib/fetch-admin")];
const PAGES = FILES.filter((f) => f.endsWith("page.tsx"));

describe("access", () => {
  test("the admin layout checks the administrator on the server for every page under /admin", () => {
    assert.match(read("app/admin/layout.tsx"), /await requireAdmin\(\);/);
  });
  test("every read and every server action checks the administrator again", () => {
    const data = read("lib/fetch-admin/data.server.ts");
    assert.match(data, /async function rpc[\s\S]*?await requireAdmin\(\);/);
    assert.match(data, /export async function getDriverRecord[\s\S]*?await requireAdmin\(\);/);
    const actions = read("app/admin/fetch/actions.ts");
    const fns = actions.split("export async function ").slice(1);
    assert.equal(fns.length, 3);
    for (const f of fns) assert.match(f.slice(0, f.indexOf("\n}")), /^\w+[\s\S]*?\{\n\s+await requireAdmin\(\);/);
  });
  test("every page is rendered per request (never cached as static output)", () => {
    for (const p of PAGES) assert.match(read(p), /export const dynamic = "force-dynamic";/, p);
  });
});

describe("no direct writes; one way to change anything", () => {
  test("no insert / update / delete / upsert, no browser Supabase client, anywhere in the console", () => {
    for (const f of FILES) {
      const s = read(f);
      assert.doesNotMatch(s, /\.(insert|update|delete|upsert)\(/, f);
      assert.doesNotMatch(s, /@\/lib\/supabase\/client/, f);
    }
  });
  test("the only edge function called is fetch-v2-admin, with the administrator's own session", () => {
    const calls = FILES.flatMap((f) => [...read(f).matchAll(/functions\.invoke\("([^"]+)"/g)].map((m) => m[1]));
    assert.deepEqual([...new Set(calls)], ["fetch-v2-admin"]);
    assert.match(read("lib/fetch-admin/edge.server.ts"), /Authorization: `Bearer \$\{session\.access_token\}`/);
  });
  test("reads are the administrator-gated database functions only", () => {
    const rpcs = FILES.flatMap((f) => [...read(f).matchAll(/rpc\("([a-z_0-9]+)"/g)].map((m) => m[1]));
    assert.deepEqual([...new Set(rpcs)].sort(), ["fetch_v2_admin_job", "fetch_v2_admin_jobs", "fetch_v2_admin_member", "fetch_v2_admin_queues"]);
  });
  test("actions are built from the registry, and the result shown is the server's — never assumed", () => {
    const actions = read("app/admin/fetch/actions.ts");
    assert.match(actions, /const built = buildAdminRequest\(id, input\);/);
    const btn = read("components/admin/fetch/FetchActionButton.tsx");
    assert.match(btn, /const r = await runFetchAdminAction\(action, \{ target, reason, fields \}\);/);
    assert.match(btn, /if \(r\.ok\) router\.refresh\(\);/);
    assert.ok(btn.indexOf("router.refresh()") > btn.indexOf("await runFetchAdminAction"), "refresh only after the server answered");
    assert.match(btn, /disabled=\{busy \|\| \(spec\.reason === "required" && reason\.trim\(\)\.length < 3\)\}/);
    assert.match(btn, /\{spec\.consequence\}/);
  });
  test("administrator notification links (/admin/fetch/requests/<id>, Step 8) land on the job page", () => {
    assert.match(read("app/admin/fetch/requests/[id]/page.tsx"), /redirect\(`\/admin\/fetch\/jobs\/\$\{id\}`\)/);
  });
  test("the old one-click approval screen (a direct driver_status write) is gone and its route forwards to the new review", () => {
    assert.equal(existsSync(join(ROOT, "components/admin/DriverApprovals.tsx")), false);
    assert.match(read("app/admin/drivers/page.tsx"), /redirect\("\/admin\/fetch\/drivers"\)/);
    assert.doesNotMatch(read("lib/admin-data.server.ts"), /getPendingDrivers/);
    assert.match(read("components/admin/AdminSidebar.tsx"), /href: "\/admin\/fetch", label: "Fetch operations"/);
  });
});

describe("sensitive data", () => {
  test("no storage path, public URL or signed link is part of any page; links are fetched on click and opened, never kept", () => {
    for (const f of FILES) assert.doesNotMatch(read(f), /storage_path|getPublicUrl|createSignedUrl|fetch-driver-verification|fetch-photos/, f);
    const link = read("components/admin/fetch/ShortLinkButton.tsx");
    assert.match(link, /if \(r\.ok\) window\.open\(r\.url, "_blank", "noopener,noreferrer"\)/);
    assert.doesNotMatch(link, /href=|setUrl|useState<string>\(/);
    assert.match(read("app/admin/fetch/drivers/[id]/page.tsx"), /<ShortLinkButton kind="evidence" id=\{it\.item_id\}/);
  });
  test("no card data is shown — Fetch holds none; only Stripe's state for the hold", () => {
    for (const p of PAGES) assert.doesNotMatch(read(p), /last4|card_number|client_secret|cvc|brand/i, p);
  });
  test("an issue's text is never in a list — only on the job page", () => {
    assert.doesNotMatch(read("app/admin/fetch/issues/page.tsx"), /\.detail/);
    assert.doesNotMatch(read("app/admin/fetch/page.tsx"), /\.detail/);
  });
  test("no vague confirmation copy anywhere in the console", () => {
    for (const f of FILES) assert.doesNotMatch(read(f), /are you sure/i, f);
  });
});

describe("the job page is the whole picture", () => {
  const page = read("app/admin/fetch/jobs/[id]/page.tsx");
  test("summary, money, payment, timeline, issues, messages, photos, description history, matching and notifications", () => {
    for (const t of ["Actions", "Summary", "Money", "Payment", "Timeline", "Issues", "Messages", "Photos", "Description history", "Matching", "Notifications"])
      assert.match(page, new RegExp(`title="${t}`), t);
  });
  test("the timeline is the stored history, read as it is", () => {
    assert.match(page, /\(timeline as Row\[\]\)\.map\(\(e\) =>/);
  });
  test("push 'accepted' is never called delivered", () => {
    assert.match(page, /accepted ≠ delivered/);
    assert.doesNotMatch(read("app/admin/fetch/notifications/page.tsx"), /delivered</);
  });
});

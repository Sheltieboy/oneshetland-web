/**
 * Fetch v2 web — source contracts for the member pages and components (Step 11): flag gating, sign-in, no direct database or storage
 * access, privacy before acceptance and after the windows, plain copy, accessibility basics, the Step 8 deep links, and the old v1 routes.
 * Pages are .tsx (not loadable under plain node), so these read the source. Run: node --test tests/fetch-member-pages.test.mjs
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { isFetchPath, SHOP_FETCH_DELIVERY_OFFERED } from "../lib/fetch-availability.ts";

const root = new URL("..", import.meta.url).pathname;
const read = (p) => readFileSync(join(root, p), "utf8");
const walk = (dir) => readdirSync(join(root, dir)).flatMap((f) => (statSync(join(root, dir, f)).isDirectory() ? walk(join(dir, f)) : [join(dir, f)]));
const pages = walk("app/fetch").filter((f) => f.endsWith("page.tsx"));
const v2 = walk("components/fetch/v2");
const code = (src) => src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "").replace(/^import .*$/gm, "");
const REDIRECTS = { "app/fetch/apply/page.tsx": "/fetch/drive/apply", "app/fetch/runs/new/page.tsx": "/fetch/journeys/new", "app/fetch/previous/page.tsx": "/fetch/history",
  "app/fetch/about/page.tsx": "/fetch", "app/fetch/connect-bank/page.tsx": "/account/payments", "app/fetch/[id]/page.tsx": "/fetch/requests/" };

test("every Fetch route sits behind the server flag gate (proxy rewrite to coming-soon); the preview route does not", () => {
  const proxy = read("proxy.ts");
  assert.match(proxy, /isFetchPath\(request\.nextUrl\.pathname\) && !\(await fetchEnabledFor\(supabase\)\)/);
  for (const p of pages) {
    const url = "/" + p.replace(/^app\//, "").replace(/\/page\.tsx$/, "").replace(/\[(\w+)\]/g, "x");
    assert.ok(isFetchPath(url), url);
  }
  assert.equal(isFetchPath("/dev/fetch-preview/a"), false);
});

test("member pages are dynamic, require sign-in on the server, and load only through the shared client", () => {
  for (const p of pages) {
    const s = read(p);
    if (REDIRECTS[p]) { assert.ok(s.includes(`redirect(${p.includes("[id]") ? "`" : '"'}${REDIRECTS[p]}`), p); continue; }
    assert.match(s, /export const dynamic = "force-dynamic"/, p);
    if (p !== "app/fetch/page.tsx") assert.match(s, /await requireMember\(/, p);
    assert.ok(!/createClient|\.from\(|\.rpc\(|functions\.invoke/.test(s), `${p} bypasses lib/fetch-api`);
  }
  const loader = read("lib/fetch/load.server.ts");
  assert.match(loader, /redirect\(`\/sign-in\?next=\$\{encodeURIComponent\(next\)\}`\)/);
});

test("no browser code writes a table, reads a Fetch table directly, or touches storage paths", () => {
  for (const f of [...v2, ...pages, "app/fetch/actions.ts", "lib/fetch-api.ts", "lib/fetch/load.server.ts", "lib/fetch/transport.server.ts"]) {
    const s = code(read(f));
    assert.ok(!/\.(insert|update|upsert|delete)\(/.test(s), `${f} writes`);
    assert.ok(!/storage\.from|storage_path|bucket_id|object_path/.test(s), `${f} storage`);
    assert.ok(!/\.from\("(delivery_requests|runs|driver_profiles|fetch_[a-z_]+)"\)/.test(s), `${f} reads a Fetch table`);
  }
  for (const f of v2) if (read(f).startsWith('"use client"')) assert.ok(!/@\/lib\/supabase|fetch\/transport\.server/.test(read(f)), `${f} imports a Supabase client`);
  // Uploads go to the one-use address the server hands out; nothing else is fetched from the browser.
  assert.match(read("components/fetch/v2/upload.ts"), /fetch\(b\.data\.upload_url, \{ method: "PUT"/);
});

test("server actions pass identifiers and choices only — never an amount", () => {
  const s = read("app/fetch/actions.ts");
  for (const m of s.matchAll(/export async function (\w+)\(([^)]*)\)/g)) assert.ok(!/pence|amount|price|fee|total/i.test(m[2]), `${m[1]}(${m[2]})`);
  assert.match(s, /^"use server";/);
});

test("privacy: the board and accept screens never touch the requester's identity, exact addresses, phone or notes", () => {
  for (const f of ["components/fetch/v2/Board.tsx", "components/fetch/v2/AcceptPanel.tsx", "app/fetch/board/page.tsx", "app/fetch/board/[id]/page.tsx"]) {
    assert.ok(!/pickup_location|destination_address|contact_phone|requester_first_name|pickup_name|pickup_notes|delivery_notes|safe_place_note/.test(read(f)), f);
  }
  // Board photos open only through the board-safe view.
  assert.match(read("components/fetch/v2/AcceptPanel.tsx"), /photoViewAction\(photo, true\)/);
});

test("privacy: history is the safe summary; phone only while shared; addresses only while the server says so", () => {
  const home = read("components/fetch/v2/Home.tsx");
  assert.ok(!/pickup_location|destination_address|contact_phone|notes/.test(home));
  const driver = read("components/fetch/v2/DriverJob.tsx");
  assert.match(driver, /detail\.phone_shared && r\.contact_phone &&/);
  assert.match(driver, /detail\.addresses_visible === false/);
  const requester = read("components/fetch/v2/RequesterJob.tsx");
  assert.ok(!/contact_phone/.test(requester), "the requester page never shows a phone number");
  assert.match(requester, /r\.operational_details_visible !== false && r\.pickup_location/);
  assert.ok(!/driver\.(id|phone|full_name|last_name)/.test(requester), "only the driver's first name and vehicle");
});

test("privacy: verification documents and photos open only through short-lived links for their owner/party", () => {
  const d = read("components/fetch/v2/Driver.tsx");
  assert.match(d, /evidenceViewAction\(id\)/);
  assert.match(read("lib/fetch-api.ts"), /action: "view_own", item_id: itemId/);
  assert.match(read("components/fetch/v2/JobParts.tsx"), /photoViewAction\(id\)/);
  for (const f of v2) assert.ok(!/https?:\/\/[^"'\s]*supabase/.test(read(f)), f);
});

test("copy: plain UK English — no payment-provider, database or state-machine words on screen", () => {
  const banned = /\bStripe\b|PaymentIntent|payment_intent|webhook|\bRPC\b|edge function|idempotenc|\bstatus code\b|fulfil(l)?ment|courier|logistics/;
  for (const f of [...v2, ...pages]) {
    const s = code(read(f)).replace(/"[a-z_]+"/g, ""); // identifiers in quotes are code, not copy
    const text = [...s.matchAll(/>([^<>{}]+)</g)].map((m) => m[1]).join(" ") + " " + [...s.matchAll(/"([^"]{12,})"/g)].map((m) => m[1]).join(" ");
    assert.ok(!banned.test(text), `${f}: ${text.match(banned)?.[0]}`);
  }
  assert.match(read("components/fetch/v2/JobParts.tsx"), /Your bank needs you to confirm this payment authorisation\./);
  assert.match(read("components/fetch/v2/RequesterJob.tsx"), /This isn&apos;t a booking yet — a driver still needs to accept your Fetch\./);
  assert.match(read("components/fetch/v2/AcceptPanel.tsx"), /I&apos;ve checked the item details and it will fit in my vehicle\./);
  assert.match(read("components/fetch/v2/DriverButtons.tsx"), /Return reported — OneShetland will review this\./);
  assert.match(read("components/fetch/v2/RequestWizard.tsx"), /so the driver can make sure it will fit/);
});

test("accessibility basics: dialogs, status with words not colour alone, labelled controls, no motion", () => {
  assert.match(read("components/ui/Modal.tsx"), /role="dialog"/);
  assert.match(read("components/fetch/v2/ActionDialog.tsx"), /<Modal /);
  const ui = read("components/fetch/v2/ui.tsx");
  assert.match(ui, /role="status"/); assert.match(ui, /\{status\.label\}/); assert.match(ui, /sr-only">to</);
  for (const f of v2) {
    const s = read(f);
    assert.ok(!/animate-|transition-all/.test(s), `${f} animates`);
    // every select/textarea/file/text input sits inside a <label> (checked in the browser preview too)
    const controls = (s.match(/<(select|textarea)\b/g) ?? []).length;
    assert.ok((s.match(/<label\b/g) ?? []).length >= controls, f);
  }
  assert.match(read("components/fetch/v2/RequestWizard.tsx"), /aria-current=\{i === step \? "step" : undefined\}/);
  assert.match(read("components/fetch/v2/Board.tsx"), /aria-current=\{!showAll \? "page" : undefined\}/);
});

test("refresh without a full reload: job pages and the board refresh while visible; messages poll", () => {
  for (const p of ["app/fetch/requests/[id]/page.tsx", "app/fetch/jobs/[id]/page.tsx", "app/fetch/board/page.tsx"]) assert.match(read(p), /<LiveRefresh \/>/, p);
  assert.match(read("components/fetch/v2/LiveRefresh.tsx"), /visibilityState/);
  assert.match(read("components/fetch/v2/JobParts.tsx"), /setInterval\(tick, 15_000\)/);
});

test("Step 8 deep links all land on a page; the old v1 addresses forward to v2", () => {
  for (const p of ["app/fetch/board/[id]/page.tsx", "app/fetch/requests/[id]/page.tsx", "app/fetch/requests/[id]/payment/page.tsx", "app/fetch/jobs/[id]/page.tsx", "app/fetch/driver/verification/page.tsx"]) {
    assert.ok(existsSync(join(root, p)), p);
  }
  for (const [p, to] of Object.entries(REDIRECTS)) assert.ok(read(p).includes(to), p);
  // No v2 page or component imports the v1 Fetch components.
  for (const f of [...pages, ...v2]) assert.ok(!/@\/components\/fetch\/(?!v2\/)/.test(read(f)), f);
});

test("Shop's Fetch delivery option stays hidden (v1 requests would never reach v2 drivers)", () => {
  assert.equal(SHOP_FETCH_DELIVERY_OFFERED, false);
});

test("the fixture preview exists only in development with FETCH_PREVIEW=1, outside /fetch", () => {
  const s = read("app/dev/fetch-preview/[scenario]/page.tsx");
  assert.match(s, /if \(process\.env\.NODE_ENV === "production" \|\| process\.env\.FETCH_PREVIEW !== "1"\) notFound\(\);/);
  assert.ok(!/actions"|fetchApi|createClient/.test(s.replace(/^import .*AcceptPanel.*$/m, "")), "the preview loads nothing");
});

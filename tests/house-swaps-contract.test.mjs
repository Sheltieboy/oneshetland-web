import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join } from "node:path";

const root = new URL("..", import.meta.url).pathname;
const read = (p) => readFileSync(join(root, p), "utf8");
function walk(d) { return readdirSync(join(root, d)).flatMap((n) => { const p = `${d}/${n}`; return statSync(join(root, p)).isDirectory() ? walk(p) : [p]; }); }
const pages = walk("app/house-swaps").filter((p) => /page\.tsx$/.test(p));
const allSrc = [...walk("app/house-swaps"), ...walk("components/house-swaps"), "lib/house-swaps.ts", "lib/house-swaps-data.ts"].map((p) => [p, read(p)]);

// The RPC names the backend migration defines (copied from the migration's grant list; checked against the real file when it is on disk).
const RPCS = ["house_swaps_enabled", "upsert_my_house_swap", "my_house_swap", "set_my_house_swap_status", "confirm_my_house_swap", "add_my_house_swap_photo", "remove_my_house_swap_photo", "house_swap_matches", "start_house_swap_thread", "my_house_swap_threads", "house_swap_thread_messages", "send_house_swap_message", "close_house_swap_thread", "report_house_swap", "admin_house_swap_queue", "admin_house_swap_reports", "admin_house_swap_decide", "admin_house_swap_reported_thread", "house_swaps_gate", "admin_house_swap_invites", "admin_house_swap_invite_add", "admin_house_swap_invite_remove"];

test("every page checks the feature flag (404 when off)", () => {
  assert.ok(pages.length >= 8, `found ${pages.length} pages`);
  for (const p of pages) assert.match(read(p), /await requireHouseSwaps\(\)/, p);
  assert.match(read("app/house-swaps/layout.tsx"), /await houseSwapsGate\(\)/);
  assert.match(read("app/house-swaps/layout.tsx"), /gate\.mode === "off"\) notFound\(\)/);
  assert.match(read("lib/house-swaps-data.ts"), /notFound\(\)/);
});
test("section is noindex and not in the sitemap", () => {
  assert.match(read("app/house-swaps/layout.tsx"), /index: false/);
  assert.doesNotMatch(read("app/sitemap.ts"), /house-swaps/);
});
test("only RPCs that exist are called", () => {
  const used = new Set();
  for (const [, s] of allSrc) for (const m of s.matchAll(/(?:callRpc(?:<[^>]*>)?\([^,]+,|\.rpc\()\s*"([a-z_]+)"/g)) used.add(m[1]);
  assert.ok(used.size >= 14, [...used].join());
  for (const u of used) assert.ok(RPCS.includes(u), `unknown rpc ${u}`);
  const mig = "/Users/darrenfullerton/Claude/oneshetland-be-houseswaps/supabase/migrations/20270201000000_house_swaps.sql";
  if (existsSync(mig)) { const sql = readFileSync(mig, "utf8"); for (const u of used) assert.ok(sql.includes(`function public.${u}(`), `${u} not in migration`); }
});
test("no service-role client and no direct table access", () => {
  for (const [p, s] of allSrc) {
    assert.doesNotMatch(s, new RegExp("service" + "[_-]role", "i"), p);
    assert.doesNotMatch(s, /\.from\("house_swap_(listings|photos|threads|messages|audit)"\)/, p);
  }
  assert.match(read("lib/house-swaps-data.ts"), /house_swap_listings_public/);
});
test("the shared disclaimer is shown on the advert, form and about pages", () => {
  assert.match(read("lib/house-swaps.ts"), /We don't check eligibility, approve exchanges or act for any landlord\. Any mutual exchange needs the written consent of both landlords and must follow Scottish housing rules, so speak to your landlord before you agree anything\./);
  assert.match(read("components/house-swaps/Shell.tsx"), /HOUSE_SWAPS_DISCLAIMER/);
  for (const p of ["app/house-swaps/page.tsx", "app/house-swaps/[id]/page.tsx", "app/house-swaps/about/page.tsx"]) assert.match(read(p), /<Disclaimer/, p);
  assert.match(read("components/house-swaps/MyAdvertForm.tsx"), /HOUSE_SWAPS_DISCLAIMER/);
});
test("no names, addresses or contact fields are collected or rendered", () => {
  const form = read("components/house-swaps/MyAdvertForm.tsx");
  for (const bad of [/name="(phone|email|address|full_name|postcode)"/, /type="(tel|email)"/, /owner_id/, /full_name|display_name/]) { assert.doesNotMatch(form, bad); }
  for (const [p, s] of allSrc) { assert.doesNotMatch(s, /owner_id|initiator_id|display_name|full_name|profiles/, p); }
  assert.match(read("lib/house-swaps.ts"), /CONTACT_RULE/);
});
test("photos: re-encoded through a canvas to JPEG before upload, max 6, own folder", () => {
  const ph = read("components/house-swaps/PhotoManager.tsx");
  assert.match(ph, /toBlob\(res, "image\/jpeg", 0\.82\)/);
  assert.match(ph, /fitWithin\(bmp\.width, bmp\.height, 1600\)/);
  assert.ok(ph.indexOf("reencode(file)") < ph.indexOf(".upload("));
  assert.match(ph, /house-swap-photos/);
  assert.match(read("lib/house-swaps.ts"), /MAX_PHOTOS = 6/);
});
test("navigation entry is gated by the flag via context, leaving existing nav sources as they were", () => {
  assert.match(read("app/layout.tsx"), /const houseSwaps = await houseSwapsEnabled\(\)/);
  assert.match(read("app/layout.tsx"), /<HouseSwapsNavProvider enabled=\{houseSwaps\}>/);
  const nf = read("components/house-swaps/NavFlag.tsx");
  assert.equal((nf.match(/if \(!useHouseSwapsNav\(\)\) return null/g) ?? []).length, 3);
  assert.match(read("components/site/SiteHeader.tsx"), /<HouseSwapsMoreLink/);
  assert.match(read("components/site/MobileMenu.tsx"), /<HouseSwapsMenuTile/);
  assert.match(read("components/site/SiteFooter.tsx"), /<HouseSwapsFooterLink \/>/);
});
test("moderation page is staff-gated and thread reading uses the reported-thread RPC only", () => {
  const m = read("app/house-swaps/moderate/page.tsx");
  assert.match(m, /adminAccessFor/);
  assert.match(read("lib/house-swaps-data.ts"), /admin_house_swap_reported_thread/);
  assert.doesNotMatch(m, /house_swap_thread_messages/);
});
test("sign-in redirect uses next", () => {
  assert.match(read("components/house-swaps/EnquiryForm.tsx"), /signInHref\(`\/house-swaps\/\$\{listingId\}`\)/);
  assert.match(read("lib/house-swaps.ts"), /\/sign-in\?next=/);
});

test("reports list, already-enquired state, moderation flash", () => {
  assert.match(read("app/house-swaps/moderate/page.tsx"), /getReports\(\)/);
  assert.match(read("app/house-swaps/moderate/page.tsx"), /Open reported conversation/);
  assert.match(read("app/house-swaps/[id]/page.tsx"), /already sent an enquiry/);
  assert.match(read("app/house-swaps/actions.ts"), /moderate\?tab=\$\{tab\}&done=/);
  for (const p of pages) assert.match(read(p), /title: "House Swaps/, p);
});
test("the never-pay warning is one shared constant shown wherever the disclaimer is", () => {
  const lib = read("lib/house-swaps.ts");
  assert.match(lib, /Never pay anyone to arrange or speed up a house swap\. House Swaps is free, and a genuine swap never needs money to change hands\. If someone asks you for money, don't send it, and report them\./);
  assert.equal(lib.split("Never pay anyone").length - 1, 1);
  assert.match(read("components/house-swaps/Shell.tsx"), /NEVER_PAY/);
  for (const p of ["components/house-swaps/MyAdvertForm.tsx", "components/house-swaps/EnquiryForm.tsx", "app/house-swaps/messages/[id]/page.tsx"]) assert.match(read(p), /\{NEVER_PAY\}/, p);
  for (const [p, s] of allSrc) { if (p !== "lib/house-swaps.ts") assert.doesNotMatch(s, /Never pay anyone/, p); }
});
test("photo uploads refuse non-photos and over-5MB files, and withdrawing removes the files", () => {
  const pm = read("components/house-swaps/PhotoManager.tsx");
  assert.match(pm, /MAX_PHOTO_BYTES/);
  assert.match(pm, /is not a photo/);
  assert.match(read("components/house-swaps/StatusControls.tsx"), /storage\.from\("house-swap-photos"\)\.remove\(photoPaths\)/);
  assert.doesNotMatch(read("app/house-swaps/my/page.tsx"), /key=\{l \? `\$\{l\.id\}:/, "photo changes must not remount the advert form");
});

test("restricted preview: layout renders it instead of children, noindex, with sign-in next and the agreed copy", () => {
  const layout = read("app/house-swaps/layout.tsx");
  assert.match(layout, /if \(!gate\.allowed\) return <RestrictedPreview/);
  assert.ok(layout.indexOf("RestrictedPreview signedIn") < layout.indexOf("{children}"));
  assert.match(layout, /index: false/);
  const r = read("components/house-swaps/RestrictedPreview.tsx");
  assert.match(r, /House Swaps is in a private preview/);
  assert.match(r, /signInHref\("\/house-swaps"\)/);
  assert.match(r, /Sign in or create your account/);
  assert.match(r, /Use the email address you were invited with\./);
  assert.match(r, /Your account hasn&apos;t been given access yet\./);
  assert.doesNotMatch(r, /getBrowse|getListing|\bcount\b|\.rpc|callRpc/);
  const d = read("lib/house-swaps-data.ts");
  assert.match(d, /"house_swaps_gate"/);
  assert.match(d, /const off: HouseSwapsGate = \{ mode: "off"/);
  assert.match(d, /catch \{\s*return off;/);
  assert.match(d, /export async function requireHouseSwaps[\s\S]*?houseSwapsEnabled/);
});
test("preview banner is one shared constant, rendered once (in the layout), only in preview mode", () => {
  assert.match(read("lib/house-swaps.ts"), /PREVIEW_BANNER = "Private preview for invited reviewers\. Adverts marked Sample are fictional\. Anything you add is practice data and will be removed before this opens to everyone\."/);
  const uses = allSrc.filter(([p, s]) => p !== "lib/house-swaps.ts" && /PREVIEW_BANNER/.test(s)).map(([p]) => p);
  assert.deepEqual(uses, ["app/house-swaps/layout.tsx"]);
  assert.match(read("app/house-swaps/layout.tsx"), /gate\.mode === "preview" &&/);
});
test("server actions still refuse when not allowed, and the site menu uses the per-visitor database answer", () => {
  const a = read("app/house-swaps/actions.ts");
  assert.match(a, /if \(!\(await houseSwapsEnabled\(\)\)\) return null;/);
  assert.match(read("app/layout.tsx"), /houseSwapsEnabled\(\)/);
  assert.match(read("lib/house-swaps-data.ts"), /"house_swaps_enabled"/);
});
test("sample adverts are labelled everywhere and cannot be enquired about or reported", () => {
  for (const p of ["components/house-swaps/ListingCard.tsx", "components/house-swaps/MatchCard.tsx", "app/house-swaps/[id]/page.tsx"]) assert.match(read(p), /isSample\(/, p);
  assert.match(read("components/house-swaps/Chips.tsx"), /SAMPLE_BADGE/);
  assert.match(read("lib/house-swaps.ts"), /SAMPLE_BADGE = "Sample advert"/);
  assert.match(read("lib/house-swaps.ts"), /This is a sample advert, so it can't receive messages\. To try private messages, ask another reviewer to add an advert and message theirs\./);
  const d = read("app/house-swaps/[id]/page.tsx");
  assert.match(d, /\{!isMine && !sample && \(\s*<Panel className="mt-6" aria-labelledby="enq"/);
  assert.match(d, /\{!isMine && !sample && \(userId \? <ReportForm/);
  assert.match(d, /sample && <Panel[^>]*><p[^>]*>\{SAMPLE_NO_MESSAGES\}/);
  assert.match(read("components/house-swaps/ModerationCard.tsx"), /data_origin/);
  assert.match(read("app/house-swaps/page.tsx"), /MatchCard/);
});
test("invite actions are staff-only RPCs on the member's own session; emails are shown to staff only", () => {
  const a = read("app/house-swaps/actions.ts");
  assert.match(a, /callRpc\(sb, "admin_house_swap_invite_add"/);
  assert.match(a, /callRpc\(sb, "admin_house_swap_invite_remove"/);
  assert.match(a, /export async function inviteReviewer[\s\S]*?const sb = await session\(\);/);
  assert.match(read("lib/house-swaps-data.ts"), /"admin_house_swap_invites"/);
  // the panel is only rendered after the moderation page's staff check, and only that page asks for the invites
  const m = read("app/house-swaps/moderate/page.tsx");
  assert.ok(m.indexOf('access !== "allow"') < m.indexOf("getInvites()"));
  assert.deepEqual(allSrc.filter(([p, s]) => /InvitesPanel|getInvites/.test(s) && !/^(components\/house-swaps\/InvitesPanel|app\/house-swaps\/moderate|lib\/house-swaps-data)/.test(p)).map(([p]) => p), []);
  assert.doesNotMatch(read("components/house-swaps/InvitesPanel.tsx"), /add_house_swap_purge|purge/i);
  for (const [p, s] of allSrc) if (!/InvitesPanel|actions\.ts|house-swaps\.ts/.test(p)) assert.doesNotMatch(s, /\.email\b/, p);
});

test("three-step advert form: progress, per-step validation, focus on step change, one acknowledgement, location picker with map and list", () => {
  const form = read("components/house-swaps/MyAdvertForm.tsx");
  assert.match(form, /aria-current=\{current \? "step" : undefined\}/);
  assert.match(form, /validateStep\(step, f\)/);
  assert.match(form, /heading\.current\?\.focus/);
  assert.match(form, /scrollIntoView\(\{ block: "start" \}\)/);
  assert.equal((form.match(/\{NEVER_PAY\}/g) ?? []).length, 1, "never-pay shown once");
  assert.equal((form.match(/type="checkbox" checked=\{f\.acknowledged\}/g) ?? []).length, 1, "a single acknowledgement tick");
  assert.match(form, /<LocationPicker mode="home"/);
  assert.match(form, /<LocationPicker mode="wants"/);
  assert.match(form, /saveAdvert\(f\)/, "same server action");
  assert.doesNotMatch(read("app/house-swaps/my/page.tsx"), /key=\{l \?/, "the form is never remounted by a save or a photo change");
  const picker = read("components/house-swaps/LocationPicker.tsx");
  assert.match(picker, /Just keep it broad/);
  assert.match(picker, /Search for an area or community/);
  assert.match(picker, /<ShetlandMap/);
  assert.match(picker, /GROUP_NOTE/);
  const map = read("components/house-swaps/ShetlandMap.tsx");
  assert.match(map, /MAP_ATTRIBUTION/);
  assert.match(map, /tabIndex=\{0\}/);
  assert.match(map, /aria-checked/);
  assert.match(map, /Fair Isle/);
  assert.doesNotMatch(map, /fetch\(|<img|https?:\/\//, "the map loads nothing from elsewhere");
  // The chosen destinations stay on screen while you tap: the summary is rendered BEFORE the map and list, and is sticky.
  assert.ok(picker.indexOf("Where you want to move") < picker.indexOf("{map}"), "the Selected summary is rendered before the map");
  assert.ok(picker.indexOf("Where you want to move") < picker.indexOf("{list}"), "the Selected summary is rendered before the list");
  assert.match(picker, /sticky top-16/, "the summary is pinned while the map and list scroll");
  assert.match(picker, /aria-label=\{`Remove \$\{s\.label\}`\}/, "every chosen place has its own remove control");
  // A finger needs a target bigger than the dot, or the tap falls through to the region beneath.
  const hit = /Math\.max\((\d+), Math\.min\(22,/.exec(map);
  assert.ok(hit && Number(hit[1]) >= 11, `community taps need at least an 11px radius, found ${hit?.[1]}`);
});
test("communities show wherever the home's area shows; the filters accept communities", () => {
  for (const p of ["components/house-swaps/ListingCard.tsx", "components/house-swaps/MatchCard.tsx", "components/house-swaps/ModerationCard.tsx", "app/house-swaps/[id]/page.tsx"]) assert.match(read(p), /homeLocationText/, p);
  assert.match(read("components/house-swaps/BrowseFilters.tsx"), /name="place"/);
  assert.match(read("lib/house-swaps-data.ts"), /want_place_ids\.ov/);
  assert.match(read("lib/house-swaps.ts"), /have_place_id: f\.have_place_id \|\| null/);
});

test("wizard: a red message clears as soon as that part is put right (no stale errors after the first failed Next)", () => {
  const src = readFileSync(new URL("../components/house-swaps/MyAdvertForm.tsx", import.meta.url), "utf8");
  assert.match(src, /each red message clears as soon as that part is put right/);
  assert.match(src, /validateAdvert\(f\)\.errors/);
  assert.match(src, /marked in red\|need another look/, "the summary line clears when no field message is left");
});

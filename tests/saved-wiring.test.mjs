/**
 * My Saved on the website: every placement uses the ONE shared bookmark, as a sibling of the link and never inside it; with the feature OFF the
 * site is exactly what it was (no bookmark, no menu entry, no page, and the old job Save button still writes saved_jobs directly); signed-out
 * visitors are sent to sign in. Components are rendered with react-dom/server over the in-memory fake supabase; nothing touches a network.
 * Run: node --test --import ./tests/support/register.mjs tests/saved-wiring.test.mjs   (the JSX loader is registered by the file itself)
 */
import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement as h } from "react";
import fake, { setDb, setViewer } from "./support/fake-supabase.mjs";

await import("./support/register-jsx.mjs");

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
const U1 = "0b8a5a3e-6f2c-4d0a-9b57-2f1c3e4d5a61";
const U2 = "7c1d2e3f-4a5b-4c6d-8e7f-90a1b2c3d4e5";
const { SavedProvider } = await import("../components/saved/SavedProvider.tsx");
const { SaveButton } = await import("../components/saved/SaveButton.tsx");
const { ConfirmProvider } = await import("../components/ui/ConfirmProvider.tsx");

beforeEach(() => { setViewer("anon"); setDb({}); delete globalThis.__FAKE_RPC__; fake.auth.getUser = async () => ({ data: { user: null } }); });
const withSaved = (enabled, signedIn, ...kids) => h(SavedProvider, { enabled, signedIn }, ...kids);
const bookmark = (props = {}) => h(SaveButton, { type: "job", id: U1, title: "Barista", ...props });
const markup = (el) => renderToStaticMarkup(el);

// ── the bookmark itself
test("feature OFF: the bookmark renders nothing, and the provider adds no markup of its own", () => {
  assert.equal(markup(bookmark()), "", "no provider at all");
  assert.equal(markup(withSaved(false, true, bookmark())), "");
  assert.equal(markup(withSaved(false, false, h("p", null, "page"))), "<p>page</p>", "the provider is invisible when off");
});

test("feature ON: a pressable, named bookmark with a 44px target, and one polite live region", () => {
  const out = markup(withSaved(true, true, bookmark()));
  assert.match(out, /<button[^>]*type="button"/);
  assert.match(out, /aria-pressed="false"/);
  assert.match(out, /aria-label="Save Barista"/);
  assert.match(out, /h-11 w-11/, "44px");
  assert.match(out, /<svg[^>]*aria-hidden/, "inline SVG, no icon library");
  assert.match(out, /role="status" aria-live="polite"/);
  assert.equal(markup(withSaved(true, true, bookmark({ type: "event", id: U1, occurrenceKey: U2, title: "Panto", dateLabel: "Saturday 6 December", variant: "row" }))).includes('aria-label="Save Panto, Saturday 6 December"'), true);
  assert.match(markup(withSaved(true, true, bookmark({ variant: "dark" }))), /min-h-\[44px\]/);
});

test("a bookmark with a malformed id or key renders nothing rather than a button that cannot work", () => {
  assert.equal(markup(withSaved(true, true, bookmark({ id: "nope" }))), markup(withSaved(true, true)));
  assert.equal(markup(withSaved(true, true, bookmark({ type: "job", occurrenceKey: U2 }))).includes("<button"), false, "a job has no key");
});

test("signed out: the tap goes to /sign-in with the page and the instruction", () => {
  const src = read("components/saved/SaveButton.tsx");
  assert.match(src, /if \(!signedIn\) \{ router\.push\(signInHrefForSave\(`\$\{window\.location\.pathname\}\$\{window\.location\.search\}`, ref\)\); return; \}/);
  assert.match(src, /if \(out === "signin"\) router\.push\(signInHrefForSave/, "a session that expired mid-way is sent to sign in too");
  assert.match(src, /saved \? await api\.unsave\(ref\) : await api\.save\(ref\)/, "explicit save and remove calls, never a blind toggle");
});

test("a business save shows its one line; Undo is offered on a plain save", () => {
  const prov = read("components/saved/SavedProvider.tsx");
  assert.match(prov, /ref\.type === "business" \? BUSINESS_SAVE_LINE : MSG\.saved/);
  assert.match(prov, /opts\?\.undo === false \? undefined/);
});

// ── placements: each imports the shared button; none nests it inside a link
const PLACEMENTS = {
  "components/events/EventsListing.tsx": ['type="event"', 3],            // EventRow, FeaturedStrip (FeaturedEvent renders it), OnSaleStrip: three sites
  "app/whats-on/[id]/page.tsx": ['type="event"', 1],
  "components/events/PerformancesList.tsx": ["occurrenceKey={eventDateKey(o.id)}", 1],
  "components/activities/ActivityCard.tsx": ['type="activity"', 1],
  "components/activities/detail/ActivityDetailView.tsx": ['type="activity"', 3],   // whole activity, next session, full schedule rows
  "components/activities/SessionList.tsx": ["occurrenceKey={sessionKey(s)}", 1],
  "components/jobs/JobsUI.tsx": ['type="job"', 1],
  "app/jobs/[id]/page.tsx": ['type="job"', 1],
  "components/jobs/JobApplyPanel.tsx": ['type="job"', 1],
  "components/local/LocalUI.tsx": ['type="business"', 1],
  "app/directory/[id]/page.tsx": ['type="business"', 1],
  "components/business-page/PublishedBusinessPage.tsx": ['type="business"', 1],
};
for (const [file, [needle, min]] of Object.entries(PLACEMENTS)) {
  test(`${file} uses the shared bookmark`, () => {
    const src = read(file);
    assert.match(src, /import \{ SaveButton \} from "@\/components\/saved\/SaveButton"/);
    const n = src.split(needle).length - 1;
    assert.ok(n >= min, `expected at least ${min} of ${needle}, found ${n}`);
    // Never inside a link: no <SaveButton ...> between an opening <Link ...> and its closing </Link>.
    for (const m of src.matchAll(/<Link\b[\s\S]*?<\/Link>/g)) assert.doesNotMatch(m[0], /<SaveButton/, "a bookmark inside a link");
    for (const m of src.matchAll(/<a\b[^>]*>[\s\S]*?<\/a>/g)) assert.doesNotMatch(m[0], /<SaveButton/, "a bookmark inside an anchor");
  });
}
test("the Events list cards each carry exactly one bookmark (strip, on-sale strip, row) and FeaturedEvent reuses the strip", () => {
  const src = read("components/events/EventsListing.tsx");
  assert.equal(src.split("<SaveButton").length - 1, 3);
  assert.match(src, /export function FeaturedEvent[\s\S]*<FeaturedStrip events=\{\[e\]\} \/>/);
});
test("the activity detail page highlights ?session= and the page parses it", () => {
  assert.match(read("app/whats-on/regular/[slug]/page.tsx"), /parseSessionParam\(\(await searchParams\)\?\.session\)/);
  assert.match(read("components/activities/detail/ActivityDetailView.tsx"), /aria-current=\{isHi\(s\) \? "true" : undefined\}/);
});
test("the business save sits beside Follow for non-owners only, in both layouts", () => {
  const std = read("app/directory/[id]/page.tsx");
  assert.match(std, /isOwner \? \([\s\S]*Manage business[\s\S]*\) : \(\s*<>\s*<FollowButton[\s\S]*<SaveButton type="business"/);
  const pub = read("components/business-page/PublishedBusinessPage.tsx");
  assert.match(pub, /isOwner\s*\?\s*<Link[\s\S]*Manage business[\s\S]*:\s*<><FollowButton[\s\S]*<SaveButton type="business"/);
});
test("the job page bookmark is in the hero (visible to signed-out visitors), for non-owners", () => {
  const src = read("app/jobs/[id]/page.tsx");
  const hero = src.slice(src.indexOf("{/* Hero */}"), src.indexOf("{/* Facts */}"));
  assert.match(hero, /\{!isOwner && <SaveButton type="job"/);
});

// ── feature OFF keeps the old job button exactly
test("flag OFF: JobApplyPanel keeps the old Save button and its direct saved_jobs write; flag ON replaces only the button", async () => {
  const src = read("components/jobs/JobApplyPanel.tsx");
  assert.match(src, /await sb\.from\("saved_jobs"\)\.delete\(\)\.eq\("user_id", user\.id\)\.eq\("job_id", jobId\)/);
  assert.match(src, /await sb\.from\("saved_jobs"\)\.insert\(\{ user_id: user\.id, job_id: jobId \}\)/);
  assert.match(src, /savedOn \? \(\s*<SaveButton[^>]*\/>\s*\) : \(\s*<button onClick=\{toggleSave\}[\s\S]*\{saved \? "★ Saved" : "☆ Save job"\}/);
  const { JobApplyPanel } = await import("../components/jobs/JobApplyPanel.tsx");
  const props = { jobId: U1, jobTitle: "Barista", isLoggedIn: true, alreadyApplied: false, isSaved: false, snapshot: null };
  const off = markup(h(JobApplyPanel, props));
  assert.match(off, /☆ Save job/);
  assert.doesNotMatch(off, /<button[^>]*data-save-button/);
  const on = markup(withSaved(true, true, h(JobApplyPanel, props)));
  assert.doesNotMatch(on, /☆ Save job/);
  assert.match(on, /<button[^>]*data-save-button/);
  assert.match(on, /aria-label="Save Barista"/);
  assert.match(markup(withSaved(false, true, h(JobApplyPanel, props))), /☆ Save job/, "provider present but off: the old button");
});

test("flag OFF: cards and menus are what they were; flag ON: the bookmark is a sibling of the card link", async () => {
  const { JobCard } = await import("../components/jobs/JobsUI.tsx");
  const { BusinessCard } = await import("../components/local/LocalUI.tsx");
  const job = { id: U1, title: "Barista", contract_type: "full_time", remote_mode: "on_site", pay_type: "salary", pay_min: null, pay_max: null, employer_id: U2, business: null, description: "Pour coffee", status: "open", expires_at: null };
  const biz = { id: U1, name: "The Shop", slug: "the-shop", is_claimed: true, is_verified: false, subscription_tier: "free", category: null, description: null, cover_url: null, logo_url: null, brand_color: null };
  for (const [name, el] of [["job", h(JobCard, { job })], ["business", h(BusinessCard, { b: biz })]]) {
    assert.doesNotMatch(markup(el), /<button[^>]*data-save-button/, `${name} off`);
    const on = markup(withSaved(true, true, el));
    assert.match(on, /<button[^>]*data-save-button/, `${name} on`);
    assert.doesNotMatch(on, /<a[^>]*>(?:(?!<\/a>)[\s\S])*<button[^>]*data-save-button/, `${name}: not inside the link`);
  }
});

test("menus: the My Saved entries exist only behind the feature flag", async () => {
  const header = read("components/site/SiteHeader.tsx"), mobile = read("components/site/MobileMenu.tsx"), side = read("components/account/AccountSidebar.tsx"), tile = read("app/account/page.tsx");
  assert.match(header, /\{savedOn && \(\s*<Link href="\/account\/saved"/);
  assert.match(mobile, /\{savedOn && <Link href="\/account\/saved"/);
  assert.match(side, /if \(savedOn\) activity\.splice\([\s\S]*href: "\/account\/saved"/);
  assert.match(tile, /\{savedOn && \(\s*<Link href="\/account\/saved"/);
  const { AccountSidebar } = await import("../components/account/AccountSidebar.tsx");
  const off = markup(h(AccountSidebar, { isAdmin: false, isBusiness: false }));
  assert.doesNotMatch(off, /My Saved|\/account\/saved/);
  const on = markup(withSaved(true, true, h(AccountSidebar, { isAdmin: false, isBusiness: false })));
  assert.match(on, /href="\/account\/saved"[^>]*>My Saved/);
});

test("the layout reads saved_enabled() once, on the server, and wraps the site in the provider", () => {
  const src = read("app/layout.tsx");
  assert.match(src, /const savedEnabled = await getSavedEnabled\(\)/);
  assert.match(src, /<SavedProvider enabled=\{savedEnabled\} signedIn=\{!!account\}>/);
  assert.match(read("lib/saved.server.ts"), /rpc\("saved_enabled"\)/);
  assert.match(read("lib/saved.server.ts"), /return !error && data === true/, "fails closed");
});

// ── the page
test("/account/saved: signed out is sent to sign in; the feature off is a 404; an error is shown plainly; a list renders", async () => {
  const { default: SavedPage } = await import("../app/account/saved/page.tsx");
  assert.match(read("app/account/saved/page.tsx"), /redirect\("\/sign-in\?next=\/account\/saved"\)/);
  assert.match(read("app/account/saved/page.tsx"), /export const dynamic = "force-dynamic"/);
  await assert.rejects(() => SavedPage(), /redirect/, "signed out");

  fake.auth.getUser = async () => ({ data: { user: { id: U2, email: "a@b.test" } } });
  globalThis.__FAKE_RPC__ = async (fn) => (fn === "saved_enabled" ? { data: false, error: null } : { data: { items: [], total: 0, more: false }, error: null });
  await assert.rejects(() => SavedPage(), /notFound/, "feature off");

  globalThis.__FAKE_RPC__ = async (fn) => (fn === "saved_enabled" ? { data: true, error: null } : { data: null, error: { code: "XX000", message: "boom" } });
  assert.match(markup(await SavedPage()), /Couldn&#x27;t load your saved items|Couldn't load your saved items/);

  globalThis.__FAKE_RPC__ = async (fn) => (fn === "saved_enabled" ? { data: true, error: null } : { data: { items: [], total: 0, more: false }, error: null });
  assert.match(markup(await SavedPage()), /Nothing saved yet/);

  const item = (o) => ({ item_type: "event", item_id: U1, occurrence_key: null, saved_at: "2026-11-01T10:00:00Z", state: "upcoming", bucket: 1, sort_at: "2026-12-01T19:00:00Z", title: "Panto", place: "Mareel", starts_at: "2026-12-01T19:00:00Z", ends_at: null, note: null, from_snapshot: false, slug: null, parent_readable: true, ...o });
  const rows = [item({}), item({ item_id: U2, item_type: "job", bucket: 3, state: "snapshot_expired", from_snapshot: true, title: "Cook", starts_at: null }), item({ item_type: "business", item_id: U2, bucket: 3, state: "unavailable", title: null, starts_at: null })];
  globalThis.__FAKE_RPC__ = async (fn) => (fn === "saved_enabled" ? { data: true, error: null } : { data: { items: rows, total: 3, more: false }, error: null });
  const page = await SavedPage();
  const out = markup(h(ConfirmProvider, null, withSaved(true, true, page)));
  for (const s of ["Panto", "Mareel", "Coming up", "Past and unavailable", "Expired", "As it was when you saved it", "Saved 1 Nov", "No longer available", "Clear past"]) assert.ok(out.includes(s), s);
  for (const s of ["All", "Events", "Jobs", "Businesses"]) assert.ok(out.includes(`>${s} <`) || out.includes(`${s} <span`), s);
  assert.doesNotMatch(out, /href="\/jobs\/7c1d2e3f/, "a snapshot row never links to the job");
});

test("/jobs/saved changes only by one link to My Saved (behind the flag)", () => {
  const src = read("app/jobs/saved/page.tsx");
  assert.match(src, /\{savedOn && <p className="mt-2 text-sm"><Link href="\/account\/saved"/);
  assert.match(src, /const jobs = await getSavedJobs\(\)/);
  assert.match(src, /jobs\.map\(\(j\) => <JobCard key=\{j\.id\} job=\{j\} \/>\)/);
});

test("Clear past: a confirmation first, chunks of 200, no Undo", () => {
  const src = read("components/saved/SavedList.tsx");
  assert.match(src, /const yes = await confirm\(/);
  assert.match(src, /for \(const part of chunk\(rows\)\)/);
  assert.match(src, /api\.announce\(CLEAR_PAST\.done\(cleared\)\)/, "announced without an Undo");
});

test("the provider never cancels the pending flags request in an unmount cleanup (React Strict Mode would then drop it)", () => {
  const src = readFileSync(new URL("../components/saved/SavedProvider.tsx", import.meta.url), "utf8");
  assert.doesNotMatch(src, /useEffect\(\(\) => \(\) => \{[^}]*clearTimeout\(timer\.current\)/);
});

test("the bookmark never uses the disabled attribute while a save is in flight (a disabled button drops keyboard focus)", () => {
  const src = readFileSync(new URL("../components/saved/SaveButton.tsx", import.meta.url), "utf8");
  assert.doesNotMatch(src, /\sdisabled=\{/);
  assert.match(src, /aria-disabled=\{busy/);
});

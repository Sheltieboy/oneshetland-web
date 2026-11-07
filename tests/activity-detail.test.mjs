/**
 * The public Regular Activity page (redesign): what it shows, derived only from what the activity says; cost wording; changed-session warnings;
 * privacy of drafts; and no extra database work. Run: node --test tests/activity-detail.test.mjs
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { formatPrice, safeHttps, nextLiveSession, stillToCome, changedAhead, movedFrom, changeLine, joinSummary, monthGroups, ACTIVITY_CATEGORIES } from "../lib/activities.ts";

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
const NOW = new Date("2026-11-06T09:43:00Z");
const s = (starts, status = "scheduled", extra = {}) => ({ starts_at: starts, ends_at: new Date(Date.parse(starts) + 3_600_000).toISOString(), status, original_starts_at: starts, note: null, venue: null, ...extra });

// ── cost
test("a bare number is finished off as money; every free-text price is kept exactly as the organiser wrote it", () => {
  assert.equal(formatPrice("10"), "£10"); assert.equal(formatPrice(" 10 "), "£10"); assert.equal(formatPrice("7.5"), "£7.50"); assert.equal(formatPrice("7.50"), "£7.50"); assert.equal(formatPrice("10.00"), "£10");
  assert.equal(formatPrice("0"), "Free");
  for (const t of ["Free", "free", "Donation", "Small donation", "£6 drop-in", "£10", "10 per class", "£5 / £3 concessions", "Pay what you can", "10.555", "1,000"]) assert.equal(formatPrice(t), t, t);
  for (const e of ["", "   ", null, undefined]) assert.equal(formatPrice(e), null, JSON.stringify(e));
});
test("photos and links are only ever shown when they are plain https", () => {
  assert.equal(safeHttps("https://example.test/a.jpg"), "https://example.test/a.jpg");
  for (const bad of ["http://x.test/a.jpg", "javascript:alert(1)", "//x.test/a", "https://x.test/a b", "data:image/png;base64,AAA", "", null, undefined]) assert.equal(safeHttps(bad), null, String(bad));
});

// ── sessions
test("the next session is the first one still ahead that is not cancelled or on a break", () => {
  const rows = [s("2026-11-06T08:00:00Z"), s("2026-11-10T18:00:00Z", "cancelled"), s("2026-11-12T18:00:00Z", "break"), s("2026-11-13T10:30:00Z", "moved"), s("2026-11-20T10:30:00Z")];
  assert.equal(nextLiveSession(rows, NOW).starts_at, "2026-11-13T10:30:00Z");
  assert.equal(stillToCome(rows, NOW).length, 4, "the one already finished today is dropped");
  assert.equal(nextLiveSession([s("2026-11-10T18:00:00Z", "cancelled")], NOW), null);
  assert.equal(nextLiveSession([], NOW), null);
});
test("changes are never hidden: cancelled, break, moved and changed sessions ahead are all listed for the warning", () => {
  const rows = [s("2026-11-05T08:00:00Z", "cancelled"), s("2026-11-10T18:00:00Z", "cancelled", { note: "Instructor away" }), s("2026-11-11T18:00:00Z"), s("2026-11-12T18:00:00Z", "changed", { venue: "Hall B", note: "Room change" }), s("2026-11-13T10:00:00Z", "moved", { original_starts_at: "2026-11-13T10:30:00Z" }), s("2026-11-14T10:00:00Z", "extra")];
  assert.deepEqual(changedAhead(rows, NOW).map((r) => r.status), ["cancelled", "changed", "moved"], "past ones and plain/extra sessions are not warnings");
});
test("warning wording is plain and complete", () => {
  assert.equal(changeLine(s("2026-11-10T18:00:00Z", "cancelled", { note: "Instructor away" })), "Tue 10 Nov, 18:00 is cancelled (Instructor away)");
  assert.equal(changeLine(s("2026-11-07T10:00:00Z", "moved", { original_starts_at: "2026-11-06T10:30:00Z", note: "Moved to Saturday this week" })), "Fri 6 Nov, 10:30 has moved to Sat 7 Nov, 10:00 (Moved to Saturday this week)");
  assert.equal(changeLine(s("2026-11-12T18:00:00Z", "changed", { venue: "Hall B", note: "Room change" }), "Hall A"), "Thu 12 Nov, 18:00 has changed at Hall B (Room change)");
  assert.equal(movedFrom(s("2026-11-07T10:00:00Z", "moved", { original_starts_at: "2026-11-06T10:30:00Z" })), "Moved from Fri 6 Nov, 10:30");
  assert.equal(movedFrom(s("2026-11-07T10:00:00Z")), null);
});
test("how to join comes from the activity's own settings, and a booking activity never claims to be drop-in", () => {
  assert.equal(joinSummary({ booking_mode: "drop_in", contact_info: null, booking_url: null }).headline, "Drop in");
  assert.deepEqual(joinSummary({ booking_mode: "contact", contact_info: "Phone Hilary", booking_url: null }), { headline: "Get in touch first", detail: "Phone Hilary", href: null, cta: null });
  const link = joinSummary({ booking_mode: "link", contact_info: null, booking_url: "https://x.test/book" });
  assert.equal(link.headline, "Book online"); assert.equal(link.href, "https://x.test/book");
  const broken = joinSummary({ booking_mode: "link", contact_info: null, booking_url: "http://nope.test" });
  assert.equal(broken.headline, "Booking is needed"); assert.equal(broken.href, null);
});
test("the full schedule groups by London month", () => {
  const g = monthGroups([s("2026-11-27T10:30:00Z"), s("2026-12-04T10:30:00Z"), s("2026-12-11T10:30:00Z")]);
  assert.deepEqual(g.map((x) => [x.month, x.rows.length]), [["November 2026", 1], ["December 2026", 2]]);
});

// ── the view: nothing invented, privacy, accessibility, no extra database work
const view = read("components/activities/detail/ActivityDetailView.tsx");
const data = read("lib/activities-data.ts");
test("nothing is invented: description, venue, price, audience, owner and photo each appear only when the activity has them", () => {
  assert.match(view, /\{a\.description && \(/);
  assert.match(view, /\{price && /);
  assert.match(view, /\{place && /);
  assert.match(view, /\{a\.audience && /);
  assert.match(view, /const price = formatPrice\(a\.price_text\)/);
  assert.match(view, /const photo = safeHttps\(a\.cover_url\)/);
  assert.match(view, /const ownerKnown = owner\.kind !== "platform" && !!owner\.name/);
  assert.doesNotMatch(view, /Listed by OneShetland/);
  const code = (view + data).replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
  assert.doesNotMatch(code, /"A business"|"A hub"|Run by a /, "no placeholder organiser");
});
test("the organiser's name is read with the VIEWER'S session (so a business that is not yet publicly listed still shows its name to its own organiser)", () => {
  assert.match(data, /async function loadOwner\(a: ActivityDetail, sb: Awaited<ReturnType<typeof createClient>>\)/);
  assert.match(data, /loadOwner\(act, sb\)/);
  assert.doesNotMatch(data.slice(data.indexOf("async function loadOwner"), data.indexOf("/** For a business or hub page")), /publicClient\(\)/);
});
test("no extra database calls: the page makes the same reads as before, and the manager check is skipped for visitors", () => {
  const f = data.slice(data.indexOf("export async function getActivityDetail"), data.indexOf("async function loadOwner"));
  const calls = [...f.matchAll(/\.(from|rpc)\("([a-z_]+)"/g)].map((m) => m[2]).sort();
  assert.deepEqual(calls, ["activity_follower_count", "activity_follows", "activity_schedule_rules", "activity_sessions", "regular_activities"]);
  assert.match(f, /userP\.then\(\(user\) => \(user \? sb\.rpc\("activity_follower_count"/);
  assert.equal((f.match(/auth\.getUser\(\)/g) ?? []).length, 1, "who is looking is read once");
});
test("drafts and paused listings stay private to the people who manage them: a banner says so, Follow is hidden, and public data is unchanged", () => {
  assert.match(view, /Only you can see this\./);
  assert.match(view, /\{isPublic && <FollowButton /);
  const page = read("app/whats-on/regular/[slug]/page.tsx");
  assert.match(page, /const isPublic = a\.status === "published" && !a\.admin_paused;/);
  assert.match(page, /status !== "published" \|\| d\.activity\.admin_paused\) return \{ title: "Regular activity" \}/, "a draft's details never reach page metadata");
  assert.match(data, /Read with the VISITOR'S OWN session/, "drafts are visible only through row security");
});
test("follow is prominent when available (in the introduction) and keeps its exact wording and behaviour", () => {
  assert.ok(view.indexOf("<FollowButton") < view.indexOf('aria-labelledby="next-h"'), "above the next session");
  assert.match(view, /tone="onDark"/);
  const f = read("components/activities/FollowButton.tsx");
  assert.match(f, /No emails or phone alerts yet, and no reminders\./); assert.match(f, /activity_follows/);
});
test("changes are prominent: a warning section above the next session, the preview shows cancelled and moved sessions, and the schedule keeps every status", () => {
  assert.ok(view.indexOf('id="changes-h"') < view.indexOf('id="next-h"'));
  assert.match(view, /changedAhead\(sessions, now\)/);
  assert.match(view, /line-through/); assert.match(view, /SESSION_STATUS_LABEL\[s\.status\]/);
  assert.match(view, /Check before you go/);
});
test("the long list is replaced by a compact preview and an expandable full schedule (a real <details>, so it works without scripts and with a keyboard)", () => {
  assert.match(view, /const preview = ahead\.slice\(0, 6\)/);
  assert.match(view, /<details className="group/); assert.match(view, /<summary /);
  assert.match(view, /See the full schedule \(\{ahead\.length\} sessions\)/);
  assert.match(view, /ahead\.length > preview\.length/);
});
test("accessibility and reduced motion: landmarks and headings, focus rings, and every transition is switched off for reduced motion", () => {
  assert.equal((view.match(/<h1 /g) ?? []).length, 1);
  for (const id of ["next-h", "soon-h", "about-h", "join-h", "where-h"]) assert.match(view, new RegExp(`aria-labelledby="${id}"`));
  assert.match(view, /focus-visible:outline/);
  for (const m of view.matchAll(/className="[^"]*\btransition\b[^"]*"/g)) assert.match(m[0], /motion-reduce:transition-none/, m[0].slice(0, 80));
  assert.doesNotMatch(view, /animate-|@keyframes|setInterval|requestAnimationFrame/);
  const f = read("components/activities/FollowButton.tsx"); for (const m of f.matchAll(/className=\{?"[^"]*\btransition\b[^"]*"/g)) assert.match(m[0], /motion-reduce:transition-none/);
  assert.match(view, /<svg aria-hidden/);
});
test("every kind of activity has a hero colour pair, and a listing with no photo uses it (equally finished)", () => {
  for (const c of ACTIVITY_CATEGORIES) assert.match(read("components/activities/tokens.ts"), new RegExp(`\\b${c.value}: \\["#`), c.value);
  assert.match(view, /data-hero=\{photo \? "photo" : "colour"\}/);
  assert.match(view, /SafeImage src=\{photo\}|<SafeImage src=\{photo\}/, "a broken photo falls back to the colour hero");
});
test("scheduling, recurrence, cancellation and following are untouched: the view only reads sessions the database computed", () => {
  assert.doesNotMatch(view, /generate_series|setHours|activity_exceptions|activity_breaks|\.from\(|rpc\(/);
  assert.match(read("app/whats-on/regular/[slug]/page.tsx"), /getActivityDetail\(slug, now\)/);
});

test("homepage Recently joined strip: first swipe card clears the screen edge; shelf layout untouched", () => {
  const home = read("components/preview/v2/HomeV2.tsx");
  const m = home.match(/<ul [^>]*className="[^"]*snap-x[^"]*"/g) || [];
  assert.ok(m.length >= 2);
  for (const ul of m) assert.match(ul, /scroll-p[lx]-5/);
});

test("polish: next session, how to join and where carry restrained brand tints; About and Organiser stay neutral; structure and copy unchanged", () => {
  const v = read("components/activities/detail/ActivityDetailView.tsx");
  const sec = (id) => v.match(new RegExp(`<section aria-labelledby="${id}"[^>]*className=\\{?"([^"]*)"`))?.[1] ?? "";
  assert.match(sec("next-h"), /var\(--color-jobs\)/); assert.match(sec("join-h"), /var\(--color-events\)/); assert.match(sec("where-h"), /var\(--color-teal\)/);
  for (const id of ["about-h", "org-h"]) assert.match(sec(id), /bg-paper/, id);
  assert.doesNotMatch(sec("about-h") + sec("org-h"), /color-mix/);
  // tints are a few percent only, never a saturated block
  for (const m of v.matchAll(/color-mix\(in_srgb,var\(--color-[a-z-]+\)_(\d+)%,#fff\)/g)) assert.ok(Number(m[1]) <= 26, m[0]);
  // the words are the same, and no new data access
  for (const t of ["Next session", "How to join", "Coming up", "Organiser", "Open in Maps", "Who it&apos;s for:", "See their"]) assert.ok(v.includes(t), t);
  assert.doesNotMatch(v, /\.from\(|rpc\(|fetch\(/);
  // small labels on the tinted card are the darker ink, not the muted grey that falls under 4.5:1 on the tint
  const dl = v.slice(v.indexOf('<dl className="mt-4 grid grid-cols-2'), v.indexOf("</dl>"));
  assert.doesNotMatch(dl, /text-ink-muted/);
});

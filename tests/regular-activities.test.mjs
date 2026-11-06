/**
 * Regular Activities (web): wording, London-time windows, validation, filters. The database rules are proved in
 * supabase/tests/regular-activities.node.test.ts; this file proves the website's own logic and that it only uses what the database provides.
 * Run: node --test tests/regular-activities.test.mjs
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  patternText, windowFor, londonMidnight, londonInstant, londonDate, londonDow, addDays, dayLabel, timeRange, timeHM, groupByDay, nextLine,
  regularHref, parseDays, parseWhen, safeCategory, whenForEventsRange, validateActivityDraft, validateRuleDraft, validateBreakDraft,
  ACTIVITY_CATEGORIES, DEFAULT_WHEN, isLive,
} from "../lib/activities.ts";

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
const R = (d, s, e, extra = {}) => ({ day_of_week: d, start_time: `${s}:00`, end_time: `${e}:00`, ...extra });

// ── wording
test("a schedule reads like a timetable", () => {
  assert.equal(patternText([R(5, "10:30", "12:30")]), "Fridays, 10:30–12:30");
  assert.equal(patternText([R(4, "18:00", "19:00"), R(2, "18:00", "19:00")]), "Tuesdays and Thursdays, 18:00–19:00");
  assert.equal(patternText([R(1, "09:30", "10:30"), R(4, "18:30", "19:30")]), "Mondays, 09:30–10:30 · Thursdays, 18:30–19:30");
  assert.equal(patternText([R(0, "10:00", "11:00"), R(1, "10:00", "11:00"), R(3, "10:00", "11:00")]), "Mondays, Wednesdays and Sundays, 10:00–11:00");
  assert.equal(patternText([R(2, "19:00", "20:00", { interval_weeks: 2 })]), "Every other Tuesday, 19:00–20:00");
  assert.equal(patternText([]), "Schedule to be confirmed");
  assert.equal(patternText([R(1, "09:00", "10:00", { is_active: false })]), "Schedule to be confirmed", "switched-off rules are not shown");
  assert.equal(patternText([R(1, "09:00", "10:00"), R(2, "10:00", "11:00"), R(3, "11:00", "12:00"), R(4, "12:00", "13:00")]), "Several sessions each week");
});

// ── Shetland time
test("London midnight is right on ordinary days and across both clock changes", () => {
  assert.equal(londonMidnight("2026-07-01").toISOString(), "2026-06-30T23:00:00.000Z");   // BST
  assert.equal(londonMidnight("2026-11-07").toISOString(), "2026-11-07T00:00:00.000Z");   // GMT
  assert.equal(londonMidnight("2026-10-25").toISOString(), "2026-10-24T23:00:00.000Z");   // the day BST ends: still starts at BST midnight
  assert.equal(londonMidnight("2026-10-26").toISOString(), "2026-10-26T00:00:00.000Z");
  assert.equal(londonMidnight("2027-03-28").toISOString(), "2027-03-28T00:00:00.000Z");   // the day BST begins
  assert.equal(londonMidnight("2027-03-29").toISOString(), "2027-03-28T23:00:00.000Z");
});
test("a late-evening instant belongs to the right London day", () => {
  assert.equal(londonDate("2026-07-01T23:30:00Z"), "2026-07-02");          // 00:30 BST next day
  assert.equal(londonDate("2026-11-07T23:30:00Z"), "2026-11-07");
  assert.equal(londonDow("2026-11-07T10:00:00Z"), 6);
});
test("London wall-clock time converts to the right instant, including across a clock change", () => {
  assert.equal(londonInstant("2026-11-07", "10:00"), "2026-11-07T10:00:00.000Z");
  assert.equal(londonInstant("2026-07-04", "10:30"), "2026-07-04T09:30:00.000Z");
  assert.equal(londonInstant("2026-10-25", "10:00"), "2026-10-25T10:00:00.000Z");
  assert.equal(timeHM("2026-07-04T09:30:00Z"), "10:30");
});
test("windows start at London midnight and are bounded to a month", () => {
  const now = new Date("2026-11-06T09:43:00Z");
  assert.deepEqual(windowFor("today", now), { from: "2026-11-06T00:00:00.000Z", to: "2026-11-07T00:00:00.000Z" });
  assert.deepEqual(windowFor("tomorrow", now), { from: "2026-11-07T00:00:00.000Z", to: "2026-11-08T00:00:00.000Z" });
  const w = windowFor("month", now);
  assert.ok((Date.parse(w.to) - Date.parse(w.from)) / 86_400_000 <= 31);
  for (const k of ["today", "tomorrow", "week", "fortnight", "month"]) assert.ok((Date.parse(windowFor(k, now).to) - Date.parse(windowFor(k, now).from)) / 86_400_000 < 93, k);
  assert.equal(addDays("2026-12-30", 3), "2027-01-02");
});
test("day labels: Today, Tomorrow, then the date, always in London", () => {
  const now = new Date("2026-11-06T09:43:00Z");
  assert.equal(dayLabel("2026-11-06T18:00:00Z", now), "Today");
  assert.equal(dayLabel("2026-11-07T10:00:00Z", now), "Tomorrow");
  assert.equal(dayLabel("2026-11-13T10:30:00Z", now), "Fri 13 Nov");
  assert.equal(timeRange("2026-11-07T10:00:00Z", "2026-11-07T12:30:00Z"), "10:00–12:30");
});

// ── cards
test("the card's next line: the next live session, or an honest reason there is none", () => {
  const now = new Date("2026-11-06T09:43:00Z");
  assert.deepEqual(nextLine({ next_starts_at: "2026-11-07T10:00:00Z", next_ends_at: "2026-11-07T12:30:00Z", sessions_in_window: 3, cancelled_in_window: 0 }, now), { text: "Next: Tomorrow 10:00–12:30", tone: "ok" });
  assert.equal(nextLine({ next_starts_at: null, next_ends_at: null, sessions_in_window: 0, cancelled_in_window: 1 }, now).tone, "warn");
  assert.match(nextLine({ next_starts_at: null, next_ends_at: null, sessions_in_window: 0, cancelled_in_window: 1 }, now).text, /cancelled or on a break/);
  assert.equal(isLive({ status: "moved" }), true); assert.equal(isLive({ status: "cancelled" }), false); assert.equal(isLive({ status: "break" }), false);
});
test("sessions group by London day", () => {
  const g = groupByDay([{ starts_at: "2026-11-10T10:00:00Z" }, { starts_at: "2026-11-10T18:00:00Z" }, { starts_at: "2026-11-12T09:30:00Z" }]);
  assert.deepEqual(g.map((x) => [x.day, x.rows.length]), [["2026-11-10", 2], ["2026-11-12", 1]]);
});

// ── filters and links
test("filters round-trip through the URL; junk is ignored; the default adds nothing", () => {
  assert.equal(regularHref({}), "/whats-on/regular");
  assert.equal(regularHref({ when: DEFAULT_WHEN }), "/whats-on/regular");
  assert.equal(regularHref({ when: "today", days: [4, 2], category: "fitness", locality: "Lerwick", dropIn: true, q: "tai chi" }), "/whats-on/regular?when=today&days=2%2C4&category=fitness&place=Lerwick&dropin=1&q=tai+chi");
  assert.deepEqual(parseDays("2,4,9,x,2,-1"), [2, 4]);
  assert.equal(parseWhen("nonsense"), DEFAULT_WHEN); assert.equal(parseWhen("today"), "today");
  assert.equal(safeCategory("fitness"), "fitness"); assert.equal(safeCategory("<script>"), undefined);
  assert.equal(whenForEventsRange("today"), "today"); assert.equal(whenForEventsRange("all"), "fortnight");
});

// ── validation
const good = { title: "Barre", description: "", category: "fitness", audience: "", venue: "", locality: "", price_text: "", booking_mode: "drop_in", contact_info: "", booking_url: "", active_from: "", active_until: "" };
test("an activity needs a name and category, and each booking mode needs what it says", () => {
  assert.equal(validateActivityDraft(good).ok, true);
  assert.equal(validateActivityDraft({ ...good, title: "  " }).errors.title, "Give it a name");
  assert.ok(validateActivityDraft({ ...good, category: "nope" }).errors.category);
  assert.ok(validateActivityDraft({ ...good, booking_mode: "link", booking_url: "http://x.test" }).errors.booking_url, "https only");
  assert.equal(validateActivityDraft({ ...good, booking_mode: "link", booking_url: "https://x.test/book" }).ok, true);
  assert.ok(validateActivityDraft({ ...good, booking_mode: "contact" }).errors.contact_info);
  assert.ok(validateActivityDraft({ ...good, active_from: "2026-12-01", active_until: "2026-11-01" }).errors.active_until);
  assert.equal(good.booking_mode, "drop_in", "drop-in is the default: no booking or payment is ever required");
});
test("a session time needs a start and a later end", () => {
  assert.equal(validateRuleDraft({ day_of_week: 2, start_time: "18:00", end_time: "19:00" }).ok, true);
  assert.ok(validateRuleDraft({ day_of_week: 2, start_time: "19:00", end_time: "18:00" }).errors.end);
  assert.ok(validateRuleDraft({ day_of_week: 9, start_time: "18:00", end_time: "19:00" }).errors.day);
  assert.ok(validateRuleDraft({ day_of_week: 2, start_time: "", end_time: "19:00" }).errors.start);
});
test("a break needs ordered dates", () => {
  assert.equal(validateBreakDraft({ start_date: "2026-12-18", end_date: "2027-01-02", reason: "Christmas" }).ok, true);
  assert.ok(validateBreakDraft({ start_date: "2027-01-02", end_date: "2026-12-18", reason: "" }).errors.end);
  assert.ok(validateBreakDraft({ start_date: "2026-01-01", end_date: "2027-06-01", reason: "" }).errors.end);
});
test("every category has a label and the list matches the database's allowed values", () => {
  const mig = read("../oneshetland-for-you-pin/supabase/migrations/20261208000000_regular_activities.sql");
  const allowed = [...mig.match(/category\s+text not null default 'other'\s+check \(category in \(([^)]*)\)\)/)[1].matchAll(/'([a-z_]+)'/g)].map((m) => m[1]);
  assert.deepEqual(ACTIVITY_CATEGORIES.map((c) => c.value).sort(), allowed.sort());
});

// ── boundaries: what the website will and will not do
const files = (...p) => p.map((f) => [f, read(f)]);
const ACTIVITY_FILES = ["lib/activities.ts", "lib/activities-data.ts", "lib/activities-client.ts", "components/activities/ActivityCard.tsx", "components/activities/ActivityStrip.tsx", "components/activities/SessionList.tsx",
  "components/activities/FollowButton.tsx", "components/activities/RegularFilters.tsx", "components/activities/manage/ActivityEditor.tsx", "components/activities/manage/ManagePages.tsx", "components/activities/manage/ActivityForm.tsx", "components/admin/ActivitiesAdmin.tsx"];

test("activities never touch the events table: they cannot clutter the mosaic or edit an event", () => {
  for (const [f, src] of files(...ACTIVITY_FILES)) assert.doesNotMatch(src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, ""), /from\(["']events["']\)/, f);
  assert.doesNotMatch(read("lib/events-data.ts"), /regular_activit|activity_/, "the events loaders know nothing about activities");
});
test("What's On: the strip sits outside the events list, appears only on the plain/date views, and a failure can never delay or break the page", () => {
  const page = read("app/whats-on/page.tsx");
  assert.match(page, /const showStrip = !calendar && !category && !freeOnly;/);
  assert.match(page, /\{showStrip && <ActivityStrip items=\{activityStrip\} when=\{stripWhen\} now=\{now\} \/>\}/);
  assert.match(page, /resilient\(`whatson:activities:\$\{stripWhen\}`, \{ ttlMs: 60_000, deadlineMs: 2500, staleMs: 10 \* 60_000, emptyGuardMs: 0, fallback: \[\] \}/);
  assert.ok(page.indexOf("<ActivityStrip") < page.indexOf("<FeaturedStrip"), "above the highlights, never inside the list");
  assert.doesNotMatch(page, /visible\.(map|concat)\([^)]*activit/i, "activities are not mixed into the events being listed");
  assert.match(page, /const stripWhen = whenForEventsRange\(range\);/, "the strip follows the date chips");
  const data = read("lib/activities-data.ts");
  assert.match(data, /catch \(e\) \{\s*if \(strict\) throw e;[\s\S]*?return \[\];/, "a failed listing read is 'nothing to show' (the cached strip uses the strict form so it keeps its last good copy)");
  assert.match(data, /getActivityListing\(\{ when, limit \}, now, true\)/);
});
test("a quiet strip renders nothing at all, and shows at most three cards, one per ACTIVITY", () => {
  const strip = read("components/activities/ActivityStrip.tsx");
  assert.match(strip, /if \(items\.length === 0\) return null;/);
  assert.match(strip, /\.slice\(0, 3\)/);
  assert.match(read("components/activities/ActivityCard.tsx"), /ONE card per activity/);
});
test("every database read is bounded: windows of at most a month, row caps, and the activity list, rules and sessions are all limited", () => {
  const d = read("lib/activities-data.ts");
  assert.match(d, /Math\.min\(f\.limit \?\? LISTING_LIMIT, 100\)/);
  assert.match(d, /\.slice\(0, 100\)\)[\s\S]{0,120}\.limit\(800\)/, "rules for the listing: one query, capped");
  assert.match(d, /p_limit: 120/); assert.match(d, /p_limit: 200/);
  assert.match(d, /56 \* 86_400_000/, "eight weeks");
  assert.doesNotMatch(d, /select\("\*"\)/, "never select *");
});
test("the legacy event redirect fails soft (works before the migration exists) and is only used before not-found", () => {
  const page = read("app/whats-on/[id]/page.tsx");
  assert.ok(page.indexOf("legacyEventRedirect(id)") < page.indexOf("if (!e) notFound();"));
  assert.match(read("lib/activities-data.ts"), /export async function legacyEventRedirect[\s\S]*catch \{\s*return null;\s*\}/);
});
test("nothing is forced: drop-in is the default, no payment or booking set-up is referenced, and management is outside the commercial-terms gate", () => {
  assert.match(read("lib/activities-client.ts"), /booking_mode: "drop_in"/);
  for (const [f, src] of files(...ACTIVITY_FILES)) assert.doesNotMatch(src, /stripe|checkout|payout|commercialTermsGate|subscription_tier/i, f);
  for (const f of ["app/business/[id]/manage/activities/page.tsx", "app/hubs/[id]/manage/activities/page.tsx"]) assert.doesNotMatch(read(f), /commercialTermsGate/);
  assert.match(read("app/business/[id]/manage/activities/page.tsx"), /requireBusinessOwner/);
  assert.match(read("app/hubs/[id]/manage/activities/page.tsx"), /requireHubAdmin/);
  assert.match(read("components/activities/manage/ManagePages.tsx"), /Free to list, whatever your plan/);
});
test("Business and Hub Manage link to their activities", () => {
  assert.match(read("app/business/[id]/manage/page.tsx"), /label="Regular activities" href=\{`\$\{base\}\/activities`\}/);
  assert.match(read("app/hubs/[id]/manage/page.tsx"), /href: `\$\{base\}\/activities`, label: "Regular activities"/);
});
test("following: opt-in, says it is NOT a reminder, and the website sends nothing itself", () => {
  const f = read("components/activities/FollowButton.tsx");
  assert.match(f, /No reminders/);
  assert.match(f, /activity_follows/);
  assert.doesNotMatch(f, /sendUser|sendPush|sendEmail|expo-push|postmark/i, "the button only writes the follow row");
  assert.match(f, /phone alert if you use the app/, "honest that an in-app inbox notice may be all someone gets");
});
test("staff controls call only the audited database functions (pause, hand over); approve is a plain staff update", () => {
  const a = read("components/admin/ActivitiesAdmin.tsx");
  assert.match(a, /rpc\("admin_set_activity_paused"/); assert.match(a, /rpc\("admin_assign_activity_owner"/);
  assert.match(a, /await confirm\(/);
  assert.match(read("components/admin/AdminSidebar.tsx"), /href: "\/admin\/activities", label: "Regular activities"/);
});
test("sessions are never computed on the website: it calls the database's Europe/London function and displays what it returns", () => {
  const d = read("lib/activities-data.ts");
  assert.match(d, /rpc\("activity_sessions"/); assert.match(d, /rpc\("regular_activities_listing"/);
  assert.doesNotMatch(d, /generate_series|setHours|getTimezoneOffset/);
});

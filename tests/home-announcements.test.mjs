/**
 * Latest from OneShetland: the announcement rules (safe links, liveness, order, failure), the Shetland-time form helpers and the admin wiring.
 * Run: node --test --import ./tests/support/register.mjs tests/home-announcements.test.mjs
 */
process.env.HOME_RESILIENCE = "off";
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import {
  safeHref, safeImage, announcementFromRow, isLiveNow, announcementState, pickLatest, readAnnouncements, getHomeAnnouncements,
  londonLocalToIso, isoToLondonLocal, validateAnnouncementDraft, blankDraft, draftToRow,
} from "../lib/home-announcements.ts";

const read = (p) => readFileSync(p, "utf8");
const NOW = Date.parse("2026-11-09T12:00:00Z");
const id = (n) => `${String(n).padStart(8, "0")}-0000-4000-8000-000000000000`;
const row = (n, o = {}) => ({ id: id(n), kind: "new", title: `T${n}`, body: "b", cta_label: "Go", href: "/x", visual: "photo", image_url: null, status: "published", starts_at: null, ends_at: null, sort_order: n, ...o });
const ann = (n, o = {}) => announcementFromRow(row(n, o));
const days = (d) => new Date(NOW + d * 86_400_000).toISOString();

describe("safe links and images", () => {
  test("only a site path or https is accepted", () => {
    for (const ok of ["/", "/account/saved", "/whats-on/regular", "https://example.com/a?b=1#c"]) assert.equal(safeHref(ok), ok);
    for (const bad of ["javascript:alert(1)", "//evil.example", "http://insecure.example", "/a b", "/\tevil", "/x\"y", "/x<y", "/x\\y", "data:text/html,x", "mailto:a@b.c", "", null, undefined]) assert.equal(safeHref(bad), null, String(bad));
    assert.equal(safeImage("/preview-v2/a.jpg"), "/preview-v2/a.jpg");
    assert.equal(safeImage("https://x.supabase.co/storage/v1/object/public/site-media/a.jpg") !== null, true);
    for (const bad of ["javascript:x", "//cdn/x.jpg", "http://x/y.jpg", "/a b.jpg", "", null]) assert.equal(safeImage(bad), null);
  });
  test("a row with an unsafe link, a bad kind or a missing headline is dropped, never rendered", () => {
    assert.equal(ann(1, { href: "javascript:alert(1)" }), null);
    assert.equal(ann(1, { kind: "promo" }), null);
    assert.equal(ann(1, { title: "   " }), null);
    assert.equal(ann(1, { cta_label: "" }), null);
    assert.equal(announcementFromRow({ ...row(1), id: "not-a-uuid" }), null);
    assert.equal(ann(1, { image_url: "javascript:x" }).image, null, "an unsafe image is dropped but the story survives");
    assert.equal(readAnnouncements([row(1), row(2, { href: "//x" }), null, 5]).length, 1);
    assert.equal(readAnnouncements("nope").length, 0);
  });
  test("an unknown visual falls back to a photograph, and lengths are clamped", () => {
    assert.equal(ann(1, { visual: "video" }).visual, "photo");
    assert.equal(ann(1, { title: "x".repeat(200) }).title.length, 60);
  });
});

describe("liveness, state and order", () => {
  test("live means published, started and not expired", () => {
    assert.equal(isLiveNow(ann(1), NOW), true);
    assert.equal(isLiveNow(ann(1, { starts_at: days(1) }), NOW), false);
    assert.equal(isLiveNow(ann(1, { ends_at: days(-1) }), NOW), false);
    assert.equal(isLiveNow(ann(1, { status: "draft" }), NOW), false);
    assert.equal(isLiveNow(ann(1, { status: "withdrawn" }), NOW), false);
    assert.equal(isLiveNow(ann(1, { starts_at: days(-1), ends_at: days(1) }), NOW), true);
  });
  test("the admin state combines status and window", () => {
    assert.equal(announcementState(ann(1), NOW), "live");
    assert.equal(announcementState(ann(1, { starts_at: days(2) }), NOW), "scheduled");
    assert.equal(announcementState(ann(1, { ends_at: days(-2) }), NOW), "ended");
    assert.equal(announcementState(ann(1, { status: "draft" }), NOW), "draft");
    assert.equal(announcementState(ann(1, { status: "withdrawn" }), NOW), "withdrawn");
  });
  test("the featured story is the first LIVE one in sort order; supporting slots prefer a Did you know? and a different kind", () => {
    const items = [ann(5, { kind: "new" }), ann(1, { status: "draft" }), ann(2, { kind: "know" }), ann(3, { kind: "new" }), ann(4, { kind: "know" }), ann(0, { ends_at: days(-1) })];
    const { lead, second } = pickLatest(items, NOW);
    assert.equal(lead.title, "T2", "draft and expired are skipped; lowest live sort order leads");
    assert.deepEqual(second.map((a) => a.title), ["T4", "T3"]);
  });
  test("nothing live means no lead (the section hides)", () => {
    assert.equal(pickLatest([ann(1, { status: "draft" }), ann(2, { ends_at: days(-1) })], NOW).lead, undefined);
    assert.equal(pickLatest([], NOW).lead, undefined);
  });
});

describe("the loader fails to nothing", () => {
  test("a slow or failing read yields no announcements, never an error", async () => {
    assert.deepEqual(await getHomeAnnouncements(() => new Promise(() => {}), 40), []);
    assert.deepEqual(await getHomeAnnouncements(async () => { throw new Error("db down"); }, 200), []);
  });
  test("a good read is returned as given", async () => {
    const got = await getHomeAnnouncements(async () => [ann(1)], 200);
    assert.equal(got.length, 1);
  });
});

describe("Shetland time in the admin form", () => {
  test("winter is UTC, summer is UTC+1, and the round trip is exact", () => {
    assert.equal(londonLocalToIso("2026-11-10T09:30"), "2026-11-10T09:30:00.000Z");
    assert.equal(londonLocalToIso("2026-07-10T09:30"), "2026-07-10T08:30:00.000Z");
    for (const l of ["2026-11-10T09:30", "2026-07-10T23:59", "2026-03-29T12:00", "2026-10-25T00:30"]) assert.equal(isoToLondonLocal(londonLocalToIso(l)), l);
    assert.equal(londonLocalToIso(""), null);
    assert.equal(londonLocalToIso("tomorrow"), null);
  });
  test("a draft is validated in plain English and the saved row is clean", () => {
    const d = { ...blankDraft(), title: "A title", href: "/account/saved", cta: "Open" };
    assert.deepEqual(validateAnnouncementDraft(d), {});
    assert.ok(validateAnnouncementDraft({ ...d, title: "" }).title);
    assert.ok(validateAnnouncementDraft({ ...d, href: "javascript:x" }).href);
    assert.ok(validateAnnouncementDraft({ ...d, image: "http://x/y.jpg" }).image);
    assert.ok(validateAnnouncementDraft({ ...d, startsLocal: "2026-12-10T10:00", endsLocal: "2026-12-01T10:00" }).ends);
    assert.ok(validateAnnouncementDraft({ ...d, status: "published", endsLocal: "2020-01-01T10:00" }).ends, "publishing something already over is refused");
    const row = draftToRow({ ...d, title: "  A title  ", startsLocal: "2026-12-01T10:00", endsLocal: "2026-12-05T10:00" });
    assert.equal(row.title, "A title");
    assert.equal(row.starts_at, "2026-12-01T10:00:00.000Z");
  });
});

describe("admin wiring", () => {
  const page = read("app/admin/announcements/page.tsx");
  const comp = read("components/admin/AnnouncementsAdmin.tsx");
  test("the page uses the admin shell and the server client; the admin layout already requires an administrator", () => {
    assert.match(read("app/admin/layout.tsx"), /requireAdmin\(\)/);
    assert.match(page, /AdminHeader/);
    assert.match(page, /from "@\/lib\/supabase\/server"/);
    assert.doesNotMatch(page + comp, /service_role|SERVICE_ROLE|createAdminClient/);
  });
  test("writes use the administrator's own session; reorder is the atomic RPC; images go to site-media", () => {
    assert.match(comp, /createClient\(\)/);
    assert.match(comp, /admin_home_announcements_reorder/);
    assert.match(comp, /from\("site-media"\)/);
    assert.match(comp, /\.from\("home_announcements"\)/);
  });
  test("it covers create, edit, feature, schedule, demo choice, reorder, publish, withdraw and previous announcements", () => {
    for (const w of ["New announcement", "Make featured", "Withdraw", "Publish", "Duplicate", "Delete", "Shows from", "Until", "move", "Shows"]) assert.ok(comp.toLowerCase().includes(w.toLowerCase()), w);
    for (const f of ["Live", "Scheduled", "Drafts", "Ended", "Withdrawn"]) assert.ok(comp.includes(f), f);
  });
  test("the sidebar links to it, and the public site only reads live rows", () => {
    assert.match(read("components/admin/AdminSidebar.tsx"), /\/admin\/announcements/);
    assert.ok(existsSync("lib/home-announcements.ts"));
    assert.match(read("lib/home-announcements.ts"), /publicClient\(\)\.from\("home_announcements"\)/);
  });
});

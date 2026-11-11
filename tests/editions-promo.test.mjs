/**
 * Launch / Showcase packages and promotion (organiser side): pure rules, rendered screens and source guards. No network.
 * Run: node --test --import ./tests/support/register-jsx.mjs tests/editions-promo.test.mjs
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement as h } from "react";

await import("./support/register-jsx.mjs");
const P = await import("../lib/editions/promo.ts");
const J = await import("../lib/editions/journey.ts");
const { ConfirmProvider } = await import("../components/ui/ConfirmProvider.tsx");
const { PackageStep } = await import("../components/editions-manage/PackageStep.tsx");
const { PromoReport } = await import("../components/editions-manage/PromoReport.tsx");
const { friendlyError, HINT_COPY } = await import("../lib/editions/rules.ts");

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => readFileSync(join(ROOT, p), "utf8");
const walk = (d) => readdirSync(join(ROOT, d)).flatMap((n) => { const rel = `${d}/${n}`; return statSync(join(ROOT, rel)).isDirectory() ? walk(rel) : [rel]; });

describe("price and note", () => {
  test("the note follows the amount; empty renders nothing; nothing is calculated", () => {
    assert.deepEqual(P.priceWithNote("£249.00", ""), { amount: "£249.00", note: "", text: "£249.00" });
    assert.deepEqual(P.priceWithNote("£249.00", "   "), { amount: "£249.00", note: "", text: "£249.00" });
    assert.equal(P.priceWithNote("£499.00", " inc. VAT ").text, "£499.00 inc. VAT");
    assert.equal(P.priceWithNote("£499.00", null).note, "");
  });
  test("settings are read defensively with the database defaults", () => {
    assert.equal(P.parsePromoSettings(null).horizonDays, 180);
    const s = P.parsePromoSettings({ lead_days: 5, vat_note: "  note ", homepage_visible: 3, discovery_visible: 4, reschedule_notice_days: "x" });
    assert.equal(s.leadDays, 5); assert.equal(s.vatNote, "note"); assert.equal(s.rescheduleNoticeDays, 3); assert.equal(s.renewalWindowDays, 30);
  });
});

describe("dates in Europe/London", () => {
  test("today is the London day, not the UTC day, in summer time", () => {
    assert.equal(P.londonToday(new Date("2027-07-01T23:30:00Z")), "2027-07-02");
    assert.equal(P.londonToday(new Date("2027-01-01T23:30:00Z")), "2027-01-01");
    assert.equal(P.londonDay("2027-06-30T23:00:00Z"), "2027-07-01");
  });
  test("day arithmetic", () => {
    assert.equal(P.addDays("2027-02-27", 2), "2027-03-01"); assert.equal(P.endDay("2027-03-01", 42), "2027-04-11"); assert.equal(P.daysBetween("2027-03-01", "2027-03-05"), 4);
    assert.equal(P.addMonths("2027-01-15", 1), "2027-02-01"); assert.equal(P.weekdayIndex("2027-11-15"), 0);
  });
  const base = { today: "2027-03-01", leadDays: 2, horizonDays: 180, publishedOn: "2027-02-20", entitlementEnd: "2028-02-20T00:00:00Z", days: 42 };
  test("the earliest start honours the lead time and the publish date", () => {
    assert.equal(P.bookingWindow(base).earliest, "2027-03-03");
    assert.equal(P.bookingWindow({ ...base, publishedOn: "2027-03-10" }).earliest, "2027-03-10");
  });
  test("the run must finish inside the publishing period: the last bookable day is the last whole London day before it ends", () => {
    const w = P.bookingWindow({ ...base, today: "2027-12-01", horizonDays: 400 });
    assert.equal(w.lastDay, "2028-02-19"); assert.equal(w.latestStart, P.addDays("2028-02-19", -41)); assert.equal(P.endDay(w.latestStart, 42), "2028-02-19");
  });
  test("a period ending just after London midnight in summer counts in London time", () => {
    const w = P.bookingWindow({ ...base, entitlementEnd: "2027-06-30T23:30:00Z", horizonDays: 400, days: 1 });
    assert.equal(w.lastDay, "2027-06-30");
  });
  test("the horizon caps how far ahead a start can be", () => { assert.equal(P.bookingWindow(base).latestStart, "2027-08-28"); });
  test("no window when the run cannot fit, or the Edition is not published or has no period", () => {
    assert.equal(P.bookingWindow({ ...base, entitlementEnd: "2027-03-20T00:00:00Z" }), null);
    assert.equal(P.bookingWindow({ ...base, publishedOn: null }), null); assert.equal(P.bookingWindow({ ...base, entitlementEnd: null }), null);
  });
});

describe("availability helpers", () => {
  const rows = [{ day: "2027-03-03", capacity: 3, booked: 0, remaining: 3 }, { day: "2027-03-04", capacity: 3, booked: 3, remaining: 0 }, { day: "2027-03-05", capacity: 3, booked: 2, remaining: 1 }, { day: "2027-03-06", capacity: 3, booked: 1, remaining: 2 }];
  const win = { earliest: "2027-03-03", latestStart: "2027-03-06", lastDay: "2027-03-30" };
  test("parse drops malformed rows", () => { assert.equal(P.parseAvailability([{ day: "x", remaining: 1 }, { day: "2027-03-03", remaining: 2, capacity: 3, booked: 1 }, null]).length, 1); assert.deepEqual(P.parseAvailability("nope"), []); });
  test("places left is the fewest across the run; any full or unknown day means none", () => {
    const m = P.availabilityMap(rows);
    assert.equal(P.placesLeft("2027-03-05", 2, m), 1); assert.equal(P.placesLeft("2027-03-03", 2, m), 0); assert.equal(P.placesLeft("2027-03-06", 2, m), 0);
  });
  test("a full day is disabled; an open day shows its places; outside the window is outside", () => {
    const m = P.availabilityMap(rows);
    assert.deepEqual(P.startState("2027-03-04", 1, win, m), { ok: false, places: 0, reason: "full" });
    assert.deepEqual(P.startState("2027-03-05", 1, win, m), { ok: true, places: 1, reason: "ok" });
    assert.equal(P.startState("2027-03-02", 1, win, m).reason, "outside"); assert.equal(P.startState("2027-03-07", 1, win, m).reason, "outside");
    assert.equal(P.startState("2027-03-05", 1, win, m, { from: "2027-03-06", to: "2027-03-06" }).reason, "outside");
    assert.equal(P.startState("2027-03-05", 1, null, m).ok, false);
  });
  test("moving a booking gives it back its own days", () => {
    const m = P.availabilityMap(rows, { start: "2027-03-04", end: "2027-03-04" }, 3);
    assert.equal(m["2027-03-04"], 1); assert.equal(m["2027-03-03"], 3); assert.equal(m["2027-03-05"], 1);
  });
});

describe("rights and notice", () => {
  const R = (o) => ({ right_id: "r", kind: "discovery", days: 42, group_id: null, source: "order", status: "unused", booking_id: null, starts_on: null, ends_on: null, created_at: "2027-01-01T00:00:00Z", void_reason: null, ...o });
  test("a grouped pair is one campaign; singles stand alone; void rights are left out", () => {
    const items = P.groupRights([R({ right_id: "d", group_id: "g" }), R({ right_id: "h", group_id: "g", kind: "homepage", days: 7 }), R({ right_id: "s", kind: "homepage", days: 7 }), R({ right_id: "v", status: "void" })]);
    assert.deepEqual(items.map((i) => i.kind), ["campaign", "homepage"]); assert.equal(P.unbookedCount([R(), R({ status: "booked" })]), 1);
  });
  test("rights are parsed defensively", () => { assert.equal(P.parseRights([{ right_id: "a", kind: "discovery", days: 1, status: "unused" }, { kind: "x" }, null]).length, 1); });
  test("a booking can be changed only with enough notice", () => {
    assert.equal(P.canChangeBooking("2027-03-10", "2027-03-07", 3), true); assert.equal(P.canChangeBooking("2027-03-09", "2027-03-07", 3), false); assert.equal(P.canChangeBooking("2027-03-07", "2027-03-07", 3), false);
  });
  test("the shared-placement explanation uses the configured sizes and says Promoted", () => {
    const t = P.sharedPlacementText({ homepageVisible: 3, discoveryVisible: 4 });
    assert.match(t, /up to 3 Editions appears on the homepage/); assert.match(t, /up to 4/); assert.match(t, /Promoted/); assert.match(t, /rotated daily/);
  });
  test("reports are parsed and the note is honest", () => {
    const r = P.parseReport([{ booking_id: "b", kind: "homepage", status: "booked", starts_on: "2027-03-01", ends_on: "2027-03-07", shown: "5", taps: 2, views: 1, saves: 0, plan_adds: 3 }, { nope: 1 }]);
    assert.equal(r.length, 1); assert.equal(r[0].shown, 5); assert.match(P.REPORT_NOTE, /indicative/);
  });
});

describe("every database hint has friendly words", () => {
  const CODES = ["not_live", "no_entitlement", "too_early", "outside_publish_window", "too_far", "full", "already_booked", "fairness_limit", "book_discovery_first", "outside_discovery", "homepage_would_fall_outside", "too_late", "right_booked", "right_void", "not_booked", "retired_package", "no_restrictions", "already_live"];
  test("each code maps, in plain words, with no codes or jargon", () => {
    for (const c of CODES) { const t = friendlyError("ERROR: raw database text", c); assert.equal(t, HINT_COPY[c], c); assert.ok(t.length > 15 && !/rpc|uuid|flag|edition_|_/i.test(t), t); assert.notEqual(t, "Something went wrong. Please try again."); }
  });
  test("dates in the database's message are carried into the words", () => {
    assert.match(friendlyError("promotion cannot start before 14 Dec 2026", "too_early"), /earliest start is 14 Dec 2026/);
    assert.match(friendlyError("no place is free on 3 Mar 2027 for that kind of promotion", "full"), /3 Mar 2027/);
    assert.match(friendlyError("promotion must finish inside the Edition's publishing period (last day 19 Feb 2028)", "outside_publish_window"), /19 Feb 2028/);
    assert.match(friendlyError("This Edition is already live until 5 March 2028. You can renew it in the last 30 days.", "already_live"), /live until 5 March 2028.*last 30 days/);
  });
  test("with no hint it behaves as before, and unknown refusals stay generic", () => {
    assert.match(friendlyError("permission denied"), /permission/); assert.equal(friendlyError("???", "weird_code"), "Something went wrong. Please try again.");
  });
});

describe("package step screens", () => {
  const grants = { discovery_days: 42, homepage_days: 7, grouped: true };
  const pk = (o) => ({ id: "p", code: "launch", name: "Launch", description: null, price_pence: 24900, duration_days: 365, features: [], max_members: null, active: true, sort: 1, kind: "package", grants: {}, ...o });
  const pkgs = [pk({}), pk({ id: "q", code: "showcase", name: "Showcase", price_pence: 49900, grants })];
  const step = (o) => renderToStaticMarkup(h(ConfirmProvider, null, h(PackageStep, { organiserSlug: "o", editionSlug: "e", editionTitle: "Fest", approved: true, packages: pkgs, commerceOn: true, canChoose: true, activeUntilIso: null, published: false, ...o })));
  test("Launch and Showcase are shown from the rows, with the same core list and Showcase's promotion", () => {
    const html = step({});
    assert.ok(html.includes("£249.00") && html.includes("£499.00")); assert.ok((html.match(/CSV export/g) ?? []).length === 2);
    assert.ok(html.includes("Six weeks of enhanced discovery") && html.includes("Campaign reporting")); assert.ok(!html.includes("Community"));
    assert.equal((html.match(/Plus promotion/g) ?? []).length, 1);
  });
  test("the note appears after the price only when set", () => {
    assert.ok(!step({}).includes("incl. VAT")); const html = step({ vatNote: "incl. VAT" }); assert.equal((html.match(/incl\. VAT/g) ?? []).length, 2);
  });
  test("a live package says until when and when to renew, and offers no purchase", () => {
    const far = new Date(Date.now() + 200 * 864e5).toISOString(); const html = step({ activeUntilIso: far });
    assert.match(html, /Live until .*; you can renew in the last 30 days\./); assert.ok(!html.includes("Choose Launch")); assert.ok(!html.includes("£249.00"));
  });
  test("in the last days the owner can renew", () => { const near = new Date(Date.now() + 10 * 864e5).toISOString(); assert.match(step({ activeUntilIso: near }), /Renew your package/); });
  test("before approval it only explains", () => { const html = step({ approved: false }); assert.match(html, /once OneShetland has approved/); assert.ok(!html.includes("Choose Launch")); });
  test("the report shows each booking with the indicative note, and an empty state", () => {
    const rows = P.parseReport([{ booking_id: "b", kind: "discovery", status: "booked", starts_on: "2027-03-01", ends_on: "2027-04-11", shown: 1200, taps: 30, views: 22, saves: 4, plan_adds: 2 }]);
    const html = renderToStaticMarkup(h(PromoReport, { rows })); assert.ok(html.includes("Enhanced discovery") && html.includes("1,200") && html.includes("indicative"));
    assert.match(renderToStaticMarkup(h(PromoReport, { rows: [] })), /nothing to report yet/);
  });
});

describe("source guards", () => {
  const organiser = [...walk("app/organise"), ...walk("components/editions-manage"), ...walk("components/editions-commerce")].filter((f) => /\.(ts|tsx)$/.test(f));
  test("no Community wording or Hub-only package rule in the organiser area, journey or rules", () => {
    for (const f of [...organiser, "lib/editions/journey.ts", "lib/editions/rules.ts", "lib/editions/promo.ts", "lib/editions/commerce.ts", "lib/editions/commerce.server.ts"]) {
      const s = read(f);
      if (/PartnersManager|AddFromHubPanel|app\/organise\/page\.tsx|programme\/page/.test(f)) continue;
      assert.ok(!/Community rate|community_publish|community_collect|communityLabel|Community package|audience === "hub"|package is for Hub/i.test(s), f);
    }
  });
  test("no price is hard-coded in the organiser components", () => {
    for (const f of organiser.filter((x) => /Promo|PackageStep|PackagesPanel|BuyFlow|promo-actions|\/package\/|\/packages\/|\/promote\//.test(x))) { const s = read(f); assert.ok(!/£\s?\d|\b(24900|49900|7900|17900|14900)\b/.test(s), f); }
    assert.ok(!/£\s?\d|\b(24900|49900)\b/.test(read("lib/editions/promo.ts") + read("lib/editions/journey.ts")));
  });
  test("organiser screens never show database words", () => {
    for (const f of ["components/editions-manage/PromoManager.tsx", "components/editions-manage/PromoReport.tsx", "components/editions-manage/PromoDatePicker.tsx", "components/editions-manage/PackageStep.tsx"]) {
      const text = [...read(f).matchAll(/>([^<>{}]{4,})</g)].map((m) => m[1]).join(" ");
      assert.ok(!/\bRPC\b|uuid|edition_|editions\.promo|flag/i.test(text), f);
    }
  });
  test("promotion actions check the role, pass explicit dates and use only the promotion functions", () => {
    const a = read("app/organise/promo-actions.ts");
    assert.match(a, /can\(role as OrgRole \| null, "admin"\)/); assert.ok(!/service[_-]?role|SERVICE_KEY|createAdminClient/i.test(a));
    assert.deepEqual([...new Set([...a.matchAll(/\.rpc\("([a-z_]+)"/g)].map((m) => m[1]))].sort(), ["edition_org_role", "edition_promo_book", "edition_promo_book_campaign", "edition_promo_cancel", "edition_promo_reschedule"]);
    assert.match(a, /isIsoDay\(start\)/); assert.ok(!/edition_promo_today/.test(a + read("lib/editions/commerce.server.ts")));
  });
  test("buying goes through the existing order and payment flow, behind a confirmation", () => {
    const b = read("components/editions-commerce/BuyFlow.tsx"); assert.match(b, /await confirm\(/); assert.match(b, /createPackageOrder/); assert.match(b, /<PayButton kind="order"/);
    assert.match(read("components/editions-manage/PromoManager.tsx"), /BuyFlow/); assert.match(read("components/editions-manage/PackageStep.tsx"), /BuyFlow/);
  });
  test("the free-package path is kept, and offered only for a row the catalogue marks free", () => {
    const s = read("components/editions-manage/PackageStep.tsx"); assert.match(s, /claimFreePackage/); assert.match(s, /v\.choice === "claim"/); assert.match(read("lib/editions/journey.ts"), /free = p\.is_free === true/);
  });
  test("the promotion page is gated and the report page reads edition_promo_report", () => {
    assert.match(read("app/organise/[slug]/editions/[edition]/promote/page.tsx"), /editionPage\(/); assert.match(read("app/organise/[slug]/editions/[edition]/promote/page.tsx"), /londonToday\(\)/);
    assert.match(read("lib/editions/commerce.server.ts"), /rpc\("edition_promo_report"/); assert.match(read("lib/editions/commerce.server.ts"), /rpc\("edition_promo_availability"/);
    assert.match(read("app/organise/[slug]/editions/[edition]/promote/report/page.tsx"), /editionPage\(/);
  });
  test("the overview links to promotion only once there is a live package, and the nudge is optional", () => {
    const o = read("app/organise/[slug]/editions/[edition]/page.tsx"); assert.match(o, /promoReady = edition\.review_state === "approved" && !!until/); assert.match(o, /promoteNudge\(/);
  });
});

describe("update notifications", () => {
  const a = read("app/organise/actions.ts");
  const save = a.split("export async function saveUpdate(")[1].split("\nexport async function ")[0];
  test("a newly published update calls notify-edition-update after the save, never a draft", () => {
    assert.match(save, /if \(v\.value\.published_at && existing === null\) await notifyEditionUpdate\(c\.sb, updateId\)/);
    assert.ok(save.indexOf(".insert(") < save.indexOf("notifyEditionUpdate("));
  });
  test("it uses the signed-in session client, sends only the update id, times out and swallows errors", () => {
    const n = a.split("async function notifyEditionUpdate(")[1].split("\n}\n")[0];
    assert.match(n, /sb\.functions\.invoke\("notify-edition-update", \{ body: \{ update_id: updateId \} \}\)/);
    assert.match(n, /setTimeout\(resolve, 4000\)/); assert.match(n, /catch \{/); assert.ok(!/recipient|service|token|console\.(warn|error)\([^)]*(err|body)/i.test(n));
  });
});

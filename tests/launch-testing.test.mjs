/**
 * Launch Test Centre — the rules that run in the browser/server layer under plain node.
 * (The database half — RLS, append-only history, evidence privacy — is proved in the backend repo: supabase/tests/launch-test-centre.node.test.ts.)
 *
 * Run: node --test tests/launch-testing.test.mjs
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { launchAccessFor } from "../lib/launch-testing/access.ts";
import { buildMatrix, cellState, summarise, progressByPlatform, latestPerTest, myProgress, stateOfAttempt } from "../lib/launch-testing/readiness.ts";
import { PLATFORMS, PLATFORM_LABEL, isPlatform, platformsFor, appliesTo, whereToDoIt, goTryIt, stepsFor, detectWebContext } from "../lib/launch-testing/platform.ts";
import { moneyWarning, requiresAck, formatMaxSpend, ACK_LABEL, NEVER_SHARE_NOTICE } from "../lib/launch-testing/money.ts";
import { checkEvidence, sniffImageType, evidencePath, MAX_EVIDENCE_BYTES } from "../lib/launch-testing/evidence.ts";

describe("who may see the Test Centre", () => {
  test("signed out → normal sign-in; enabled tester → in; admin who is not a tester → admin page; everyone else → not found", () => {
    assert.equal(launchAccessFor({ signedIn: false, isAdmin: false, isEnabledTester: false }), "sign_in");
    assert.equal(launchAccessFor({ signedIn: false, isAdmin: true, isEnabledTester: true }), "sign_in");
    assert.equal(launchAccessFor({ signedIn: true, isAdmin: false, isEnabledTester: true }), "tester");
    assert.equal(launchAccessFor({ signedIn: true, isAdmin: true, isEnabledTester: false }), "admin_only");
    assert.equal(launchAccessFor({ signedIn: true, isAdmin: false, isEnabledTester: false }), "not_found");
  });
});

const T = (id, o = {}) => ({ id, mandatory: true, active: true, platform: "all", ...o });
const U = (user_id, o = {}) => ({ user_id, enabled: true, platforms: [], ...o });
const L = (test_id, user_id, status, o = {}) => ({ attempt_id: `${test_id}-${user_id}-${status}-${o.platform ?? "ios"}`, test_id, user_id, platform: "ios", app_build: "148", status, review_state: null, retest_requested: false, started_at: "2026-10-11", completed_at: null, attempts_total: 1, ...o });
const PASS_ALL = (tests, user, platforms) => tests.flatMap((t) => platforms.map((p) => L(t.id, user, "passed", { platform: p })));

describe("a result's state", () => {
  test("passed / in progress / blocked / issue; an issue marked resolved needs a re-check, it is not a pass", () => {
    assert.equal(stateOfAttempt({ status: "passed", review_state: null }), "passed");
    assert.equal(stateOfAttempt({ status: "in_progress", review_state: null }), "in_progress");
    assert.equal(stateOfAttempt({ status: "blocked", review_state: "open" }), "blocked");
    assert.equal(stateOfAttempt({ status: "issue", review_state: "open" }), "issue");
    assert.equal(stateOfAttempt({ status: "issue", review_state: "fix_pending" }), "issue");
    assert.equal(stateOfAttempt({ status: "issue", review_state: "ready_for_retest" }), "issue");
    assert.equal(stateOfAttempt({ status: "issue", review_state: "resolved" }), "recheck");
  });
});

describe("the platform model", () => {
  test("web is a recognised platform alongside ios and android; nothing else is", () => {
    assert.deepEqual([...PLATFORMS], ["web", "ios", "android"]);
    for (const p of ["web", "ios", "android"]) assert.equal(isPlatform(p), true);
    for (const p of ["windows", "desktop", "", null, undefined, "WEB"]) assert.equal(isPlatform(p), false);
    assert.equal(PLATFORM_LABEL.web, "Website");
  });
  test("a tester's platforms: one, several or all; an empty list means all three (compatible with existing testers)", () => {
    assert.deepEqual(platformsFor(["web", "ios"]), ["web", "ios"]);       // A = Web + iPhone
    assert.deepEqual(platformsFor(["android"]), ["android"]);             // B = Android
    assert.deepEqual(platformsFor(["android", "web", "ios"]), ["web", "ios", "android"]);  // C = all three, canonical order
    assert.deepEqual(platformsFor([]), ["web", "ios", "android"]);
    assert.deepEqual(platformsFor(["tv"]), ["web", "ios", "android"]);
  });
  test("RC1 applicability: shared tests on all three; the two web-only tests on web alone (Web 11, iOS 9, Android 9)", () => {
    const rc1 = [...Array.from({ length: 9 }, (_, i) => T(`s${i}`)), T("w1", { platform: "web" }), T("w2", { platform: "web" })];
    const count = (p) => rc1.filter((t) => appliesTo(t, p)).length;
    assert.deepEqual([count("web"), count("ios"), count("android")], [11, 9, 9]);
    assert.equal(appliesTo(T("w1", { platform: "web" }), "ios"), false);
    assert.equal(appliesTo(T("w1", { platform: "web" }), "android"), false);
    assert.equal(appliesTo(T("i", { platform: "ios" }), "web"), false);
  });
  test("the website never tells anyone to open the mobile app; the apps still do", () => {
    assert.doesNotMatch(whereToDoIt("web"), /\bapp\b|iPhone|Android|phone/i); assert.match(whereToDoIt("web"), /website/i);
    assert.doesNotMatch(goTryIt("web"), /\bapp\b/i); assert.match(goTryIt("web"), /website/i);
    assert.match(whereToDoIt("ios"), /app on your iPhone/); assert.match(whereToDoIt("android"), /app on your Android phone/);
  });
  test("website steps replace the shared steps on web only", () => {
    const t = { steps: ["Open the OneShetland app."], web_steps: ["Open the OneShetland website."] };
    assert.deepEqual(stepsFor(t, "web"), t.web_steps); assert.deepEqual(stepsFor(t, "ios"), t.steps); assert.deepEqual(stepsFor(t, "android"), t.steps);
    assert.deepEqual(stepsFor({ steps: ["x"], web_steps: null }, "web"), ["x"]);
    assert.deepEqual(stepsFor({ steps: ["x"], web_steps: [] }, "web"), ["x"]);
  });
  test("web context is coarse and non-identifying: a browser name and major version, a device class, a window size", () => {
    const chrome = detectWebContext("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36", 1440, 900);
    assert.deepEqual(chrome, { browser: "Chrome 130", deviceClass: "desktop", viewport: "1440x900" });
    const safari = detectWebContext("Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1", 390, 844);
    assert.deepEqual(safari, { browser: "Safari 18", deviceClass: "mobile", viewport: "390x844" });
    assert.equal(detectWebContext("Mozilla/5.0 (iPad; CPU OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1", 820, 1180).deviceClass, "tablet");
    assert.equal(detectWebContext("Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/130.0.0.0 Mobile Safari/537.36").deviceClass, "mobile");
    assert.equal(detectWebContext("Mozilla/5.0 (Linux; Android 14; SM-X900) AppleWebKit/537.36 Chrome/130.0.0.0 Safari/537.36").deviceClass, "tablet");
    assert.equal(detectWebContext("Mozilla/5.0 (Windows NT 10.0) Gecko/20100101 Firefox/131.0", 0, 0).viewport, null);
    assert.deepEqual(Object.keys(chrome).sort(), ["browser", "deviceClass", "viewport"], "no other facts are collected");
  });
});

describe("a cell is test × tester × PLATFORM — results never cross platforms", () => {
  const all3 = U("a");
  test("a pass on one platform does not satisfy another", () => {
    const only = (p) => [L("t", "a", "passed", { platform: p })];
    for (const p of ["web", "ios", "android"]) for (const q of ["web", "ios", "android"]) {
      assert.equal(cellState(all3, T("t"), q, only(p)), p === q ? "passed" : "not_started", `${p} pass seen on ${q}`);
    }
  });
  test("an issue on one platform is visible on that platform only", () => {
    const l = [L("t", "a", "issue", { platform: "android", review_state: "open" }), L("t", "a", "passed", { platform: "ios" })];
    assert.equal(cellState(all3, T("t"), "android", l), "issue");
    assert.equal(cellState(all3, T("t"), "ios", l), "passed");
    assert.equal(cellState(all3, T("t"), "web", l), "not_started");
  });
  test("a platform the tester is not assigned, or a test that does not apply there, is not applicable", () => {
    assert.equal(cellState(U("a", { platforms: ["android"] }), T("t"), "web", []), "na");
    assert.equal(cellState(U("a", { platforms: ["web", "ios"] }), T("t"), "android", []), "na");
    assert.equal(cellState(all3, T("t", { platform: "web" }), "ios", []), "na");
    assert.equal(cellState(all3, T("t", { platform: "web" }), "web", []), "not_started");
  });
  test("a result from a platform the tester is not assigned never counts for them", () => {
    assert.equal(cellState(U("a", { platforms: ["android"] }), T("t"), "web", [L("t", "a", "passed", { platform: "web" })]), "na");
  });
});

describe("readiness per platform and overall", () => {
  const shared = Array.from({ length: 3 }, (_, i) => T(`s${i}`));
  const tests = [...shared, T("w1", { platform: "web" })];
  const mx = (testers, latest, ts = tests) => summarise(buildMatrix(ts, testers, latest));

  test("a single platform's passes can never produce READY overall (web-only, iPhone-only and Android-only testers)", () => {
    for (const p of ["web", "ios", "android"]) {
      const r = mx([U("a", { platforms: [p] })], PASS_ALL(tests, "a", [p]));
      assert.equal(r.platforms[p].gate, "ready", `${p} on its own`);
      assert.equal(r.overall.gate, "incomplete", `${p} alone must not be READY overall`);
      assert.notEqual(r.overall.gate, "ready");
    }
  });
  test("…precisely: with one tester covering all three, only web passed → web READY, ios/android INCOMPLETE, overall INCOMPLETE", () => {
    const r = mx([U("a")], PASS_ALL(tests, "a", ["web"]));
    assert.equal(r.platforms.web.gate, "ready"); assert.equal(r.platforms.ios.gate, "incomplete"); assert.equal(r.platforms.android.gate, "incomplete");
    assert.equal(r.overall.gate, "incomplete");
  });
  test("overall READY needs web, ios and android each READY", () => {
    const r = mx([U("a")], PASS_ALL(tests, "a", ["web", "ios", "android"]));
    assert.equal(r.overall.gate, "ready"); for (const p of ["web", "ios", "android"]) assert.equal(r.platforms[p].gate, "ready");
    assert.equal(r.platforms.web.checks, 4); assert.equal(r.platforms.ios.checks, 3); assert.equal(r.platforms.android.checks, 3);
    assert.equal(r.overall.checks, 10); assert.equal(r.overall.passed, 10);
  });
  test("tester split: A = web+ios, B = android → each platform judged on its own testers; all pass → READY", () => {
    const r = mx([U("a", { platforms: ["web", "ios"] }), U("b", { platforms: ["android"] })], [...PASS_ALL(tests, "a", ["web", "ios"]), ...PASS_ALL(tests, "b", ["android"])]);
    assert.equal(r.overall.gate, "ready"); assert.equal(r.platforms.web.testers, 1); assert.equal(r.platforms.android.testers, 1);
  });
  test("a platform with nobody assigned is INCOMPLETE and keeps the overall INCOMPLETE — it is never silently ignored", () => {
    const r = mx([U("a", { platforms: ["web", "ios"] })], PASS_ALL(tests, "a", ["web", "ios"]));
    assert.equal(r.platforms.android.gate, "incomplete"); assert.match(r.platforms.android.gateReason, /No tester is assigned to Android/);
    assert.equal(r.overall.gate, "incomplete");
  });
  test("an unresolved issue on any platform makes that platform and the overall NOT READY, even when the rest passed", () => {
    const l = [...PASS_ALL(tests, "a", ["web", "ios", "android"]).filter((x) => !(x.test_id === "s1" && x.platform === "android")), L("s1", "a", "issue", { platform: "android", review_state: "open" })];
    const r = mx([U("a")], l);
    assert.equal(r.platforms.android.gate, "not_ready"); assert.equal(r.platforms.web.gate, "ready"); assert.equal(r.platforms.ios.gate, "ready");
    assert.equal(r.overall.gate, "not_ready"); assert.equal(r.overall.openIssues, 1);
  });
  test("an issue marked resolved is INCOMPLETE until re-checked on THAT platform; a pass on another platform does not clear it", () => {
    const base = PASS_ALL(tests, "a", ["web", "ios", "android"]).filter((x) => !(x.test_id === "s1" && x.platform === "ios"));
    const resolved = [...base, L("s1", "a", "issue", { platform: "ios", review_state: "resolved" })];
    const r = mx([U("a")], resolved);
    assert.equal(r.platforms.ios.gate, "incomplete"); assert.equal(r.overall.gate, "incomplete");
    assert.equal(mx([U("a")], [...base, L("s1", "a", "passed", { platform: "ios" })]).overall.gate, "ready");
  });
  test("blocked and in-progress mandatory checks are INCOMPLETE and counted separately", () => {
    const base = PASS_ALL(tests, "a", ["web", "ios", "android"]).filter((x) => !(x.platform === "web" && (x.test_id === "s0" || x.test_id === "s1")));
    const r = mx([U("a")], [...base, L("s0", "a", "blocked", { platform: "web", review_state: "open" }), L("s1", "a", "in_progress", { platform: "web" })]);
    assert.equal(r.platforms.web.gate, "incomplete"); assert.equal(r.platforms.web.blocked, 1); assert.equal(r.platforms.web.incomplete, 1);
    assert.equal(r.overall.gate, "incomplete");
  });
  test("web-only tests count toward Web alone", () => {
    const r = mx([U("a")], []);
    assert.equal(r.platforms.web.mandatoryTests, 4); assert.equal(r.platforms.ios.mandatoryTests, 3); assert.equal(r.platforms.android.mandatoryTests, 3);
    const webOnlyMissing = mx([U("a")], PASS_ALL(shared, "a", ["web", "ios", "android"]));
    assert.equal(webOnlyMissing.platforms.ios.gate, "ready"); assert.equal(webOnlyMissing.platforms.web.gate, "incomplete");
  });
  test("a non-mandatory issue is counted nowhere in the gate; inactive tests and disabled testers take no part", () => {
    const opt = [T("t1"), T("t2", { mandatory: false })];
    const l = [...PASS_ALL([T("t1")], "a", ["web", "ios", "android"]), L("t2", "a", "issue", { review_state: "open" })];
    assert.equal(mx([U("a")], l, opt).overall.gate, "ready");
    assert.equal(mx([U("a")], PASS_ALL([T("t1")], "a", ["web", "ios", "android"]), [T("t1"), T("t2", { active: false })]).overall.gate, "ready");
    const d = mx([U("a"), U("b", { enabled: false })], PASS_ALL([T("t1")], "a", ["web", "ios", "android"]), [T("t1")]);
    assert.equal(d.overall.gate, "ready"); assert.equal(d.overall.testers, 1);
  });
  test("nothing to judge → INCOMPLETE, never READY (no testers, no mandatory tests)", () => {
    assert.equal(mx([], []).overall.gate, "incomplete");
    assert.equal(mx([U("a")], [], [T("t1", { mandatory: false })]).overall.gate, "incomplete");
  });
  test("the 11 / 9 / 9 count: three testers, each fully passing their own platform, gives READY with 29 checks", () => {
    const rc1 = [...Array.from({ length: 9 }, (_, i) => T(`s${i}`)), T("w1", { platform: "web" }), T("w2", { platform: "web" })];
    const r = mx([U("a", { platforms: ["web"] }), U("b", { platforms: ["ios"] }), U("c", { platforms: ["android"] })],
      [...PASS_ALL(rc1, "a", ["web"]), ...PASS_ALL(rc1, "b", ["ios"]), ...PASS_ALL(rc1, "c", ["android"])], rc1);
    assert.deepEqual([r.platforms.web.checks, r.platforms.ios.checks, r.platforms.android.checks], [11, 9, 9]);
    assert.equal(r.overall.checks, 29); assert.equal(r.overall.gate, "ready");
  });
});

describe("the tester's own progress, per platform", () => {
  const tests = [{ id: "s", platform: "all" }, { id: "w", platform: "web" }];
  const sessions = [{ id: "sw", platform: "web" }, { id: "si", platform: "ios" }];
  const at = (test_id, session_id, status) => ({ test_id, session_id, status, retest_requested: false, created_at: "2026-10-11T10:00" });
  test("Web counts 2 tests, iPhone 1, Android 1; each reads only its own session", () => {
    const attempts = [at("s", "sw", "passed"), at("w", "sw", "passed"), at("s", "si", "in_progress")];
    const r = progressByPlatform(["web", "ios", "android"], tests, sessions, attempts);
    const by = Object.fromEntries(r.platforms.map((x) => [x.platform, x]));
    assert.deepEqual([by.web.progress.total, by.web.progress.completed], [2, 2]);
    assert.deepEqual([by.ios.progress.total, by.ios.progress.completed], [1, 0], "a web pass is not an iPhone pass");
    assert.deepEqual([by.android.progress.total, by.android.progress.completed, by.android.started], [1, 0, false]);
    assert.deepEqual([r.overall.total, r.overall.completed], [4, 2]);
  });
  test("only assigned platforms appear; the order is web, iPhone, Android", () => {
    const r = progressByPlatform(["android", "web"], tests, sessions, []);
    assert.deepEqual(r.platforms.map((x) => x.platform), ["web", "android"]);
  });
});

describe("the tester's own progress", () => {
  test("counts submitted results, and flags a re-check request", () => {
    const attempts = [
      { test_id: "a", status: "passed", retest_requested: false, created_at: "2026-10-11T10:00" },
      { test_id: "a", status: "issue", retest_requested: false, created_at: "2026-10-11T09:00" },     // older: ignored
      { test_id: "b", status: "issue", retest_requested: true, created_at: "2026-10-11T10:00" },
      { test_id: "c", status: "blocked", retest_requested: false, created_at: "2026-10-11T10:00" },
      { test_id: "d", status: "in_progress", retest_requested: false, created_at: "2026-10-11T10:00" },
    ];
    const latest = latestPerTest(attempts);
    assert.equal(latest.get("a").status, "passed");
    const p = myProgress([{ id: "a" }, { id: "b" }, { id: "c" }, { id: "d" }, { id: "e" }], latest);
    assert.deepEqual(p, { total: 5, completed: 3, passed: 1, issues: 1, blocked: 1, recheck: 1 });
  });
});

describe("real-money wording and rule", () => {
  test("every money type shows a REAL MONEY warning with the spend cap; ordinary tests show none", () => {
    for (const money_test_type of ["wallet", "real_card", "donation"]) {
      const w = moneyWarning({ money_test_type, expected_max_spend_pence: 200 });
      assert.equal(w.headline, "REAL MONEY TEST"); assert.equal(w.spend, "Expected spend: no more than £2.00.");
      assert.match(w.body, /live OneShetland payment system/);
      assert.equal(requiresAck({ money_test_type }), true);
    }
    assert.equal(moneyWarning({ money_test_type: "none", expected_max_spend_pence: null }), null);
    assert.equal(requiresAck({ money_test_type: "none" }), false);
  });
  test("a wallet test says it uses real Wallet value; a card test says your own real card", () => {
    assert.match(moneyWarning({ money_test_type: "wallet", expected_max_spend_pence: null }).body, /real value from your OneShetland Wallet/);
    assert.match(moneyWarning({ money_test_type: "real_card", expected_max_spend_pence: null }).body, /your own real bank card/);
    assert.equal(moneyWarning({ money_test_type: "wallet", expected_max_spend_pence: null }).spend, null);
  });
  test("amounts format as pounds; the acknowledgement is the agreed sentence; nothing promises a refund", () => {
    assert.equal(formatMaxSpend(150), "£1.50"); assert.equal(formatMaxSpend(0), "£0.00"); assert.equal(formatMaxSpend(null), null);
    assert.equal(ACK_LABEL, "I understand this is a real transaction.");
    const all = JSON.stringify([moneyWarning({ money_test_type: "real_card", expected_max_spend_pence: 200 }), NEVER_SHARE_NOTICE]);
    assert.doesNotMatch(all, /refund|reimburs/i);
    assert.match(NEVER_SHARE_NOTICE, /never put card numbers, bank details, passwords/);
  });
});

describe("the real-money rule is the same on every platform, the website included", () => {
  test("the acknowledgement and warning depend on the test, never on the platform", () => {
    for (const money_test_type of ["wallet", "real_card", "donation"]) {
      assert.equal(requiresAck({ money_test_type, platform: "web" }), true);
      assert.equal(moneyWarning({ money_test_type, expected_max_spend_pence: 200, platform: "web" }).headline, "REAL MONEY TEST");
    }
    assert.equal(moneyWarning({ money_test_type: "none", expected_max_spend_pence: null }), null);
  });
  test("the money wording is platform-neutral (it never says 'app'), so it reads correctly on the website", () => {
    for (const money_test_type of ["wallet", "real_card", "donation"]) assert.doesNotMatch(moneyWarning({ money_test_type, expected_max_spend_pence: 200 }).body, /\bapp\b/i);
  });
});

describe("screenshot checks", () => {
  const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
  const jpg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0, 0, 0, 0, 0]);
  const webp = new Uint8Array([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50]);
  const heic = new Uint8Array([0, 0, 0, 24, 0x66, 0x74, 0x79, 0x70, 0x68, 0x65, 0x69, 0x63]);
  test("the real file type is read from the bytes, not trusted from the label", () => {
    assert.equal(sniffImageType(png), "image/png"); assert.equal(sniffImageType(jpg), "image/jpeg");
    assert.equal(sniffImageType(webp), "image/webp"); assert.equal(sniffImageType(heic), "image/heic");
    assert.equal(sniffImageType(new Uint8Array([0x3c, 0x73, 0x76, 0x67, 0x20, 0x78, 0x6d, 0x6c, 0, 0, 0, 0])), null, "an SVG is not accepted");
    assert.equal(sniffImageType(new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0, 0, 0, 0, 0, 0, 0])), null, "a PDF is not accepted");
    assert.equal(checkEvidence({ type: "image/png", size: 1000 }, new Uint8Array([0x4d, 0x5a, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0])).ok, false, "an .exe labelled png is refused");
  });
  test("size limit, empty files, and the four-per-result cap", () => {
    assert.equal(checkEvidence({ type: "image/png", size: 1000 }, png).ok, true);
    assert.match(checkEvidence({ type: "image/png", size: MAX_EVIDENCE_BYTES + 1 }, png).error, /too big/);
    assert.match(checkEvidence({ type: "image/png", size: 0 }, png).error, /empty/);
    assert.match(checkEvidence({ type: "image/png", size: 10 }, png, 4).error, /up to 4/);
    assert.equal(checkEvidence({ type: "image/gif", size: 10 }, png).ok, false);
  });
  test("the storage path is only ever <attempt uuid>/<new uuid>.<known ext>", () => {
    const a = "11111111-1111-4111-8111-111111111111", b = "22222222-2222-4222-8222-222222222222";
    assert.equal(evidencePath(a, b, "png"), `${a}/${b}.png`);
    assert.throws(() => evidencePath("../x", b, "png")); assert.throws(() => evidencePath(a, b, "exe")); assert.throws(() => evidencePath(a, "evidence", "png"));
  });
});

/**
 * Launch Test Centre — the rules that run in the browser/server layer under plain node.
 * (The database half — RLS, append-only history, evidence privacy — is proved in the backend repo: supabase/tests/launch-test-centre.node.test.ts.)
 *
 * Run: node --test tests/launch-testing.test.mjs
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { launchAccessFor } from "../lib/launch-testing/access.ts";
import { buildMatrix, cellState, summarise, requiredPlatforms, latestPerTest, myProgress, stateOfAttempt } from "../lib/launch-testing/readiness.ts";
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
const U = (user_id, o = {}) => ({ user_id, enabled: true, platforms: [], sessionPlatforms: ["ios"], ...o });
const L = (test_id, user_id, status, o = {}) => ({ attempt_id: `${test_id}-${user_id}-${status}`, test_id, user_id, platform: "ios", app_build: "148", status, review_state: null, retest_requested: false, started_at: "2026-10-11", completed_at: null, attempts_total: 1, ...o });

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

describe("which phone types a tester must cover", () => {
  test("assigned platforms win; otherwise the platforms they have started; otherwise any", () => {
    assert.deepEqual(requiredPlatforms(U("a", { platforms: ["ios", "android"], sessionPlatforms: [] }), T("t")), ["ios", "android"]);
    assert.deepEqual(requiredPlatforms(U("a", { platforms: [], sessionPlatforms: ["android"] }), T("t")), ["android"]);
    assert.deepEqual(requiredPlatforms(U("a", { platforms: [], sessionPlatforms: [] }), T("t")), ["any"]);
    assert.deepEqual(requiredPlatforms(U("a", { platforms: [], sessionPlatforms: [] }), T("t", { platform: "android" })), ["android"]);
  });
  test("a platform-specific test does not apply to a tester on the other platform", () => {
    assert.equal(requiredPlatforms(U("a", { platforms: ["ios"] }), T("t", { platform: "android" })), null);
    assert.equal(cellState(U("a", { platforms: ["ios"] }), T("t", { platform: "android" }), []), "na");
  });
});

describe("a cell is the worst thing true across the phones the tester should cover", () => {
  const both = U("a", { platforms: ["ios", "android"], sessionPlatforms: ["ios", "android"] });
  test("iOS passed + Android not started → not started; + Android issue → issue; both passed → passed", () => {
    assert.equal(cellState(both, T("t"), [L("t", "a", "passed")]), "not_started");
    assert.equal(cellState(both, T("t"), [L("t", "a", "passed"), L("t", "a", "issue", { platform: "android", review_state: "open" })]), "issue");
    assert.equal(cellState(both, T("t"), [L("t", "a", "passed"), L("t", "a", "passed", { platform: "android" })]), "passed");
  });
  test("an Android pass does not hide an iOS failure", () => {
    assert.equal(cellState(both, T("t"), [L("t", "a", "issue", { review_state: "open" }), L("t", "a", "passed", { platform: "android" })]), "issue");
  });
});

describe("launch gate", () => {
  const tests = [T("t1"), T("t2")];
  const mx = (testers, latest, ts = tests) => summarise(buildMatrix(ts, testers, latest));

  test("READY only when every applicable mandatory test has passed for every enabled tester and nothing is open", () => {
    const g = mx([U("a"), U("b")], ["t1", "t2"].flatMap((t) => ["a", "b"].map((u) => L(t, u, "passed"))));
    assert.equal(g.gate, "ready"); assert.equal(g.passed, 4); assert.equal(g.applicable, 4);
  });
  test("NOT READY when any mandatory result has an unresolved issue — even if everything else passed", () => {
    const g = mx([U("a")], [L("t1", "a", "passed"), L("t2", "a", "issue", { review_state: "open" })]);
    assert.equal(g.gate, "not_ready"); assert.equal(g.openIssues, 1);
    assert.equal(mx([U("a")], [L("t1", "a", "passed"), L("t2", "a", "issue", { review_state: "fix_pending" })]).gate, "not_ready");
  });
  test("an issue marked resolved is INCOMPLETE until it is re-checked and passes; then READY", () => {
    const resolved = [L("t1", "a", "passed"), L("t2", "a", "issue", { review_state: "resolved" })];
    const g = mx([U("a")], resolved);
    assert.equal(g.gate, "incomplete"); assert.equal(g.recheck, 1);
    assert.equal(mx([U("a")], [L("t1", "a", "passed"), L("t2", "a", "passed")]).gate, "ready");
  });
  test("INCOMPLETE while a mandatory test is untested, in progress or blocked", () => {
    assert.equal(mx([U("a")], [L("t1", "a", "passed")]).gate, "incomplete");
    assert.equal(mx([U("a")], [L("t1", "a", "passed"), L("t2", "a", "in_progress")]).gate, "incomplete");
    const b = mx([U("a")], [L("t1", "a", "passed"), L("t2", "a", "blocked", { review_state: "open" })]);
    assert.equal(b.gate, "incomplete"); assert.equal(b.blocked, 1);
  });
  test("a non-mandatory issue is counted but does not block READY; an inactive test and a disabled tester take no part", () => {
    const opt = [T("t1"), T("t2", { mandatory: false })];
    const g = mx([U("a")], [L("t1", "a", "passed"), L("t2", "a", "issue", { review_state: "open" })], opt);
    assert.equal(g.gate, "ready"); assert.equal(g.openIssues, 1);
    const inactive = mx([U("a")], [L("t1", "a", "passed")], [T("t1"), T("t2", { active: false })]);
    assert.equal(inactive.gate, "ready");
    const disabled = mx([U("a"), U("b", { enabled: false })], [L("t1", "a", "passed"), L("t2", "a", "passed")]);
    assert.equal(disabled.gate, "ready"); assert.equal(disabled.testers, 1);
  });
  test("nothing to judge → INCOMPLETE, never READY (no testers, no mandatory tests)", () => {
    assert.equal(mx([], []).gate, "incomplete");
    assert.equal(mx([U("a")], [], [T("t1", { mandatory: false })]).gate, "incomplete");
  });
  test("not-applicable cells are excluded from the counts and from the verdict", () => {
    const ts = [T("t1"), T("t2", { platform: "android" })];
    const g = mx([U("a", { platforms: ["ios"] })], [L("t1", "a", "passed")], ts);
    assert.equal(g.gate, "ready"); assert.equal(g.applicable, 1);
  });
  test("pass rate numbers: 21 of 27 style counts add up", () => {
    const ts = Array.from({ length: 9 }, (_, i) => T(`t${i}`));
    const testers = [U("a"), U("b"), U("c")];
    const latest = ts.flatMap((t, i) => testers.map((u, j) => (i * 3 + j < 21 ? L(t.id, u.user_id, "passed") : L(t.id, u.user_id, "in_progress"))));
    const s = summarise(buildMatrix(ts, testers, latest));
    assert.equal(s.applicable, 27); assert.equal(s.passed, 21); assert.equal(s.testers, 3); assert.equal(s.mandatoryTests, 9);
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

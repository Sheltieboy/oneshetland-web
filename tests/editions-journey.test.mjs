/**
 * The owner's journey inside an Edition: Draft -> In review -> (Changes requested) -> Approved -> package -> Live. Pure rules plus source guards; no network.
 * Run: node --test --import ./tests/support/register-jsx.mjs tests/editions-journey.test.mjs
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const J = await import("../lib/editions/journey.ts");
const { previewReason } = await import("../components/editions/PreviewBanner.tsx");

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => readFileSync(join(ROOT, p), "utf8");
const na = (o) => J.nextAction({ status: "draft", review_state: "not_submitted", entitled: false, role: "owner", ready: true, ...o });

describe("one combined state in plain words", () => {
  const cases = [
    [{ status: "draft", review_state: "not_submitted" }, "draft", "Draft"],
    [{ status: "draft", review_state: "submitted" }, "in_review", "In review"],
    [{ status: "draft", review_state: "changes_requested" }, "changes_requested", "Changes requested"],
    [{ status: "draft", review_state: "rejected" }, "rejected", "Not approved"],
    [{ status: "draft", review_state: "approved" }, "approved", "Approved"],
    [{ status: "published", review_state: "approved" }, "live", "Live"],
    [{ status: "published", review_state: "submitted" }, "in_review", "In review"],
    [{ status: "archived", review_state: "approved" }, "archived", "Archived"],
    [{ status: "suspended", review_state: "approved" }, "suspended", "Suspended"],
  ];
  for (const [e, state, label] of cases) test(`${e.status}/${e.review_state} is ${label}`, () => { assert.equal(J.editionState(e), state); assert.equal(J.STATE_LABEL[state], label); });
  test("only changes requested and not approved ask for attention", () => {
    assert.deepEqual(Object.keys(J.STATE_LABEL).filter((s) => J.needsAttention(s)), ["changes_requested", "rejected"]);
  });
  test("the stepper has four steps; editing states stay on Draft; archived and suspended sit outside", () => {
    assert.deepEqual([...J.STEPS], ["Draft", "In review", "Approved", "Live"]);
    assert.deepEqual(["draft", "changes_requested", "rejected", "in_review", "approved", "live", "archived", "suspended"].map(J.stepIndex), [0, 0, 0, 1, 2, 3, -1, -1]);
  });
});

describe("state to next action", () => {
  test("draft: submit, disabled until the required items are done", () => {
    assert.equal(na({}).key, "submit"); assert.equal(na({}).primary, "submit");
    assert.equal(na({ ready: false }).key, "finish_checklist");
  });
  test("in review: wait, with Withdraw", () => { const a = na({ review_state: "submitted" }); assert.equal(a.key, "waiting"); assert.equal(a.primary, "withdraw"); });
  test("a material change waits without Withdraw and says the Edition is hidden", () => {
    const a = na({ status: "published", review_state: "submitted", material: true });
    assert.equal(a.key, "waiting_material"); assert.equal(a.primary, null); assert.match(a.detail, /hidden from the public/);
  });
  test("changes requested and rejected both resubmit", () => {
    assert.deepEqual([na({ review_state: "changes_requested" }), na({ review_state: "rejected" })].map((a) => [a.key, a.primary]), [["fix_changes", "resubmit"], ["fix_rejected", "resubmit"]]);
  });
  test("approved: choose a package first, then publish", () => {
    assert.deepEqual([na({ review_state: "approved" }).key, na({ review_state: "approved" }).primary], ["choose_package", "choose_package"]);
    assert.deepEqual([na({ review_state: "approved", entitled: true }).key, na({ review_state: "approved", entitled: true }).primary], ["publish", "publish"]);
  });
  test("live: view the public page. Archived can be restored. Suspended has nothing to do", () => {
    assert.equal(na({ status: "published", review_state: "approved", entitled: true }).primary, "view_live");
    assert.equal(na({ status: "archived" }).primary, "restore");
    assert.equal(na({ status: "suspended" }).primary, null);
  });
  test("an editor sees the same state but is told to ask an owner or administrator", () => {
    const a = na({ role: "editor", review_state: "approved", entitled: true });
    assert.equal(a.canAct, false); assert.match(a.ownerOnlyNote, /administrator or owner/);
    assert.equal(na({ role: "admin" }).canAct, true);
  });
  test("Publish needs approval AND an active package, and says which is missing", () => {
    assert.equal(J.canPublishNow({ status: "draft", review_state: "approved", entitled: true }), true);
    assert.equal(J.canPublishNow({ status: "draft", review_state: "approved", entitled: false }), false);
    assert.equal(J.canPublishNow({ status: "draft", review_state: "submitted", entitled: true }), false);
    assert.equal(J.canPublishNow({ status: "published", review_state: "approved", entitled: true }), false);
    assert.deepEqual(J.publishBlockers({ status: "draft", review_state: "not_submitted", entitled: false }).length, 2);
    assert.match(J.publishBlockers({ status: "draft", review_state: "approved", entitled: false })[0], /package/);
  });
});

describe("review status from the database", () => {
  test("reads state, message and history; tolerates junk", () => {
    const r = J.parseReviewStatus({ state: "changes_requested", submitted_at: "2027-01-02T10:00:00Z", last_decision: "changes_requested", last_note: "Add a cover photo", last_at: "2027-01-03T10:00:00Z", material: false, history: [{ action: "submitted", at: "2027-01-02T10:00:00Z", note: null }, { nope: 1 }] });
    assert.equal(r.state, "changes_requested"); assert.equal(r.last_note, "Add a cover photo"); assert.equal(r.history.length, 1);
    assert.equal(J.parseReviewStatus(null, "approved").state, "approved");
    assert.equal(J.parseReviewStatus({ state: "weird" }, "submitted").state, "submitted");
  });
  test("history actions have owner-friendly names", () => { for (const a of ["submitted", "withdrawn", "approved", "changes_requested", "rejected", "material_change"]) assert.ok(!/_/.test(J.historyLabel(a))); });
});

describe("material changes", () => {
  const before = { title: "Up Helly Aa", kind: "single_day", starts_on: "2027-01-26", ends_on: "2027-01-26" };
  test("title, kind, start and end are detected", () => {
    assert.deepEqual(J.changedMaterialFields(before, { ...before, title: "Up Helly Aa 2027" }), ["title"]);
    assert.deepEqual(J.changedMaterialFields(before, { ...before, kind: "multi_day", ends_on: "2027-01-28" }), ["kind", "ends_on"]);
    assert.deepEqual(J.changedMaterialFields(before, { ...before, starts_on: "2027-01-27", ends_on: "2027-01-27" }), ["starts_on", "ends_on"]);
  });
  test("whitespace around the title is not a change; no change means no warning", () => {
    assert.deepEqual(J.changedMaterialFields(before, { ...before, title: "  Up Helly Aa " }), []);
  });
  test("only an approved Edition is sent back to review", () => {
    const after = { ...before, title: "New" };
    assert.deepEqual(J.materialChangesFor("approved", before, after), ["title"]);
    for (const s of ["not_submitted", "submitted", "changes_requested", "rejected", null]) assert.deepEqual(J.materialChangesFor(s, before, after), [], String(s));
  });
  test("the warning is the agreed wording and the sentence reads naturally", () => {
    assert.equal(J.MATERIAL_WARNING, "This sends your Edition back to OneShetland for review. While it is in review it will not be visible to the public.");
    assert.equal(J.materialSentence(["title", "starts_on", "ends_on"]), "the title, the start date and the end date");
    assert.equal(J.materialSentence(["kind"]), "the kind of Edition");
  });
  test("the form warns, asks for confirmation before saving, and says what happened afterwards", () => {
    const f = read("components/editions-manage/EditionForm.tsx");
    assert.match(f, /materialChangesFor\(edition\.review_state, edition, f\)/);
    assert.match(f, /await confirm\([\s\S]*?MATERIAL_WARNING/);
    assert.match(f, /MATERIAL_SAVED/);
    assert.match(f, /role="note"/);
  });
});

describe("packages", () => {
  const base = { id: "p1", code: "standard", name: "Standard", description: null, price_pence: 4500, duration_days: 365, features: ["collect_payments"], max_members: null, active: true, sort: 1 };
  test("a paid package shows pounds, a year, what it includes, and can be paid for while payments are on", () => {
    const v = J.packageView(base, { commerceOn: true });
    assert.equal(v.priceLabel, "£45.00"); assert.equal(v.durationLabel, "1 year"); assert.equal(v.choice, "pay"); assert.equal(v.free, false); assert.equal(v.community, false);
    assert.deepEqual(v.includes, ["Publish your Edition", "Take payments"]);
  });
  test("an explicit free package says Free and is claimed, with payments on or off", () => {
    for (const on of [true, false]) { const v = J.packageView({ ...base, price_pence: 0, is_free: true }, { commerceOn: on }); assert.equal(v.priceLabel, "Free"); assert.equal(v.choice, "claim"); assert.equal(v.unavailableText, null); }
  });
  test("a price of nothing is not free unless the package says so", () => { assert.notEqual(J.packageView({ ...base, price_pence: 0 }, { commerceOn: true }).priceLabel, "Free"); });
  test("Hub-run packages carry the Community rate label", () => {
    assert.equal(J.packageView({ ...base, audience: "hub" }, { commerceOn: true }).communityLabel, "Community rate");
    assert.equal(J.packageView({ ...base, audience: "any" }, { commerceOn: true }).communityLabel, null);
  });
  test("with online payment off a paid package is honestly unavailable while free ones still work", () => {
    const v = J.packageView(base, { commerceOn: false });
    assert.equal(v.choice, "unavailable"); assert.equal(v.unavailableText, "Online payment is not available yet.");
  });
  test("durations", () => { assert.deepEqual([30, 90, 365, 730, 1].map(J.durationLabel), ["30 days", "3 months", "1 year", "2 years", "1 day"]); });
  test("active until: the latest current publish package; withdrawn or ended ones do not count", () => {
    const now = Date.parse("2027-06-01T00:00:00Z");
    const e = (o) => ({ feature: "publish", starts_at: "2027-01-01T00:00:00Z", ends_at: "2027-12-31T00:00:00Z", voided_at: null, ...o });
    assert.equal(J.activeUntil([e({}), e({ ends_at: "2028-03-01T00:00:00Z" })], now), "2028-03-01T00:00:00Z");
    assert.equal(J.activeUntil([e({ voided_at: "2027-02-01T00:00:00Z" }), e({ ends_at: "2027-03-01T00:00:00Z" }), e({ feature: "csv_export" })], now), null);
    assert.equal(J.dayLabel("2028-03-01T00:00:00Z"), "1 March 2028");
  });
});

describe("preview wording for every state", () => {
  const on = { enabled: true, entitled: true, parentLive: true };
  const e = (o) => ({ status: "draft", review_state: "not_submitted", is_test: false, suspended_reason: null, ...o });
  test("each state has its own reason, and a public Edition has none", () => {
    const key = (edition, extra = {}) => previewReason({ edition, ...on, ...extra })?.key ?? null;
    assert.equal(key(e()), "draft");
    assert.equal(key(e({ review_state: "submitted" })), "in_review");
    assert.equal(key(e({ status: "published", review_state: "submitted" })), "in_review");
    assert.equal(key(e({ review_state: "changes_requested" })), "changes_requested");
    assert.equal(key(e({ review_state: "rejected" })), "rejected");
    assert.equal(key(e({ review_state: "approved" })), "approved_unpublished");
    assert.equal(key(e({ review_state: "approved" }), { entitled: false }), "no_package");
    assert.equal(key(e({ status: "published", review_state: "approved" }), { parentLive: false }), "parent_inactive");
    assert.equal(key(e({ status: "published", review_state: "approved" }), { enabled: false }), "disabled");
    assert.equal(key(e({ status: "published", review_state: "approved", is_test: true })), "test");
    assert.equal(key(e({ status: "archived" })), "archived");
    assert.equal(key(e({ status: "suspended", suspended_reason: "ZZ" })), "suspended");
    assert.equal(key(e({ status: "published", review_state: "approved" })), null);
  });
  test("the wording is reassuring and speaks to the team", () => {
    assert.equal(previewReason({ edition: e({ review_state: "submitted" }), ...on }).text.startsWith("Only your team can see this. OneShetland is reviewing it"), true);
    assert.match(previewReason({ edition: e({ review_state: "approved" }), ...on, entitled: false }).text, /Choose a package/);
  });
});

describe("source guards", () => {
  const actions = read("app/organise/actions.ts");
  const commerce = read("app/organise/commerce-actions.ts");
  const body = (src, n) => src.split(`export async function ${n}(`)[1].split(/\nexport async function |\n\/\* ──/)[0];
  const rpcs = (b) => [...b.matchAll(/\.rpc\("([a-z_]+)"/g)].map((m) => m[1]);
  const gate = /^\s*(?:if \(isDemoMode\(\)\) return bad\(DEMO_BLOCKED\);\s*)?const c = await (?:editionCtx|ctx)\([^)]*"admin"\)/;
  test("submit and withdraw check the role first (owner or administrator) and call exactly one function", () => {
    for (const [n, fn] of [["submitEditionForReview", "edition_submit_for_review"], ["withdrawEditionSubmission", "edition_withdraw_submission"]]) {
      const b = body(actions, n);
      assert.match(b.slice(b.indexOf("{\n") + 2), gate, n);
      assert.deepEqual(rpcs(b), [fn], n);
    }
  });
  test("claiming a free package and buying a paid one are owner/administrator actions with one function each", () => {
    for (const [n, fn] of [["claimFreePackage", "edition_claim_free_package"], ["createPackageOrder", "edition_create_order"]]) {
      const b = body(commerce, n);
      assert.match(b.slice(b.indexOf("{\n") + 2), gate, n);
      assert.deepEqual(rpcs(b), [fn], n);
      assert.match(b, /attempt\.length < 8 \|\| attempt\.length > 80/);
    }
    assert.ok(!/service[_-]?role|SERVICE_KEY|createAdminClient/i.test(commerce));
  });
  test("the web never calls retired or review-deciding functions from the owner area", () => {
    for (const f of [actions, commerce]) assert.ok(!/admin_review_edition|create_edition_organiser|request_edition_organiser_verification|pilot/.test(f));
  });
  test("the overview reads the database's checklist and review status, not local rules", () => {
    const d = read("lib/editions/data.server.ts");
    assert.match(d, /rpc\("edition_readiness"/); assert.match(d, /rpc\("edition_review_status"/);
    assert.ok(!/canPublish\(|readiness\(\{/.test(d + read("lib/editions/rules.ts")));
  });
  test("packages come from the database filtered per organiser and paid flow only after approval", () => {
    assert.match(read("lib/editions/commerce.server.ts"), /rpc\("edition_available_packages", \{ p_org: organiserId \}\)/);
    assert.match(read("components/editions-manage/PackageStep.tsx"), /claimFreePackage/);
    assert.match(read("components/editions-manage/PackageStep.tsx"), /PayButton/);
  });
  test("no screen shows UUIDs, flag names or retired wording", () => {
    const files = ["components/editions-manage/StatusPanels.tsx", "components/editions-manage/JourneyPanels.tsx", "components/editions-manage/PackageStep.tsx", "components/editions-manage/EditionForm.tsx", "components/editions-manage/EditionHeader.tsx",
      "components/editions-commerce/PackagesPanel.tsx", "components/editions/PreviewBanner.tsx", "lib/editions/journey.ts", "app/organise/[slug]/editions/[edition]/page.tsx", "app/organise/[slug]/editions/[edition]/package/page.tsx", "app/organise/[slug]/packages/page.tsx"];
    const bad = /pilot|contact support|entitlement|organiser verification|\bRPC\b|editions\.[a-z_]+\.|uuid|ask OneShetland and we will set it up|not yet available to buy/i;
    for (const f of files) {
      const src = read(f);
      const text = [...src.matchAll(/(["`])((?:(?!\1)[^\n\\])*[ \t](?:(?!\1)[^\n\\])*)\1/g)].map((m) => m[2]).concat(f.endsWith(".tsx") ? [...src.matchAll(/(?<=[>}])([^<>{}\n=;]*[A-Za-z][^<>{}\n=;]*)(?=<)/g)].map((m) => m[1]) : []);
      for (const t of text) if (!/^(import|use client|@\/|\.\.?\/)/.test(t) && !/className|grid |flex |text-|bg-|border|rounded/.test(t)) assert.ok(!bad.test(t), `${f}: "${t}"`);
    }
  });
  test("the old entitlement panel and its support wording are gone", () => {
    assert.ok(!/EntitlementPanel/.test(read("components/editions-manage/StatusPanels.tsx")));
    assert.ok(!/href="\/support"/.test(read("components/editions-commerce/PackagesPanel.tsx") + read("components/editions-manage/StatusPanels.tsx") + read("components/editions-manage/PackageStep.tsx")));
  });
  test("Publish sits behind a confirmation and is owner/administrator only", () => {
    const s = read("components/editions-manage/StatusPanels.tsx");
    assert.match(s, /await confirm\(\{ title: "Publish this Edition\?"/);
    assert.match(s, /canPublishNow/); assert.match(s, /Only an owner or administrator can publish/);
    assert.match(read("components/editions-manage/JourneyPanels.tsx"), /Your Edition is live|View your public page/);
  });
  test("the header and dashboard cards show the combined state, with a hint when attention is needed", () => {
    assert.match(read("components/editions-manage/EditionHeader.tsx"), /EditionStatePill edition=\{edition\} showAttention/);
    assert.match(read("app/organise/[slug]/page.tsx"), /EditionStatePill edition=\{e\} showAttention/);
  });
  test("the overview offers the preview prominently", () => {
    assert.match(read("app/organise/[slug]/editions/[edition]/page.tsx"), /Preview your Edition exactly as visitors will see it/);
  });
});

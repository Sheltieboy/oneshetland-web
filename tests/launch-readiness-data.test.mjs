/**
 * Launch Readiness dataset — structural checks and the headline statuses that must reflect the verified position.
 * Run: node --test tests/launch-readiness-data.test.mjs
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { LAUNCH_READINESS as D } from "../lib/launch-readiness-data.ts";
import { validateDataset, computeReadiness } from "../lib/launch-readiness.ts";

const item = (id) => D.items.find((i) => i.id === id);

test("the dataset is structurally valid and ids are unique", () => {
  assert.deepEqual(validateDataset(D), []);
});

test("Android is live on Google Play; iOS is with Apple and is not claimed approved", () => {
  assert.equal(item("mobile-android").status, "complete");
  assert.match(item("mobile-android").evidence, /LIVE ON GOOGLE PLAY/);
  assert.equal(item("mobile-android-maps").status, "complete");
  assert.equal(item("mobile-google-play-setup").status, "complete");
  const ios = item("mobile-app-store");
  assert.equal(ios.status, "in_progress");
  assert.match(ios.evidence, /Build 148/); assert.match(ios.evidence, /Not approved yet/);
});

test("acceptance, merchant payout and Hub donation are in progress, never claimed complete", () => {
  for (const id of ["real-user-acceptance-testing", "payments-merchant-payout-acceptance", "hubs-donations"]) assert.equal(item(id).status, "in_progress", id);
  assert.match(item("payments-merchant-payout-acceptance").evidence, /Stripe reconciliation still to confirm/);
});

test("the Test Centre tool is complete; referrals are a closed risk; Android push and App Links are post-launch, not blockers", () => {
  assert.equal(item("launch-test-centre").status, "complete");
  assert.equal(item("referrals-disabled").status, "complete");
  for (const id of ["mobile-android-push", "mobile-android-app-links", "security-public-business-view"]) {
    assert.equal(item(id).scope, "post_launch", id); assert.notEqual(item(id).criticality, "launch_blocker", id);
  }
});

test("the only open launch blocker is Apple's review", () => {
  const open = D.items.filter((i) => (i.scope ?? "launch") === "launch" && i.criticality === "launch_blocker" && i.status !== "complete").map((i) => i.id);
  assert.deepEqual(open, ["mobile-app-store"]);
  assert.equal(computeReadiness(D).openBlockers, 1);
});

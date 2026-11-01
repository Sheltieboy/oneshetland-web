/**
 * Hub campaigns and payout readiness (web): the admin screen explains incomplete payout setup and blocks publishing/reopening;
 * a live campaign whose hub lost payout readiness shows "Donations temporarily unavailable" with no Donate action.
 * The database refuses the publish itself (migration 20261201000000); the card and wallet donation routes keep their own checks.
 * No database, no network, no payment. Run: node --test tests/hub-campaign-payout.test.mjs
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { CAMPAIGN_PUBLISH_BLOCKED, DONATIONS_UNAVAILABLE, donationActionAvailable, campaignWriteMessage } from "../lib/campaign-payout-state.ts";
import { hubPayoutHref } from "../lib/hub-payout-notice.ts";

const read = (p) => readFileSync(new URL("../" + p, import.meta.url), "utf8");

describe("copy and decisions", () => {
  test("publish-blocked notice explains the requirement and reassures about existing campaigns", () => {
    assert.match(CAMPAIGN_PUBLISH_BLOCKED.title, /payouts/i);
    assert.match(CAMPAIGN_PUBLISH_BLOCKED.body, /payout account/i);
    assert.match(CAMPAIGN_PUBLISH_BLOCKED.body, /existing campaigns, donations and history are not affected/i);
  });
  test("donor message is exactly 'Donations temporarily unavailable' and says nothing was charged", () => {
    assert.equal(DONATIONS_UNAVAILABLE.title, "Donations temporarily unavailable");
    assert.match(DONATIONS_UNAVAILABLE.body, /Nothing has been charged/);
  });
  test("Donate is withdrawn only on a definite 'not ready'; closed stays closed", () => {
    assert.equal(donationActionAvailable(true, true), true);
    assert.equal(donationActionAvailable(true, false), false);
    assert.equal(donationActionAvailable(true, null), true);
    assert.equal(donationActionAvailable(false, true), false);
  });
  test("the database refusal is translated; other errors pass through; fallback used when empty", () => {
    assert.equal(campaignWriteMessage({ message: "Finish setting up payouts before publishing a campaign.", hint: "hub_payout_not_ready" }, "x"), "Finish setting up payouts before publishing a campaign.");
    assert.equal(campaignWriteMessage({ hint: "hub_payout_not_ready" }, "x"), "Finish setting up payouts before publishing a campaign.");
    assert.equal(campaignWriteMessage({ message: "network down" }, "x"), "network down");
    assert.equal(campaignWriteMessage(null, "fallback"), "fallback");
  });
  test("the payouts link carries a campaigns return target", () => {
    assert.equal(hubPayoutHref("my-hub", "campaigns"), "/hubs/my-hub/manage/payouts?next=campaigns");
    assert.equal(hubPayoutHref("my-hub", "tiers"), "/hubs/my-hub/manage/payouts?next=tiers");
  });
});

describe("campaign admin screen", () => {
  const mgr = read("components/hubs/admin/CampaignsManager.tsx");
  const page = read("app/hubs/[id]/manage/campaigns/page.tsx");
  test("readiness is resolved on the server from hub_payout_ready and passed in", () => {
    assert.match(page, /hubPayoutReady\(hub\.id\)/);
    assert.match(page, /payoutReady=\{payoutReady\}/);
    assert.match(page, /hubPayoutHref\(hub\.slug \|\| hub\.id, "campaigns"\)/);
  });
  test("a new campaign is blocked in the handler and the button, and the explanation links to payouts", () => {
    assert.match(mgr, /if \(!payoutReady\) return setError\(/);
    assert.match(mgr, /disabled=\{busy \|\| !payoutReady\}/);
    assert.match(mgr, /href=\{payoutHref\}/);
  });
  test("REOPEN is blocked while not ready; CLOSE never is", () => {
    assert.match(mgr, /disabled=\{c\.status !== "active" && !payoutReady\}/);
    assert.doesNotMatch(mgr, /c\.status === "active" && !payoutReady/);
  });
  test("failures are translated rather than shown raw", () => {
    assert.equal((mgr.match(/campaignWriteMessage\(/g) ?? []).length, 2);
  });
  test("the client never reads a payout column; it only receives the boolean", () => {
    assert.doesNotMatch(mgr, /stripe_account_id|payout_enabled/);
  });
});

describe("public campaign page", () => {
  const donate = read("components/hubs/CampaignDonate.tsx");
  const page = read("app/hubs/campaign/[id]/page.tsx");
  const server = read("lib/hubs-server.ts");
  test("the page asks campaign_payout_ready (public boolean) and hands it down", () => {
    assert.match(server, /rpc\("campaign_payout_ready", \{ p_campaign: campaignId \}\)/);
    assert.match(server, /if \(error \|\| typeof data !== "boolean"\) return null/);
    assert.match(page, /campaignPayoutReady\(campaign\.id\)/);
    assert.match(page, /payoutReady=\{payoutReady\}/);
  });
  test("Donate and the donate modal (card AND wallet start there) are not rendered when unavailable", () => {
    const guard = donate.indexOf("donationActionAvailable(true, payoutReady)");
    assert.ok(guard > 0);
    assert.ok(guard < donate.indexOf("<button"), "before the Donate button");
    assert.ok(guard < donate.indexOf("<DonateModal"), "before the modal");
    assert.match(donate.slice(guard, guard + 500), /DONATIONS_UNAVAILABLE\.title/);
  });
  test("closed and ended wording is unchanged and takes precedence", () => {
    assert.ok(donate.indexOf("This campaign is closed") < donate.indexOf("donationActionAvailable(true, payoutReady)"));
    assert.match(donate, /This campaign has ended/);
  });
});

describe("hub page campaign card (second Donate entry point)", () => {
  const side = read("components/hubs/HubSidebarActions.tsx");
  const hubPage = read("app/hubs/[id]/page.tsx");
  test("passes the public boolean down and disables Donate on a definite no", () => {
    assert.match(hubPage, /campaignPayoutReady\(campaign\.id\)/);
    assert.match(hubPage, /payoutReady=\{campaignPayout\}/);
    assert.match(side, /disabled=\{!donationActionAvailable\(campaignAcceptsDonations\(campaign\), payoutReady\)\}/);
    assert.match(side, /payoutReady === false \? "Unavailable" : "Donate"/);
    assert.match(side, /DONATIONS_UNAVAILABLE\.title/);
  });
  test("closed / ended labels are unchanged", () => {
    assert.match(side, /campaign\.status === "closed" \? "Closed" : "Ended"/);
  });
});

describe("server-side donation checks are not edited here", () => {
  const modal = read("components/hubs/DonateModal.tsx");
  test("the modal still calls the same server routes for card and wallet", () => {
    assert.match(modal, /create-hub-donation-intent|startHubDonation|hub_donation/);
  });
});

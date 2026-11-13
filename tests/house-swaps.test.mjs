import test from "node:test";
import assert from "node:assert/strict";
import * as hs from "../lib/house-swaps.ts";

const good = { ...hs.EMPTY_ADVERT, have_area_id: "shetland_north", have_bedrooms: 2, have_type: "bungalow", acknowledged: true };

test("disclaimer is the agreed wording", () => {
  assert.match(hs.HOUSE_SWAPS_DISCLAIMER, /only helps tenants find each other/);
  assert.match(hs.HOUSE_SWAPS_DISCLAIMER, /written consent of both landlords/);
});
test("vocabulary matches the database", () => {
  assert.deepEqual(hs.AREA_IDS, ["lerwick_bressay", "shetland_central", "shetland_north", "shetland_south", "shetland_west", "whalsay_skerries", "yell_unst_fetlar"]);
  assert.deepEqual(hs.TYPE_IDS, ["flat", "house", "bungalow", "cottage", "maisonette", "other"]);
  assert.deepEqual(hs.FEATURE_IDS, ["ground_floor", "single_storey", "level_access", "step_free_shower", "wheelchair_accessible", "lift_access", "garden", "parking"]);
  assert.deepEqual(hs.LANDLORDS.map((l) => l.id), ["shetland_islands_council", "hjaltland", "other_social_landlord", "prefer_not_to_say"]);
});
test("browse query parsing ignores junk and round-trips", () => {
  const q = hs.parseBrowseQuery({ area: "shetland_north", beds: "3", type: "flat,zzz,house", feat: ["ground_floor", "bad"], want: "nope", page: "3" });
  assert.deepEqual(q, { area: "shetland_north", place: null, beds: "3", types: ["flat", "house"], features: ["ground_floor"], want: null, page: 3 });
  assert.equal(hs.parseBrowseQuery({ beds: "9", page: "-4" }).beds, null);
  assert.equal(hs.parseBrowseQuery({ page: "-4" }).page, 1);
  assert.equal(hs.browseHref(q), "/house-swaps?area=shetland_north&beds=3&type=flat%2Chouse&feat=ground_floor&page=3");
  assert.equal(hs.browseHref({}), "/house-swaps");
  assert.deepEqual(hs.parseBrowseQuery({ beds: "5+" }).beds, "5+");
});
test("filter chips remove only their own filter", () => {
  const q = hs.parseBrowseQuery({ area: "shetland_north", feat: "garden,parking" });
  const chips = hs.activeFilterChips(q);
  assert.equal(chips.length, 3);
  assert.equal(chips.find((c) => c.label === "Garden").href, "/house-swaps?area=shetland_north&feat=parking");
  assert.equal(hs.activeFilterCount(q), 2);
});
test("contact details are caught", () => {
  for (const t of ["call me on 01595 123456", "me@example.com", "see www.example.org", "http://x.y", "07700900123", "visit my-site.co.uk"]) assert.ok(hs.hasContactDetails(t), t);
  for (const t of ["Two-bed flat, 2nd floor", "Built in 1998, sunny", "", null]) assert.ok(!hs.hasContactDetails(t), String(t));
});
test("advert validation", () => {
  assert.ok(hs.validateAdvert(good).ok);
  const bad = hs.validateAdvert({ ...hs.EMPTY_ADVERT });
  assert.ok(!bad.ok);
  for (const k of ["have_area_id", "have_bedrooms", "have_type", "acknowledged"]) assert.ok(bad.errors[k], k);
  assert.ok(hs.validateAdvert({ ...good, headline: "ring 01595 123456" }).errors.headline);
  assert.ok(hs.validateAdvert({ ...good, want_min_bedrooms: 4, want_max_bedrooms: 2 }).errors.want_bedrooms);
  assert.ok(hs.validateAdvert({ ...good, anywhere: false, want_area_ids: [] }).errors.want_area_ids);
  assert.ok(hs.validateAdvert({ ...good, have_bedrooms: 9 }).errors.have_bedrooms);
  assert.ok(hs.validateAdvert({ ...good, description: "x".repeat(1001) }).errors.description);
  assert.ok(hs.validateAdvert({ ...good, have_bedrooms: 0 }).ok, "studio is fine");
});
test("payload matches the RPC", () => {
  const p = hs.advertPayload({ ...good, anywhere: false, want_area_ids: ["lerwick_bressay"], headline: "  Hi  ", want_notes: "" });
  assert.deepEqual(Object.keys(p).sort(), ["acknowledged", "description", "have_area_id", "have_bedrooms", "have_features", "have_place_id", "have_type", "headline", "landlord_type", "want_area_ids", "want_features", "want_max_bedrooms", "want_min_bedrooms", "want_notes", "want_place_ids", "want_types"]);
  assert.equal(p.headline, "Hi"); assert.equal(p.want_notes, null); assert.equal(p.landlord_type, null);
  assert.deepEqual(hs.advertPayload({ ...good, anywhere: true, want_area_ids: ["lerwick_bressay"] }).want_area_ids, []);
});
test("plain-English wording", () => {
  assert.equal(hs.bedroomsLabel(0), "Bedsit / studio"); assert.equal(hs.bedroomsLabel(1), "1 bedroom"); assert.equal(hs.bedroomsLabel(3), "3 bedrooms");
  assert.equal(hs.wantBedroomsText(null, null), "Any number of bedrooms");
  assert.equal(hs.wantBedroomsText(2, 3), "2 to 3 bedrooms"); assert.equal(hs.wantBedroomsText(3, null), "3 or more bedrooms"); assert.equal(hs.wantBedroomsText(null, 1), "Up to 1 bedroom");
  assert.equal(hs.wantAreasText([]), "Open to anywhere in Shetland");
  assert.equal(hs.wantAreasText(["A", "B", "C"]), "A, B or C");
  assert.equal(hs.displayHeadline({ headline: " ", have_bedrooms: 2, have_type: "flat", have_area_name: "Central Mainland" }), "2-bedroom flat in Central Mainland");
  assert.equal(hs.advertPreview(hs.EMPTY_ADVERT).headline, "Your headline will appear here");
});
test("freshness and expiry", () => {
  const now = new Date("2026-11-12T12:00:00Z");
  assert.equal(hs.freshnessText("2026-11-12T08:00:00Z", now), "Confirmed today");
  assert.equal(hs.freshnessText("2026-11-09T12:00:00Z", now), "Confirmed 3 days ago");
  assert.equal(hs.freshnessText("2026-10-01T12:00:00Z", now), "Confirmed 6 weeks ago");
  assert.equal(hs.daysLeft("2026-11-15T12:00:00Z", now), 3);
});
test("advert state text", () => {
  assert.equal(hs.advertStateText({ status: "active", moderation_state: "pending", is_public: false, moderation_reason: null }).title, "Waiting for review");
  assert.match(hs.advertStateText({ status: "active", moderation_state: "rejected", is_public: false, moderation_reason: "Too vague" }).body, /Too vague/);
  assert.equal(hs.advertStateText({ status: "paused", moderation_state: "approved", is_public: false, moderation_reason: null }).title, "Paused");
  assert.equal(hs.advertStateText({ status: "active", moderation_state: "approved", is_public: true, moderation_reason: null }).title, "Live");
});
test("photos", () => {
  assert.deepEqual(hs.fitWithin(4000, 3000), { width: 1600, height: 1200 });
  assert.deepEqual(hs.fitWithin(800, 600), { width: 800, height: 600 });
  assert.equal(hs.newPhotoPath("u1", "abc"), "u1/abc.jpg");
  assert.equal(hs.photoUrl("u/a.jpg", "http://h/"), "http://h/storage/v1/object/public/house-swap-photos/u/a.jpg");
  assert.equal(hs.MAX_PHOTOS, 6);
});
test("other side of a thread never shows a name", () => {
  const base = { thread_id: "t", listing_id: "l", status: "open", last_message_at: "", last_message: "", unread: 0, about_area_name: "Central Mainland", about_bedrooms: 3, about_type: "house", about_headline: null, their_area_name: "Lerwick & Bressay", their_bedrooms: 2, their_type: "flat" };
  assert.match(hs.otherSide({ ...base, role: "sent" }).sub, /3 bed · House · Central Mainland/);
  assert.match(hs.otherSide({ ...base, role: "received" }).sub, /2 bed · Flat/);
  assert.match(hs.otherSide({ ...base, role: "received", their_bedrooms: null }).sub, /don't have an advert/);
});
test("sign-in redirect only keeps local paths; uuid and message checks", () => {
  assert.equal(hs.signInHref("/house-swaps/my"), "/sign-in?next=%2Fhouse-swaps%2Fmy");
  assert.equal(hs.signInHref("//evil.com"), "/sign-in?next=%2Fhouse-swaps");
  assert.equal(hs.signInHref("https://evil.com"), "/sign-in?next=%2Fhouse-swaps");
  assert.ok(hs.isUuid("e5bfe16a-9637-433e-8883-9066f57adcd6")); assert.ok(!hs.isUuid("x"));
  assert.ok(hs.validateMessage("  ")); assert.equal(hs.validateMessage("hello"), null); assert.ok(hs.validateMessage("x".repeat(1001)));
  assert.equal(hs.parseModerationTab("hidden"), "hidden"); assert.equal(hs.parseModerationTab("zzz"), "pending");
});

test("a moderation reason that already ends in a full stop is not given a second one", () => {
  const rejected = hs.advertStateText({ status: "active", moderation_state: "rejected", is_public: false, moderation_reason: "Please add more detail. " });
  assert.match(rejected.body, /^Reason: Please add more detail\. Change your advert/);
  const hidden = hs.advertStateText({ status: "active", moderation_state: "hidden", is_public: false, moderation_reason: "We are checking it." });
  assert.equal(hidden.body, "We are checking it.");
});

/**
 * Fetch v2 web — requester and driver logic (lib/fetch/flow.ts, present.ts) and the brief's UX scenarios A–J (lib/fetch/scenarios.ts).
 * Pure: the same fixtures the dev preview renders. Run: node --test tests/fetch-member-flow.test.mjs
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { STEPS, createInput, driverActions, newKey, photoProblem, requesterActions, stepProblems } from "../lib/fetch/flow.ts";
import { ISSUE_KINDS, SIZE, TIMING, bankCheckResult, boardWhen, driverStatus, evidenceState, matchLabel, moneyLines, pounds, requesterStatus, timelineFor } from "../lib/fetch/present.ts";
import { QUOTE_PARCEL, QUOTE_SOFA, RUN_SATURDAY, VERIFICATION, scenarios } from "../lib/fetch/scenarios.ts";

const NOW = Date.parse("2026-10-21T12:00:00Z"); // a Wednesday
const RAW = /\b(pending|matched|collected|undeliverable|requires_action|requires_payment_method|authorised|payment_intent|hold_generation|capture)\b/;
const at = (h) => new Date(NOW + h * 3600_000).toISOString();

// ── requester ───────────────────────────────────────────────────────────────────────────────────────────────────────────────
test("create flow: five plain steps, sizes and timing in words (flexibility explained)", () => {
  assert.deepEqual([...STEPS], ["Collection", "Delivery", "The item", "Timing", "Price & review"]);
  for (const s of Object.values(SIZE)) assert.ok(s.label && s.hint && !/_/.test(s.label));
  assert.match(TIMING.flexible.hint, /already going that way/);
  assert.deepEqual(Object.keys(TIMING), ["asap", "by", "flexible"]);
});

test("locations: area and address needed; a non-Shetland postcode is caught before the server is asked", () => {
  assert.equal(stepProblems(0, { pickup: {}, destination: {} }).length, 2);
  assert.match(stepProblems(0, { pickup: { region_id: "r", address: "a", postcode: "AB1 2CD" }, destination: {} })[0], /Shetland postcode/);
  assert.deepEqual(stepProblems(0, { pickup: { region_id: "r", address: "a", postcode: "ze2 9zz" }, destination: {} }), []);
});

test("item: large/bulky need measurements ('so the driver can make sure it will fit'); pharmacy/takeaway need the note confirmed", () => {
  const d = { pickup: {}, destination: {}, category_slug: "furniture", item_description: "Sofa", size_class: "bulky" };
  assert.match(stepProblems(2, d).join(), /so the driver can make sure it will fit/);
  assert.deepEqual(stepProblems(2, { ...d, dims: { l: "180", w: "85", h: "80" } }), []);
  assert.deepEqual(stepProblems(2, { ...d, size_class: "small" }), []);
  assert.match(stepProblems(2, { ...d, size_class: "small", category_slug: "pharmacy" }).join(), /confirm the note/);
});

test("timing: by-a-time 30 min to 7 days, flexible 1 hour to 7 days; a phone number is needed", () => {
  const base = { pickup: {}, destination: {}, contact_phone: "07000 000000" };
  assert.deepEqual(stepProblems(3, { ...base, scheduling_mode: "asap" }, NOW), []);
  assert.equal(stepProblems(3, { ...base, scheduling_mode: "by", needed_by: at(0.25) }, NOW).length, 1);
  assert.deepEqual(stepProblems(3, { ...base, scheduling_mode: "by", needed_by: at(2) }, NOW), []);
  assert.equal(stepProblems(3, { ...base, scheduling_mode: "flexible", flexible_until: at(24 * 8) }, NOW).length, 1);
  assert.equal(stepProblems(3, { pickup: {}, destination: {}, scheduling_mode: "asap" }, NOW).length, 1);
});

test("create input: handling flags from plain choices, no money, only the chosen timing field", () => {
  const c = createInput({ pickup: { region_id: "a", address: " 1 Quay " , postcode: "ze1 0zz" }, destination: { region_id: "b", address: "Cottage" }, category_slug: "furniture",
    item_description: " Sofa ", size_class: "bulky", dims: { l: "180", w: "85", h: "80" }, two_person: true, fragile: true, scheduling_mode: "flexible",
    flexible_until: at(48), needed_by: at(5), contact_phone: "07000 000000" }, "key-123456");
  assert.deepEqual(c.handling_flags, ["heavy_two_person", "fragile"]);
  assert.deepEqual(c.approx_dimensions_cm, { l: 180, w: 85, h: 80 });
  assert.deepEqual(c.pickup, { region_id: "a", address: "1 Quay", postcode: "ZE1 0ZZ" });
  assert.equal(c.needed_by, null); assert.ok(c.flexible_until);
  assert.ok(!Object.keys(c).some((k) => /pence|price|fee|total|hold/.test(k)));
  assert.match(newKey(), /^[A-Za-z0-9_-]{8,80}$/);
  assert.notEqual(newKey(), newKey());
});

test("quote: driver payment, ferry extra, OneShetland fee, expected total — the hold is shown separately, never as the price", () => {
  const sofa = moneyLines(QUOTE_SOFA);
  assert.deepEqual(sofa.lines, [["Driver payment", 2400], ["Ferry journey extra", 600], ["OneShetland fee", 300]]);
  assert.equal(sofa.total, 3300); assert.equal(sofa.hold, 5200);
  assert.equal(sofa.holdNote, "The higher amount is only temporarily reserved in case there is waiting time or the item has to be returned. You are only charged for what actually happens.");
  const noFerry = moneyLines({ ...QUOTE_PARCEL, ferry_supplement_pence: 0, max_authorisation_pence: 900 });
  assert.deepEqual(noFerry.lines.map((l) => l[0]), ["Driver payment", "OneShetland fee"]);
  assert.equal(noFerry.hold, null); assert.equal(noFerry.holdNote, null);
  assert.equal(pounds(3300), "£33.00"); assert.equal(pounds(null), "—");
});

test("£4 / £8 minimums come from the server quote and are shown as the driver payment, not recalculated", () => {
  const small = moneyLines(QUOTE_PARCEL);
  assert.equal(small.lines[0][1], 400); assert.equal(QUOTE_PARCEL.minimum_applied, true);
  const bulkyMin = moneyLines({ ...QUOTE_SOFA, driver_delivery_pence: 800, ferry_supplement_pence: 0, service_fee_pence: 100, expected_total_pence: 900, max_authorisation_pence: 900, minimum_applied: true });
  assert.equal(bulkyMin.lines[0][1], 800); assert.equal(bulkyMin.total, 900);
});

test("requester statuses are human; no state or payment term ever reaches the screen", () => {
  const cases = [["pending", "none", "Looking for someone"], ["matched", "authorised", "Driver found"], ["matched", "processing", "Waiting for payment confirmation"],
    ["matched", "requires_action", "Payment needs your attention"], ["matched", "requires_payment_method", "Payment needs your attention"],
    ["collected", "authorised", "On its way"], ["undeliverable", "authorised", "Needs attention"], ["delivered", "captured", "Delivered"],
    ["returned", "captured", "Returned"], ["cancelled", "none", "Cancelled"], ["expired", "none", "No driver found"]];
  for (const [status, payment_status, label] of cases) {
    const s = requesterStatus({ status, payment_status });
    assert.equal(s.label, label); assert.ok(!RAW.test(`${s.label} ${s.detail}`), `${status}: ${s.detail}`);
  }
  assert.equal(requesterStatus({ status: "matched", payment_status: "authorised", cancel_requested_at: at(0) }).label, "Cancellation asked");
});

test("requester actions: only what applies now", () => {
  const r = (o) => ({ status: "pending", payment_status: "none", closed_at: null, cancel_requested_at: null, driver: null, ...o });
  assert.deepEqual(requesterActions(r({}), NOW), ["cancel", "extend", "photos", "report"]);
  assert.deepEqual(requesterActions(r({ status: "matched", payment_status: "authorised", driver: { first_name: "E" } }), NOW), ["ask_cancel", "ready", "message", "report"]);
  assert.deepEqual(requesterActions(r({ status: "matched", payment_status: "requires_action", driver: {} }), NOW).slice(0, 1), ["pay"]);
  assert.deepEqual(requesterActions(r({ status: "matched", payment_status: "authorised", cancel_requested_at: at(0), driver: {} }), NOW), ["message", "report"]);
  assert.deepEqual(requesterActions(r({ status: "collected", payment_status: "authorised", driver: {} }), NOW), ["message", "report"]);
  // 72-hour problem window; messages stay readable for 30 days; an expired Fetch has neither.
  assert.deepEqual(requesterActions(r({ status: "delivered", closed_at: at(-71), driver: {} }), NOW), ["message", "report"]);
  assert.deepEqual(requesterActions(r({ status: "delivered", closed_at: at(-73), driver: {} }), NOW), ["message"]);
  assert.deepEqual(requesterActions(r({ status: "delivered", closed_at: at(-24 * 31), driver: {} }), NOW), []);
  assert.deepEqual(requesterActions(r({ status: "expired", closed_at: at(-1) }), NOW), []);
});

test("timeline in words; internal events (holds, rotations, messages, photos) are not shown", () => {
  const ev = ["created", "claimed", "hold_rotated", "payment_authorised", "message_sent", "photo_added", "collected", "capture_succeeded", "delivered"]
    .map((event, i) => ({ id: i, event, created_at: at(i), actor_role: "system" }));
  assert.deepEqual(timelineFor("requester", ev).map((e) => e.text), ["Fetch posted", "A driver accepted", "Payment confirmed", "Item collected", "Delivered"]);
  assert.deepEqual(timelineFor("driver", ev).map((e) => e.text), ["Fetch posted", "You accepted this Fetch", "Payment confirmed", "Item collected", "Delivered"]);
});

test("problems: each side sees its own kinds; photos: JPEG/PNG/WEBP up to 10 MB", () => {
  assert.ok(ISSUE_KINDS.some((k) => k.value === "not_delivered" && k.who === "requester"));
  assert.ok(ISSUE_KINDS.some((k) => k.value === "requester_conduct" && k.who === "driver"));
  assert.equal(photoProblem({ type: "image/heic", size: 10 }), "Please choose a JPEG, PNG or WEBP photo.");
  assert.match(photoProblem({ type: "image/jpeg", size: 11 * 1024 * 1024 }), /10 MB/);
  assert.equal(photoProblem({ type: "image/webp", size: 1000 }), null);
});

// ── driver ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────
test("driver statuses and actions follow the job; collect only once payment is confirmed", () => {
  const j = (o) => ({ status: "matched", payment_status: "authorised", closed_at: null, cancel_requested_at: null, ...o });
  assert.deepEqual(driverActions(j({}), NOW), ["arrive", "collect", "release", "photos", "message", "report"]);
  assert.deepEqual(driverActions(j({ payment_status: "requires_action" }), NOW), ["arrive", "refresh_payment", "release", "photos", "message", "report"]);
  assert.deepEqual(driverActions(j({ cancel_requested_at: at(0) }), NOW), ["agree_cancel", "decline_cancel", "release", "photos", "message", "report"]);
  assert.deepEqual(driverActions(j({ status: "collected" }), NOW), ["deliver", "cannot_deliver", "photos", "message", "report"]);
  assert.deepEqual(driverActions(j({ status: "undeliverable" }), NOW), ["deliver", "report_return", "photos", "message", "report"]);
  assert.deepEqual(driverActions(j({ status: "delivered", closed_at: at(-80) }), NOW), ["message"]);
  assert.equal(driverStatus(j({ payment_status: "requires_action" })).label, "Waiting for payment confirmation");
  assert.equal(driverStatus(j({})).label, "Ready for collection");
  assert.ok(!driverActions(j({ status: "collected" }), NOW).includes("release"), "no release after collection");
});

test("verification states in words, including expiring soon and expired", () => {
  assert.equal(evidenceState(null, null).label, "Not supplied");
  assert.equal(evidenceState(null, { item_id: "x" }).label, "Awaiting review");
  assert.equal(evidenceState({ status: "rejected" }, null).label, "Needs replacing");
  assert.equal(evidenceState({ status: "expired" }, null).label, "Expired");
  assert.equal(evidenceState({ status: "verified", expires_on: "2026-11-01" }, null, NOW).tone, "attention");
  assert.equal(evidenceState({ status: "verified", expires_on: "2027-11-01" }, null, NOW).label, "Approved until 2027-11-01");
  assert.equal(VERIFICATION("pending").can_claim, false);
});

test("board: run matches say which journey; when in words", () => {
  const run = RUN_SATURDAY(NOW);
  assert.equal(matchLabel({ match: "your_run", fits_run_id: run.id }, [run]), "Fits your Saturday journey");
  assert.equal(matchLabel({ match: "your_area", fits_run_id: null }, [run]), "In your area");
  assert.equal(matchLabel({ match: "other", fits_run_id: null }, [run]), null);
  assert.match(boardWhen({ scheduling_mode: "flexible", flexible_until: "2026-10-24T12:00:00Z" }), /^Flexible · by Saturday$/);
  assert.equal(boardWhen({ scheduling_mode: "asap" }), "As soon as possible");
});

// ── UX scenarios A–J (the brief, section 47): each produces an understandable screen ───────────────────────────────────────
test("scenarios A–J are all present and every screen's words are human", () => {
  const all = scenarios(NOW);
  assert.deepEqual(all.map((s) => s.key).slice(0, 10), ["a", "b", "c", "d", "e", "f", "g", "h", "i", "j"]);
  const byKey = Object.fromEntries(all.map((s) => [s.key, s]));
  // A: sofa, Lerwick → Yell — ferry, bulky, the hold explained; posted page says it isn't a booking yet + the hint
  const aQuote = moneyLines(byKey.a.screens[0].quote);
  assert.ok(aQuote.lines.some(([k]) => k === "Ferry journey extra") && aQuote.hold > aQuote.total);
  assert.equal(requesterStatus(byKey.a.screens[1].detail.request).label, "Looking for someone");
  assert.match(byKey.a.screens[1].hint.hint, /may be heading that way on Saturday/);
  // B: the journey match is the first card and says the day
  const b = byKey.b.screens[0];
  assert.equal(matchLabel(b.items[0], b.runs).startsWith("Fits your"), true);
  // C: small parcel to Unst — the minimum applies, from the server
  assert.equal(byKey.c.screens[0].quote.minimum_applied, true);
  // D: 3DS — requester is asked to confirm; driver is told not to collect
  assert.equal(requesterActions(byKey.d.screens[0].detail.request, NOW)[0], "pay");
  assert.equal(driverStatus(byKey.d.screens[1].detail.request).label, "Waiting for payment confirmation");
  assert.ok(!driverActions(byKey.d.screens[1].detail.request, NOW).includes("collect"));
  // E: cancellation asked — requester can't ask twice; driver can agree or decline
  assert.ok(!requesterActions(byKey.e.screens[0].detail.request, NOW).includes("ask_cancel"));
  assert.deepEqual(driverActions(byKey.e.screens[1].detail.request, NOW).slice(0, 2), ["agree_cancel", "decline_cancel"]);
  // F: arrived — the arrival is in the driver's timeline as waiting started
  assert.ok(timelineFor("driver", byKey.f.screens[0].timeline).some((e) => /waiting started/.test(e.text)));
  // G: cannot deliver — driver reports the return; requester sees "Needs attention"
  assert.ok(driverActions(byKey.g.screens[0].detail.request, NOW).includes("report_return"));
  assert.equal(requesterStatus(byKey.g.screens[1].detail.request).label, "Needs attention");
  // H: safe place allowed and a delivery photo exists
  assert.equal(byKey.h.screens[0].detail.request.safe_place_allowed, true);
  assert.ok(byKey.h.screens[0].photos.some((p) => p.kind === "delivery"));
  // I: expired verification — the job page names the problem; the document says Expired
  assert.equal(byKey.i.screens[0].driverProblem, "driver_verification_expired");
  assert.ok(byKey.i.screens[1].v.requirements.some((r) => evidenceState(r.current, r.awaiting_review).label === "Expired"));
  // J: already taken — plain words
  assert.equal(byKey.j.screens[0].gone, "Another driver accepted this Fetch just before you.");
  for (const s of all) for (const sc of s.screens) {
    if (sc.detail) {
      const st = sc.detail.viewer === "requester" ? requesterStatus(sc.detail.request) : driverStatus(sc.detail.request);
      assert.ok(st.label !== "—" && !RAW.test(st.label + st.detail), `${s.key}: ${st.label}`);
    }
  }
});

test("after the bank's check the server's state decides — a confirmed hold is never reported as closed or failed", () => {
  // Stripe leaves a successful hold at requires_capture, which the generic helper calls "cancelled"; the server says authorised.
  assert.deepEqual(bankCheckResult("authorised", "cancelled"), { ok: true, text: "Payment authorisation confirmed." });
  assert.equal(bankCheckResult("requires_action", "cancelled").text, "You closed your bank's check. Nothing has been taken — you can try again.");
  assert.equal(bankCheckResult("requires_payment_method", "failed").ok, false);
  assert.equal(bankCheckResult(null, "succeeded").text, "Your bank is still checking. We'll update this page.");
});

test("a blocking driver problem overrides 'Ready for collection': collection is paused, and collect/arrive are not offered", () => {
  const j = { status: "matched", payment_status: "authorised", closed_at: null, cancel_requested_at: null };
  const st = driverStatus(j, "driver_verification_expired");
  assert.equal(st.label, "Collection is paused");
  assert.equal(st.tone, "attention");
  assert.match(st.detail, /payment is confirmed, but you can't collect the item until your driver details are sorted/);
  assert.ok(!/You can collect/.test(st.detail), "never both 'you can collect' and 'you can't collect'");
  assert.deepEqual(driverActions(j, NOW, "driver_verification_expired"), ["release", "photos", "message", "report"]);
  assert.equal(driverStatus(j).label, "Ready for collection", "without a problem nothing changes");
  assert.equal(driverStatus({ ...j, payment_status: "requires_action" }, "driver_suspended").detail, "You can't collect the item until your driver details are sorted.");
  assert.ok(driverActions({ ...j, payment_status: "requires_action" }, NOW, "driver_suspended").includes("refresh_payment"));
  assert.equal(driverStatus({ ...j, cancel_requested_at: at(0) }, "driver_verification_expired").label, "Cancellation asked", "a cancellation still comes first");
  // Scenario I, as the preview and the job page render it.
  const i = scenarios(NOW).find((x) => x.key === "i").screens[0];
  assert.equal(driverStatus(i.detail.request, i.driverProblem).label, "Collection is paused");
});

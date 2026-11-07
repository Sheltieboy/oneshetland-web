/**
 * Organiser cancel flow for TICKETED events + contributor ticket-buyer refusal + adult wording.
 * Run: node --test --import ./tests/support/register.mjs tests/event-cancel-panel.test.mjs
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { summariseBuyers, cancelPanel, afterCancel, sellsOneShetlandTickets } from "../lib/event-cancel-panel.ts";
import { mapError, MSG } from "../lib/event-submissions-client.ts";
import { ticketBuyersMailto, SUPPORT_EMAIL } from "../lib/contributor-copy.ts";
import { validateSubmission, ADULT_CONFIRM_TEXT, ADULT_CONFIRM_ERROR } from "../lib/event-submission-validate.ts";
import { blankRow } from "../lib/event-dates-builder.ts";

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
const order = (status, total, n = 1) => ({ id: Math.random().toString(), status, total_pence: total, tickets_count: n });
const NO_PROMISE = /\b(will be notified|will be told|will be emailed|have been notified|has been notified|have been emailed|have been told|will receive an email|are notified|automatically (refund|email|notif))/i;
const flat = (p) => [p.title, p.summary, ...p.willDo, ...p.willNot, p.refund, p.support].join(" | ");

test("summariseBuyers counts live orders, tickets, money and refunds; anything odd is not known", () => {
  const s = summariseBuyers({ can_refund: true, total_orders: 4, orders: [order("paid", 1500, 2), order("paid", 0, 1), order("refunded", 1000), order("paid", 2500, 3)] });
  assert.deepEqual(s, { known: true, liveOrders: 3, liveTickets: 6, paidOrders: 2, paidPence: 4000, refundedOrders: 1, atLeast: false, canRefund: true });
  assert.equal(summariseBuyers({ orders: [], total_orders: 0 }).liveOrders, 0);
  assert.equal(summariseBuyers({ total_orders: 9, orders: [order("paid", 100)] }).atLeast, true);
  for (const bad of [null, undefined, "x", 5, [], {}, { orders: "no" }]) assert.deepEqual(summariseBuyers(bad), { known: false });
});

test("business panel: states what happens, what does not, the refund path and the support address", () => {
  const p = cancelPanel("business", summariseBuyers({ can_refund: true, total_orders: 2, orders: [order("paid", 1500, 2), order("paid", 1000)] }));
  assert.match(p.summary, /2 orders \(3 tickets\) are still valid, £25\.00 taken in 2 paid orders/);
  assert.ok(p.willDo.some((t) => /marked Cancelled in My tickets/.test(t)));
  assert.ok(p.willDo.some((t) => /Try to email everyone who holds a valid ticket/.test(t)) && p.willDo.some((t) => /can't see afterwards whether each message arrived/.test(t)));
  assert.ok(p.willNot.some((t) => /Refund anyone automatically.*one order at a time on the Ticket orders screen/.test(t)));
  assert.match(p.refund, /Ticket orders/);
  assert.ok(p.support.includes(SUPPORT_EMAIL));
  assert.doesNotMatch(flat(p), NO_PROMISE);
});
test("hub panel says plainly that a hub cancel does NOT message ticket holders, and that only the owner can refund", () => {
  const p = cancelPanel("hub", summariseBuyers({ can_refund: false, total_orders: 1, orders: [order("paid", 800)] }));
  assert.equal(p.willDo.length, 1);
  assert.ok(p.willNot.some((t) => /does not email them or send them a notification, so please tell them yourself/.test(t)));
  assert.ok(p.willNot.some((t) => /Only the hub owner can refund/.test(t)));
  assert.ok(!p.willDo.some((t) => /email|notif/i.test(t)));
  assert.doesNotMatch(flat(p), NO_PROMISE);
});
test("unknown count is said, not guessed; a business that cannot refund is pointed to support; nobody-holds says so and drops the warnings", () => {
  const u = cancelPanel("business", { known: false });
  assert.match(u.summary, /couldn't check how many people have bought tickets/);
  const cant = cancelPanel("business", summariseBuyers({ can_refund: false, total_orders: 1, orders: [order("paid", 500)] }));
  assert.ok(cant.willNot.some((t) => /can't refund orders yourself, so please contact OneShetland/.test(t)));
  const none = cancelPanel("business", summariseBuyers({ can_refund: true, total_orders: 1, orders: [order("refunded", 500)] }));
  assert.equal(none.nobody, true); assert.match(none.summary, /Every order so far has been refunded/); assert.deepEqual(none.willNot, []);
  assert.match(cancelPanel("business", summariseBuyers({ total_orders: 600, orders: [order("paid", 100)] })).summary, /^At least 1 order/);
});
test("after cancelling: same facts; a failed business message is reported, never hidden; hub never claims a message", () => {
  const live = summariseBuyers({ can_refund: true, total_orders: 1, orders: [order("paid", 900)] });
  const b = afterCancel("business", live);
  assert.ok(b.lines.some((l) => /asked for the cancellation to be emailed/.test(l)) && b.lines.some((l) => /No one has been refunded/.test(l)));
  const bad = afterCancel("business", live, "network down");
  assert.ok(bad.lines.some((l) => /couldn't send the cancellation message to ticket holders \(network down\)/.test(l)));
  assert.ok(!bad.lines.some((l) => /asked for the cancellation to be emailed/.test(l)));
  const h = afterCancel("hub", live);
  assert.ok(h.lines.includes("OneShetland has not messaged ticket holders. Please tell them yourself."));
  for (const a of [b, bad, h, afterCancel("business", { known: false }), afterCancel("hub", { known: false })]) assert.doesNotMatch(a.lines.join(" "), NO_PROMISE);
  assert.deepEqual(afterCancel("hub", summariseBuyers({ orders: [], total_orders: 0 })).lines, ["The event is now marked Cancelled."]);
});
test("sellsOneShetlandTickets: external-link and free events do not get the panel", () => {
  assert.equal(sellsOneShetlandTickets({ ticketTypes: [{ is_active: true }], hasTickets: true, externalUrl: null }), true);
  assert.equal(sellsOneShetlandTickets({ ticketTypes: [], hasTickets: true, externalUrl: null }), true);
  assert.equal(sellsOneShetlandTickets({ ticketTypes: [{ is_active: false }], hasTickets: false }), false);
  assert.equal(sellsOneShetlandTickets({ ticketTypes: [], hasTickets: true, externalUrl: "https://x.example" }), false);
  assert.equal(sellsOneShetlandTickets({ ticketTypes: [], hasTickets: false, ticketsSold: 3 }), true);
  assert.equal(sellsOneShetlandTickets({}), false);
});

test("wiring: both screens fetch the count tolerantly, confirm BEFORE the cancel, and leave the cancel itself unchanged", () => {
  const biz = read("components/business/BusinessEventManage.tsx");
  assert.match(biz, /fetchBuyerSummary\(event\.id\)/);
  assert.ok(biz.indexOf("<CancelBefore") < biz.indexOf('setEventStatus(event.id, "cancelled")'));
  assert.match(biz, /onClick=\{cancelEvent\}/);
  const hub = read("components/hubs/admin/EventsManager.tsx");
  assert.match(hub, /fetchBuyerSummary\(id\)/);
  assert.ok(hub.indexOf("<CancelBefore") < hub.lastIndexOf('updateHubEvent(id, { status: "cancelled" })'));
  const cl = read("lib/events-manage-client.ts");
  assert.match(cl, /export async function fetchBuyerSummary[\s\S]*catch \{\s*return \{ known: false \}/);
  assert.match(cl, /const \{ error \} = await sb\.from\("events"\)\.update\(\{ status \}\)\.eq\("id", eventId\)/);   // setEventStatus untouched
  assert.doesNotMatch(read("components/events/CancelTicketedBody.tsx"), /from "next\/link"/);
});

test("contributor: has_ticket_buyers maps to its own kind with the calm message; support mailto uses the real address", () => {
  const e = mapError({ code: "P0001", message: "People have bought tickets for this event through OneShetland, so we need to help you tell them and arrange refunds. Please contact OneShetland.", hint: "has_ticket_buyers" });
  assert.equal(e.kind, "has_ticket_buyers"); assert.equal(e.message, MSG.hasTicketBuyers);
  assert.equal(mapError({ code: "P0001", message: "anything else", hint: "has_ticket_buyers" }).message, MSG.hasTicketBuyers);
  assert.equal(mapError({ code: "P0001", message: "Nothing has changed.", hint: "no_change" }).kind, "validation");
  assert.equal(SUPPORT_EMAIL, "hello@oneshetland.com");
  assert.match(ticketBuyersMailto("Winter Fair"), /^mailto:hello@oneshetland\.com\?subject=Cancelling%20an%20event%20with%20ticket%20buyers%3A%20Winter%20Fair$/);
  const c = read("components/events/contributor/ContributorEvent.tsx");
  assert.match(c, /r\.error\.kind === "has_ticket_buyers"\) setBuyersPanel\(true\)/);
  const t = read("components/events/contributor/TicketBuyersPanel.tsx");
  assert.match(t, /Nothing has been cancelled/); assert.match(t, /heading\.current\?\.focus\(\)/);
});

test("adult confirmation: exact wording everywhere, none of the old wording anywhere", () => {
  assert.equal(ADULT_CONFIRM_TEXT, "I confirm I am 18 or over and am authorised to submit this event.");
  assert.equal(ADULT_CONFIRM_ERROR, "Please confirm you are 18 or over and are authorised to submit this event.");
  const r = validateSubmission({ organiser_name: "", title: "", description: "", venue: "", locality: "", price_text: "", contact_info: "", ticket_url: "", cover_url: null, adult_confirmed: false, rows: [blankRow({ date: "2026-12-05", start: "14:00" })] }, new Date("2026-11-07T10:00:00Z"), "u");
  assert.equal(r.errors.adult_confirmed, ADULT_CONFIRM_ERROR);
  const e = mapError({ code: "P0001", message: ADULT_CONFIRM_ERROR, hint: "adult_confirmed" });
  assert.equal(e.kind, "validation"); assert.equal(e.field, "adult_confirmed"); assert.equal(e.message, ADULT_CONFIRM_ERROR);
  for (const f of ["lib/event-submission-validate.ts", "lib/contributor-copy.ts", "components/events/front-door/SubmissionForm.tsx", "lib/event-submissions-client.ts", "components/events/front-door/FrontDoor.tsx"]) {
    assert.doesNotMatch(read(f), /organiser's permission|permission to submit|Please tick the box to confirm/i, f);
  }
});

test("confirm dialog: Enter never confirms from inside a link or button; the dialog is named and scrolls on short screens", () => {
  const c = read("components/ui/ConfirmProvider.tsx");
  assert.match(c, /e\.key === "Enter" && !\(e\.target instanceof Element && e\.target\.closest\("a, button, input, textarea, select"\)\)/);
  assert.match(c, /aria-label=\{dialog\.title \?\? /);
  assert.match(c, /max-h-\[calc\(100dvh-2rem\)\]/);
});

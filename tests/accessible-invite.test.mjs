/**
 * Accessible Shetland invitation in the Business Suite. Run: node --test tests/accessible-invite.test.mjs
 * It is an invitation, never a requirement; it reads the existing record; it sends nothing; dismissal is remembered once per owner.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { inviteState, isDismissed, cardMode, INVITE_DISMISS_KEY } from "../lib/accessibility-invite.ts";

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
const card = read("components/accessibility/AccessibleInviteCard.tsx");
const page = read("app/business/[id]/manage/page.tsx");
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\{\/\*[\s\S]*?\*\/\}/g, "").replace(/\/\/.*$/gm, "");

test("state: no record = invite, unpublished draft = draft, published = thanks", () => {
  assert.equal(inviteState(null), "invite"); assert.equal(inviteState(undefined), "invite");
  assert.equal(inviteState({ published: false }), "draft"); assert.equal(inviteState({ published: true }), "thanks");
});
test("mode: invite for none and draft until dismissed; thank-you once published, whatever was dismissed", () => {
  assert.equal(cardMode("invite", false), "invite"); assert.equal(cardMode("draft", false), "invite");
  assert.equal(cardMode("invite", true), "none"); assert.equal(cardMode("draft", true), "none");
  assert.equal(cardMode("thanks", false), "thanks"); assert.equal(cardMode("thanks", true), "thanks");
});
test("dismissal is read defensively: only a real timestamp counts", () => {
  assert.equal(isDismissed({ [INVITE_DISMISS_KEY]: "2026-11-06T20:00:00.000Z" }), true);
  for (const bad of [null, undefined, {}, { [INVITE_DISMISS_KEY]: "" }, { [INVITE_DISMISS_KEY]: "nonsense" }, { [INVITE_DISMISS_KEY]: true }, { [INVITE_DISMISS_KEY]: 5 }]) assert.equal(isDismissed(bad), false);
});
test("the message is Darren's, word for word, with 'A favour from me' as the heading", () => {
  for (const t of ["A favour from me", "Since launching OneShetland, I’ve had several folk get in touch about how difficult it can be to find clear accessibility information around Shetland.",
    "I want OneShetland to help everyone enjoy what our islands have to offer, whether they live here or are visiting on holiday.", "That’s why I’ve introduced Accessible Shetland.",
    "I’d love your help. Taking a few minutes to share information about access to your business could make a real difference to someone planning where to visit.",
    "It doesn’t matter if your business can’t offer everything. Honest information is what matters, helping people make their own decisions with confidence.",
    "It’s completely free.", "Thanks so much,", "Darren"]) assert.ok(card.includes(t), t);
  assert.doesNotMatch(card, /\bwee\b/i);
});
test("one clear action, linked straight to the existing editor for THIS business", () => {
  assert.match(card, /Add accessibility information/);
  assert.match(card, /`\/accessible\/edit\/business\/\$\{businessId\}`/);
  assert.equal((card.match(/<Link /g) ?? []).length, 2, "one in the invitation, one in the thank-you");
  assert.match(card, /Update accessibility details/);
});
test("nothing compulsory, no standard implied, no sending: no email, push, notification or campaign code", () => {
  const code = strip(card) + strip(read("lib/accessibility-invite.ts"));
  assert.doesNotMatch(code, /sendEmail|\bresend\b|postmark|notification_log|expo-notifications|\bpush\b|campaign|functions\.invoke|fetch\(/i);
  assert.doesNotMatch(card, /must|required|compliance|standard|rating|score/i);
  assert.match(card, /It doesn’t matter if your business can’t offer everything/);
});
test("dismissal: per owner on their own account (follows them across devices), with a device fallback; the editor stays reachable", () => {
  assert.match(card, /auth\.updateUser\(\{ data: \{ \[INVITE_DISMISS_KEY\]: when \} \}\)/);
  assert.match(card, /localStorage\.setItem\(INVITE_DEVICE_KEY/); assert.match(card, /localStorage\.getItem\(INVITE_DEVICE_KEY/);
  assert.match(card, /Not now/); assert.match(card, /role="status"/);
  assert.match(page, /isDismissed\(userMeta\)/);
  assert.match(page, /UtilityRow label="Accessibility information" href=\{`\/accessible\/edit\/business\/\$\{business\.id\}`\}/);
});
test("placed after the dashboard top and before 'Your business'; multiple-business owners are told which business it is for", () => {
  const i = page.indexOf("<DashboardTop"), j = page.indexOf("<AccessibleInviteCard"), k = page.indexOf('Your business</h2>');
  assert.ok(i > 0 && j > i && k > j, "order: DashboardTop, invitation, Your business");
  assert.match(page, /businessCount=\{mine\.length\}/); assert.match(card, /businessCount > 1/); assert.match(card, /use the tabs above to switch/);
  assert.match(page, /getEditableAccessibility\("business", business\.id\)/);
  assert.doesNotMatch(page, /plan-visit-h|Welcome everyone/, "the earlier plain card is replaced");
});
test("the draft state says so and continues the draft", () => {
  assert.match(card, /state === "draft" &&/); assert.match(card, /Continue accessibility information/); assert.match(card, /isn’t public yet/);
});

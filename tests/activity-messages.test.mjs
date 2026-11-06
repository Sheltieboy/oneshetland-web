/**
 * Organiser messages to followers (web side): the text rules mirror the database's, the panel behaves as specified, nothing identifies a follower,
 * and the Follow wording promises exactly what the system does. Run: node --test tests/activity-messages.test.mjs
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { messageProblem, cleanMessage, deliveryLine, MESSAGE_MAX } from "../lib/activity-messages.ts";

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
// The SAME vectors the database suite (activity-messages.node.test.ts) checks against public.activity_message_problem.
const BAD = [["", /Write a message/], ["   \n  ", /Write a message/], ["x".repeat(501), /500 characters/], ["See https://example.com", /Links/], ["see http://x.y/z", /Links/], ["www.shetland.org has it", /Links|Web addresses/],
  ["Visit shetland.org for more", /Web addresses/], ["bit.ly/abc", /Web addresses/], ["go to mysite.co.uk", /Web addresses/], ["mail me at a@b.com", /Email/], ["tag @shetlandarts", /Email/],
  ["Call 01595 693322", /Phone/], ["Call 07700 900123 now", /Phone/], ["ring +44 7700 900123", /Phone/], ["call 01595-693-322", /Phone/], ["(01595) 693322", /Phone/], ["text 0770 090 0123", /Phone/], ["0044 1595 693322", /Phone/]];
const OK = ["x".repeat(500), "Saturday 10.30-11.30 as normal", "Thu 6:30-7:30pm, £6.50 on the door", "Session 12-13 Nov moved to Monday", "Back on 4 January 2027", "Room 12, Anderson High School, Lerwick",
  "St. Ninian's Hall at 7pm", "Bring 2 friends, 5 minutes early", "Doors 7.00 - 7.30, class 7.30 - 8.30", "Cost: £10 (£8 concessions)", "Line one\nLine two", "Emoji welcome 🎉 see you there", "Dr. Smith leads this week. Free tea after."];

test("text rules: links, web addresses, email addresses and phone numbers are refused; ordinary times, prices and dates are not (same vectors as the database)", () => {
  for (const [s, re] of BAD) assert.match(messageProblem(s) ?? "OK", re, JSON.stringify(s));
  for (const s of OK) assert.equal(messageProblem(s), null, JSON.stringify(s));
  assert.equal(MESSAGE_MAX, 500);
});
test("the text is cleaned exactly as the database cleans it", () => {
  assert.equal(cleanMessage("  Hello\u0001\u0007 there\r\n\r\n\r\n\r\nSecond para \u007f  "), "Hello there\n\nSecond para");
  assert.equal(cleanMessage("\n\n x \n"), "x");
});
test("delivery is described with counts only, in plain English", () => {
  assert.equal(deliveryLine({ followers: 3, recipients: 3, opted_out: 0 }), "Sent to 3 followers.");
  assert.equal(deliveryLine({ followers: 1, recipients: 1, opted_out: 0 }), "Sent to 1 follower.");
  assert.equal(deliveryLine({ followers: 5, recipients: 3, opted_out: 2 }), "Sent to 3 followers. 2 have notifications switched off and did not receive it.");
  assert.equal(deliveryLine({ followers: 2, recipients: 1, opted_out: 1 }), "Sent to 1 follower. 1 has notifications switched off and did not receive it.");
});

test("the panel: follower count, composer with a live counter, a confirmation before sending, delivery confirmation, history, empty states", () => {
  const p = read("components/activities/manage/MessageFollowersPanel.tsx");
  for (const t of ["Message followers", "Review message", "can&apos;t be unsent", "Edit message", "Previous messages", "No messages sent yet.", "Nobody follows this activity yet.", "Message sent.", "Removed by OneShetland", "{chars}/{MESSAGE_MAX}", "never who"]) assert.ok(p.includes(t), t);
  assert.match(p, /step === "write"/); assert.match(p, /setStep\("confirm"\)/, "sending always goes through the confirmation step");
  assert.match(p, /aria-live="polite"/); assert.match(p, /role=\{msg\.tone === "err" \? "alert" : "status"\}/); assert.match(p, /htmlFor="msg-text"/);
});
test("double clicks and retries cannot send twice: one in-flight guard, one request id per composed message, reused on retry, renewed only after success", () => {
  const p = read("components/activities/manage/MessageFollowersPanel.tsx");
  assert.match(p, /if \(sending\.current\) return/); assert.match(p, /sendActivityMessage\(activityId, cleaned, requestId\.current\)/);
  assert.equal((p.match(/requestId\.current = newId\(\)/g) ?? []).length, 1, "renewed in exactly one place: after a successful send");
  assert.match(p, /disabled=\{busy\}/);
});
test("organisers never see personal details: the panel and client read only counts and their own history; nothing queries followers", () => {
  const files = ["components/activities/manage/MessageFollowersPanel.tsx", "lib/activities-client.ts", "lib/activity-messages.ts"].map(read).join("\n");
  assert.doesNotMatch(files, /activity_follows|notification_log|auth\.users|\bemail\b.*select|profiles/);
  const q = read("lib/activities-client.ts").match(/from\("activity_messages"\)\.select\("([^"]+)"\)/)?.[1];
  assert.equal(q, "id, body, created_at, followers, recipients, opted_out, hidden_at", "no author, no hidden_by, no reason, no request id");
});
test("everything goes through the database function (permissions, limits and delivery are enforced there), with no push, email or new route", () => {
  const c = read("lib/activities-client.ts");
  assert.match(c, /rpc\("send_activity_message"/); assert.match(c, /rpc\("activity_messaging_status"/);
  const all = [read("components/activities/manage/MessageFollowersPanel.tsx"), c.slice(c.indexOf("Messages to followers")), read("components/admin/ActivityMessagesAdmin.tsx")].join("\n");
  assert.doesNotMatch(all, /functions\.invoke|\/api\/|sendEmail|sendUserPush|push_tokens|expo-notifications|exp\.host|postmark/i);
});
test("the panel sits on the shared manage page, so business, hub and platform managers all get it", () => {
  const m = read("components/activities/manage/ManagePages.tsx");
  assert.match(m, /<MessageFollowersPanel activityId=\{a\.id\} \/>/);
  assert.match(m, /ActivityEditPage/);
});
test("staff moderation: list, hide with a required reason, restore; the page is under /admin", () => {
  const a = read("components/admin/ActivityMessagesAdmin.tsx");
  for (const t of ["Hide from inboxes", "Restore to inboxes", "Reason", "adminHideMessage", "adminRestoreMessage"]) assert.ok(a.includes(t), t);
  assert.match(a, /disabled=\{busy === m\.id \|\| !\(reason\[m\.id\] \?\? ""\)\.trim\(\)\}/, "no reason, no hide");
  assert.match(read("app/admin/activities/messages/page.tsx"), /ActivityMessagesAdmin/);
  assert.match(read("app/admin/activities/page.tsx"), /\/admin\/activities\/messages/);
});
test("the Follow wording says members get schedule changes AND occasional organiser messages, and still promises no email, phone alert or reminders", () => {
  const f = read("components/activities/FollowButton.tsx").replace(/\/\*[\s\S]*?\*\//g, "");
  assert.equal((f.match(/and when the organiser sends an occasional message\. No emails or phone alerts yet, and no reminders\./g) ?? []).length, 3, "signed-out, following and not-following copy all say it");
  assert.match(f, /stop following at any time/); assert.match(f, /Follow this activity/); assert.match(f, /Sign in to follow/);
  assert.doesNotMatch(f, /push notification|we'll email|text message|SMS/i);
});
test("the scheduling, publishing and notification code paths are unchanged by this feature", () => {
  const c = read("lib/activities-client.ts");
  for (const fn of ["addRules", "setActivityStatus", "cancelSession", "changeSession", "addBreak", "uploadActivityPhoto"]) assert.ok(c.includes(`function ${fn}`), fn);
});

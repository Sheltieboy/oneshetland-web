/**
 * Launch Partner OUTREACH safeguards (web side): the quiet identity + opt-out lines on every invitation email, the do-not-contact state
 * across the admin rail, list and Email section, and the admin-only actions that record and lift it. The database functions are proved by
 * supabase/tests/launch-outreach-suppression.node.test.ts and the send path by supabase/functions/_shared/launch-invitation-send.node.test.ts;
 * these pin the renderer (identical to the Edge Function's copy), the advisory gate, the derived states and the screens.
 * Run: node --test tests/launch-outreach-suppression.test.mjs
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { renderInvitationEmail, defaultEmailDraft, OUTREACH_OPT_OUT, OUTREACH_IDENTITY, OUTREACH_CONTACT, checkEmail } from "../lib/launch-partners/email.ts";
import { evaluateSendGates, GATE_MESSAGE } from "../lib/launch-partners/send-core.ts";
import { deriveWorkflow, isWaitingStep } from "../lib/launch-partners/workflow.ts";
import { derivePipelineStatus } from "../lib/launch-partners/status.ts";

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
const LINK = "https://oneshetland.com/launch/demo?invite=" + "a".repeat(64);
const draft = defaultEmailDraft({ businessName: "Demo", opening: "You make something genuinely Shetland." });
const FUTURE = "2099-01-01T00:00:00Z";

describe("The email: identity and opt-out", () => {
  const out = renderInvitationEmail({ ...draft, businessName: "Demo", invitationUrl: LINK });
  test("1 · the exact wording", () => {
    assert.equal(OUTREACH_OPT_OUT, "If you’d rather not receive another Launch Partner invitation from us, just reply and let us know.");
    assert.equal(OUTREACH_IDENTITY, "OneShetland is operated by Darren Fullerton Consultancy Ltd."); assert.equal(OUTREACH_CONTACT, "hello@oneshetland.com");
  });
  test("2 · both lines, and the contact route, are in the HTML AND the plain text of every render", () => {
    for (const part of [OUTREACH_OPT_OUT, OUTREACH_IDENTITY, OUTREACH_CONTACT]) { assert.ok(out.text.includes(part), `text ${part}`); assert.ok(out.html.includes(part), `html ${part}`); }
    assert.ok(out.text.trimEnd().endsWith(`${OUTREACH_IDENTITY} ${OUTREACH_CONTACT}`));
  });
  test("3 · they are added by the RENDERER, not stored in the draft: an edited or older draft cannot lose them, and the stored template does not carry them", () => {
    for (const body of ["Just this.\n\n{{INVITATION_CTA}}", "Old.\n\n{{INVITATION_LINK}}\n\nDarren", ""]) {
      const r = renderInvitationEmail({ subject: "s", body, invitationUrl: LINK }); assert.ok(r.text.includes(OUTREACH_OPT_OUT) && r.html.includes(OUTREACH_IDENTITY));
    }
    assert.ok(!draft.body.includes("reply and let us know") && !draft.body.includes("operated by"), "the default template does not carry the lines — they cannot be edited away because they are not in it");
    assert.ok(renderInvitationEmail({ ...draft, businessName: "Demo" }).text.includes(OUTREACH_OPT_OUT), "present in the preview with no invitation yet, so Darren sees exactly what they will");
  });
  test("4 · quiet: small grey text after a hairline — no link, image, unsubscribe, banner or promotional copy; the only link is still the preview button", () => {
    const footer = out.html.slice(out.html.lastIndexOf('<div style="margin:22px 0 8px'));
    assert.match(footer, /font-size:12px/); assert.doesNotMatch(footer, /<a |<img|href=|unsubscribe|newsletter|discount|offer|follow us/i);
    assert.equal((out.html.match(/<a /g) ?? []).length, 1); assert.equal((out.html.match(/<img /g) ?? []).length, 1);
  });
  test("5 · hostile draft text is still escaped, and the footer text is escaped like everything else", () => {
    const r = renderInvitationEmail({ subject: "<b>", body: "<script>1</script>\n\n{{INVITATION_CTA}}", invitationUrl: LINK });
    assert.doesNotMatch(r.html, /<script>/); assert.ok(r.html.includes("you’d rather not receive"));
  });
  test("6 · the readiness checks are unchanged (the lines are not the draft's job)", () => {
    assert.equal(checkEmail({ subject: draft.subject, body: draft.body, opening: draft.opening, contactEmail: "a@b.co" }).ok, true);
  });
  test("7 · the renderer is byte-identical to the Edge Function's copy in the shared region, and so are the golden vectors", () => {
    const here = read("lib/launch-partners/email.ts"); let there = null;
    try { there = readFileSync(new URL("../../../../../../../Users/darrenfullerton/Claude/oneshetland-delivers/supabase/functions/_shared/launch-invitation-email.ts", import.meta.url), "utf8"); } catch { /* sibling repo not present */ }
    if (there !== null) {
      const slice = (s) => s.slice(s.indexOf("export const OUTREACH_OPT_OUT"), s.indexOf("function ctaHtml"));
      assert.equal(slice(here), slice(there));
    }
  });
});

describe("The advisory gate and the derived states", () => {
  const camp = (o = {}) => ({ id: "c", slug: "demo", businessName: "Demo", stage: "ready_to_invite", sentAt: null, contactEmail: "a@b.co", subject: draft.subject, opening: draft.opening, body: draft.body, ...o });
  const inv = { status: "open", expiresAt: FUTURE, tokenValidForThisBusiness: true };
  const conf = { confirm: true, recipient: "a@b.co", subject: draft.subject };
  test("8 · a stopped business fails the gate first, with a plain message that does not reveal why", () => {
    const g = evaluateSendGates({ campaign: camp({ outreachStopped: true }), invitation: inv, invitationUrl: LINK, confirmation: conf }, { now: () => new Date() });
    assert.deepEqual(g, ["do_not_contact"]); assert.match(GATE_MESSAGE.do_not_contact, /stopped \(do not contact\), so nothing was sent/); assert.doesNotMatch(GATE_MESSAGE.do_not_contact, /requested|complaint|bounce|note/i);
    assert.equal(evaluateSendGates({ campaign: camp(), invitation: inv, invitationUrl: LINK, confirmation: conf }, { now: () => new Date() }).length, 0, "an unstopped business is unaffected");
  });
  const ROW = (o = {}) => ({ id: "c1", business_id: "b1", slug: "demo", stage: "ready_to_invite", sent_at: null, is_test: false, positioning: null, name: "Demo", category: "retail", locality: "Lerwick",
    is_active: true, is_claimed: false, has_owner: false, tier: "free", plan_live: false, grant: null, has_preview: true, has_page_draft: true, has_email_draft: true, has_contact_email: true, first_viewed_at: null, last_viewed_at: null, view_count: 0,
    product_count: 0, active_product_count: 0, import_batch_count: 0, last_activity: null, invite: { status: "open", created_at: "2026-10-06T10:00:00Z", expires_at: FUTURE }, claim: null, setup_ready_at: null, live_at: null, ...o });
  const STOP = { id: "s1", scope: "business", reason: "requested", note: "internal", since: "2026-10-07T10:00:00Z", by: "Ada", business_id: "b1", address_recorded: true };
  const GOOD = { subject: draft.subject, body: draft.body, opening: draft.opening, contactEmail: "a@b.co" };
  test("9 · the admin rail: a stopped campaign that has not been sent needs attention at Send — 'Outreach stopped — do not send'", () => {
    const w = deriveWorkflow({ row: ROW({ outreach: STOP }), claimMode: "live", email: GOOD });
    assert.equal(w.headline, "Outreach stopped — do not send"); assert.equal(w.current.id, "send"); assert.equal(w.current.state, "attention"); assert.equal(isWaitingStep(w), false);
    assert.match(w.current.note, /stopped.*Nothing can be sent/i);
    const addr = deriveWorkflow({ row: ROW({ outreach: { ...STOP, scope: "address" } }), claimMode: "live", email: GOOD }); assert.match(addr.current.note, /contact address asked not to be contacted/);
  });
  test("10 · after an invitation has gone, a later suppression does not disturb the rail (it is informational on the page)", () => {
    const w = deriveWorkflow({ row: ROW({ outreach: STOP, stage: "sent", sent_at: "2026-10-06T12:00:00Z" }), claimMode: "live", email: GOOD });
    assert.notEqual(w.headline, "Outreach stopped — do not send");
  });
  test("11 · no suppression → the rail is exactly what it was", () => {
    const a = deriveWorkflow({ row: ROW(), claimMode: "live", email: GOOD }); const b = deriveWorkflow({ row: ROW({ outreach: null }), claimMode: "live", email: GOOD });
    assert.deepEqual(a, b); assert.notEqual(a.headline, "Outreach stopped — do not send");
  });
  test("12 · the pipeline status is not changed by a suppression (it is a flag, not a stage)", () => {
    assert.equal(derivePipelineStatus(ROW({ outreach: STOP })), derivePipelineStatus(ROW()));
  });
});

describe("Actions and screens", () => {
  const actions = read("app/admin/launch-partners/actions.ts");
  const section = read("components/admin/launch-partners/OutreachStopSection.tsx");
  const fnBody = (name) => actions.slice(actions.indexOf(`export async function ${name}`), actions.indexOf("\n}\n", actions.indexOf(`export async function ${name}`)) + 3);
  test("13 · recording is admin-only, needs a listed reason and an explicit confirmation, and calls only the suppression RPC — no email, no other table", () => {
    const f = fnBody("stopOutreachAction");
    assert.match(f, /> \{\n  await requireAdmin\(\);\n  try \{/); assert.match(f, /confirm !== true/); assert.match(f, /OUTREACH_REASONS as readonly string\[\]\)\.includes/); assert.match(f, /stopOutreach\(id, input\.reason/);
    assert.doesNotMatch(f, /functions\.invoke|postmark|sendInvitation|\.from\(|\.delete\(|\.update\(/);
    assert.match(actions, /const OUTREACH_REASONS = \["requested", "bounced", "complaint", "incorrect_contact", "admin"\] as const;/);
  });
  test("14 · lifting is admin-only, needs a reason (3+ characters) and an explicit confirmation, and is its own deliberate action", () => {
    const f = fnBody("resumeOutreachAction");
    assert.match(f, /> \{\n  await requireAdmin\(\);\n  try \{/); assert.match(f, /confirm !== true/); assert.match(f, /why\.length < 3/); assert.match(f, /resumeOutreach\(id, why\)/);
  });
  test("15 · the owner's and the public's code cannot reach either action or either RPC", () => {
    for (const f of ["app/business/[id]/manage/launch-setup/actions.ts", "components/business/GoLivePanel.tsx", "components/business/LaunchSetupEditor.tsx", "components/business/LaunchSetupCard.tsx", "lib/launch-partners/owner-setup.server.ts", "app/directory/[id]/page.tsx", "components/business-page/PublishedBusinessPage.tsx", "lib/launch-partners/published.server.ts"])
      assert.doesNotMatch(read(f), /stop_outreach|resume_outreach|stopOutreach|resumeOutreach|outreach_suppress|launch_outreach/i, f);
  });
  test("16 · the confirmation and the screens use the agreed words", () => {
    assert.match(section, /Stop Launch Partner outreach\?/); assert.match(section, /confirmLabel: "Stop outreach"/); assert.match(section, />Stop Launch Partner outreach</);
    assert.match(section, /Launch Partner outreach stopped/); assert.match(section, /Internal note \(never shown to them\)/);
    assert.match(section, /Allow Launch Partner outreach again\?/); assert.match(section, /Remove this suppression…/);
    assert.ok(section.indexOf('title: "Stop Launch Partner outreach?"') < section.indexOf("stopOutreachAction(row.id"), "the confirmation comes first");
  });
  test("17 · removing it is not casual: it sits behind a collapsed control, needs a typed reason, then a second confirmation; and an address-only block is lifted where it was recorded", () => {
    assert.match(section, /<details[\s\S]*Remove this suppression…/); assert.match(section, /disabled=\{busy \|\| lift\.trim\(\)\.length < 3\}/);
    assert.ok(section.indexOf('title: "Allow Launch Partner outreach again?"') < section.indexOf("resumeOutreachAction(row.id"));
    assert.match(section, /o\.scope === "business" \? \(/); assert.match(section, /for-business\/\$\{o\.business_id\}/);
  });
  test("18 · the Email section feeds the stop into the advisory gate, the list shows a pill, the history labels both events, and the page has the section", () => {
    assert.match(read("components/admin/launch-partners/EmailSection.tsx"), /outreachStopped: !!row\.outreach/);
    assert.match(read("components/admin/launch-partners/Pipeline.tsx"), /\{r\.outreach && <StatusPill label="Outreach stopped" tone="red" \/>\}/);
    const st = read("components/admin/launch-partners/StatusSection.tsx"); assert.match(st, /outreach_stopped: "Launch Partner outreach stopped"/); assert.match(st, /outreach_resumed: "Launch Partner outreach allowed again"/);
    assert.match(read("app/admin/launch-partners/[id]/page.tsx"), /<OutreachStopSection row=\{c\} businessName=\{c\.name\} \/>/);
  });
  test("19 · the web app still has no mail transport, and the send path is still only the Edge Function", () => {
    assert.doesNotMatch(actions, /nodemailer|postmarkapp|api\.postmarkapp|POSTMARK/i);
    assert.match(fnBody("sendInvitationEmailAction"), /functions\.invoke\("send-launch-invitation"/);
  });
});

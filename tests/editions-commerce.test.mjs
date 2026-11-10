/** Editions R4 web: money formatting, validators, fee preview parity, CSV safety, admin config, rendered screens, and source guards that keep payments server-priced and local simulation local. */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement as h } from "react";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

await import("./support/register-jsx.mjs");
const C = await import("../lib/editions/commerce.ts");
const cfg = await import("../app/admin/editions/commerce/config.ts");
const { PayoutsPanel } = await import("../components/editions-commerce/PayoutsPanel.tsx");
const { BusinessCommerce } = await import("../components/editions-commerce/BusinessCommerce.tsx");
const { MembersManager } = await import("../components/editions-commerce/MembersManager.tsx");
const { ParticipationManager } = await import("../components/editions-commerce/ParticipationManager.tsx");
const { ApplyPanel } = await import("../components/editions-commerce/ApplyPanel.tsx");
const { ConfirmProvider } = await import("../components/ui/ConfirmProvider.tsx");
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => readFileSync(join(ROOT, p), "utf8");
const walk = (dir) => readdirSync(join(ROOT, dir)).flatMap((n) => { const p = `${dir}/${n}`; return statSync(join(ROOT, p)).isDirectory() ? walk(p) : [p]; });
const wrap = (el) => renderToStaticMarkup(h(ConfirmProvider, null, el));

describe("money", () => {
  test("pounds and toPence are exact and strict", () => {
    assert.equal(C.pounds(12345), "£123.45"); assert.equal(C.pounds(5), "£0.05"); assert.equal(C.pounds(null), "");
    for (const [i, o] of [["10", 1000], ["10.5", 1050], ["£1,250.00", 125000], [" 0.07 ", 7], [0.1, 10]]) assert.equal(C.toPence(i), o, String(i));
    for (const bad of ["", "-1", "1.234", "abc", "1e3", "10,5", "£", null, undefined, NaN, -5, "99999999999"]) assert.equal(C.toPence(bad), null, String(bad));
  });
});

describe("validators", () => {
  test("tier: free needs no price; paid needs at least £1; discount only with percent_off; benefit lines capped", () => {
    assert.equal(C.tierFields({ name: "X", free: true }).ok, false, "name too short");
    assert.equal(C.tierFields({ name: "Friend", free: true }).ok, true);
    assert.equal(C.tierFields({ name: "Friend", monthly: "0.50" }).ok, false);
    assert.equal(C.tierFields({ name: "Friend" }).ok, false, "paid with no price");
    assert.equal(C.tierFields({ name: "Friend", monthly: "abc" }).ok, false);
    assert.equal(C.tierFields({ name: "Friend", monthly: "5", edition_benefit: "percent_off" }).ok, false);
    assert.equal(C.tierFields({ name: "Friend", monthly: "5", edition_benefit: "percent_off", discount: "100" }).ok, false);
    const ok = C.tierFields({ name: " Friend ", monthly: "5", annual: "50.50", edition_benefit: "percent_off", discount: "20", benefits: "A\n\n B \n", join_mode: "open", vat_mode: "inclusive", max_members: "30" });
    assert.deepEqual(ok.value, { name: "Friend", description: null, benefits: ["A", "B"], monthly: 500, annual: 5050, free: false, vat_mode: "inclusive", join_mode: "open", edition_benefit: "percent_off", discount: 20, max_members: 30 });
    assert.equal(C.tierFields({ name: "Friend", monthly: "5", benefits: Array(13).fill("x").join("\n") }).ok, false);
    assert.equal(C.tierFields({ name: "Friend", monthly: "5", max_members: "0" }).ok, false);
  });
  test("terms: fee at least £1, refund date needed for until_date, dates valid", () => {
    assert.equal(C.termsFields({ mode: "fee_required", fee: "0.99" }).ok, false);
    assert.equal(C.termsFields({ mode: "fee_required", fee: "20", refund_policy: "until_date" }).ok, false);
    assert.equal(C.termsFields({ mode: "fee_required", fee: "20", closes: "31/12/2027" }).ok, false);
    assert.deepEqual(C.termsFields({ mode: "fee_required", fee: "20", refund_policy: "until_date", refund_until: "2027-05-01", capacity: "40", closes: "2027-04-01", vat_mode: "exclusive" }).value, { mode: "fee_required", fee: 2000, vat_mode: "exclusive", refund_policy: "until_date", refund_until: "2027-05-01", capacity: 40, closes: "2027-04-01" });
    assert.equal(C.termsFields({ mode: "free", fee: "20" }).value.fee, null, "free ignores a fee");
  });
  test("VAT details: number needed when registered, UK format, legal name length", () => {
    assert.equal(C.vatFields({ registered: true, vat_number: "" }).ok, false);
    assert.equal(C.vatFields({ registered: true, vat_number: "12345" }).ok, false);
    assert.deepEqual(C.vatFields({ registered: true, vat_number: "gb 123 456 789", legal_name: " Org Ltd " }).value, { registered: true, vat_number: "GB123456789", legal_name: "Org Ltd" });
    assert.equal(C.vatFields({ registered: false }).value.vat_number, null);
  });
  test("offline records need a note, an end after the start, and (for paid) an amount and a method", () => {
    assert.equal(C.offlineFields({ kind: "offline", amount: "50", method: "cheque", note: "", end: "2027-01-01" }).ok, false);
    assert.equal(C.offlineFields({ kind: "offline", amount: "50", method: "cheque", note: "Cheque 1", end: "2027-01-01", start: "2027-02-01" }).ok, false);
    assert.equal(C.offlineFields({ kind: "offline", amount: "x", method: "cheque", note: "Cheque 1", end: "2027-01-01" }).ok, false);
    assert.equal(C.offlineFields({ kind: "offline", amount: "50", method: "gold", note: "Cheque 1", end: "2027-01-01" }).ok, false);
    assert.deepEqual(C.offlineFields({ kind: "complimentary", note: "Founder", end: "2027-01-01" }).value, { amount: null, method: null, note: "Founder", start: null, end: "2027-01-01", kind: "complimentary" });
  });
  test("tier price and benefit sentences are plain", () => {
    assert.equal(C.tierPriceText({ is_free: true, price_monthly_pence: null, price_annual_pence: null, vat_mode: "none" }), "Free");
    assert.equal(C.tierPriceText({ is_free: false, price_monthly_pence: 1000, price_annual_pence: 10000, vat_mode: "exclusive" }), "£10.00 a month or £100.00 a year plus VAT");
    assert.equal(C.benefitText({ edition_benefit: "percent_off", discount_percent: 25 }), "25% off participation in this organiser's Editions");
    assert.equal(C.benefitText({ edition_benefit: "none" }), null);
  });
  test("every collection blocker the database can return has plain words; unknown ones still get a safe message", () => {
    for (const k of ["payments_off", "organiser_not_verified", "no_collect_entitlement", "terms_not_accepted", "no_payout_account", "payout_account_incomplete", "collection_suspended", "self_payment"]) { const b = C.blockerText(k); assert.ok(b.title && b.fix && !/_/.test(b.title + b.fix), k); }
    assert.ok(C.blockerText("mystery").title); assert.equal(C.blockerText(null), null);
  });
});

describe("CSV", () => {
  const row = (o) => ({ payment_id: "p", created_at: "2027-03-01T10:00:00Z", kind: "membership", business_name: "Cafe, \"The\"", source: "stripe", status: "succeeded", price_pence: 1000, vat_pence: 0, platform_fee_pence: 50, stripe_fee_pence: null, charge_pence: 1000, net_to_organiser_pence: 950, refunded_pence: 0, method: null, period_start: null, period_end: null, note: null, ref_label: "Full member", ...o });
  test("quotes, escapes, CRLF, pounds with two decimals", () => {
    const csv = C.paymentsCsv([row({})]); const lines = csv.split("\r\n");
    assert.equal(lines.length, 3); assert.match(lines[0], /^Date,Type,Business,/); assert.ok(lines[1].includes('"Cafe, ""The"""')); assert.ok(lines[1].includes(",10.00,0.00,10.00,0.50,9.50,0.00,"));
  });
  test("a cell that could run as a spreadsheet formula is neutralised", () => {
    const csv = C.paymentsCsv([row({ business_name: "=HYPERLINK(\"x\")", note: "+cmd|' /C calc'!A0", ref_label: "@SUM(1)" })]);
    assert.ok(!/(^|,)=/.test(csv.split("\r\n")[1]) && csv.includes("'=HYPERLINK") && csv.includes("'+cmd") && csv.includes("'@SUM"));
  });
});

describe("admin config and the fee calculator", () => {
  test("only known keys; each kind validates like the database", () => {
    assert.equal(cfg.validateConfigValue("nope", "1").ok, false);
    for (const [k, v, ok] of [["editions.commerce.enabled", "true", true], ["editions.commerce.enabled", "yes", false], ["editions.commerce.fee_payer", "business", true], ["editions.commerce.fee_payer", "x", false], ["editions.commerce.participation.fee_percent", "2.5", true], ["editions.commerce.participation.fee_percent", "80", false], ["editions.commerce.participation.fee_fixed_pence", "20", true], ["editions.commerce.participation.fee_fixed_pence", "-1", false], ["editions.commerce.participation.fee_cap_pence", "", true], ["editions.commerce.grace_days", "61", false], ["editions.commerce.max_charge_pence", "12", false], ["editions.commerce.max_charge_pence", "500000", true], ["editions.commerce.vat_rate_percent", "31", false], ["editions.commerce.terms_version", "v 2", false], ["editions.commerce.terms_version", "v2.1", true]]) assert.equal(cfg.validateConfigValue(k, v).ok, ok, `${k}=${v}`);
  });
  test("every key has a default, a label and help; payments default to OFF", () => {
    for (const c of cfg.COMMERCE_KEYS) assert.ok(c.label && c.help && c.def !== undefined, c.key);
    assert.equal(cfg.COMMERCE_KEYS.find((c) => c.key === "editions.commerce.enabled").def, "false");
  });
  test("the preview matches the database examples (see editions-commerce-core and participation suites)", () => {
    const base = { percent: 10, fixed: 0, min: 0, cap: null, payer: "organiser", vatRate: 20 };
    assert.deepEqual(cfg.previewFee(10000, base, "inclusive", true), { price: 10000, vatPence: 1667, fee: 1000, charge: 10000, net: 9000, platformMargin: null, belowCost: false });
    assert.equal(cfg.previewFee(10000, base, "exclusive", true).charge, 12000); assert.equal(cfg.previewFee(10000, base, "exclusive", true).net, 10800);
    assert.equal(cfg.previewFee(10000, base, "exclusive", false).vatPence, 0, "no VAT for an unregistered organiser");
    assert.equal(cfg.previewFee(10000, { ...base, payer: "business" }, "none", false).charge, 11000);
    assert.equal(cfg.previewFee(5000, { ...base, fixed: 20 }, "none", false).fee, 520); assert.equal(cfg.previewFee(100, { ...base, min: 100 }, "none", false).fee, 100); assert.equal(cfg.previewFee(5000, { ...base, cap: 300 }, "none", false).fee, 300); assert.equal(cfg.previewFee(0, base, "none", false).fee, 0);
    assert.equal(cfg.previewFee(2000, base, "none", false, 300).belowCost, true, "a £2 payment with a 10% fee cannot cover a £3 provider cost");
  });
});

const PAYOUT = { organiser_id: "o", details_submitted: false, charges_enabled: false, payouts_enabled: false, requirements_due: [], vat_registered: false, vat_number: null, legal_name: null, collection_suspended: false, suspended_reason: null };
describe("rendered screens", () => {
  test("payouts panel: each prerequisite in order, the next step named, owner-only controls", () => {
    const html = wrap(h(PayoutsPanel, { slug: "o", blocker: "no_payout_account", payout: PAYOUT, termsAccepted: true, termsVersion: "draft-1", isOwner: true, simulated: false }));
    for (const t of ["Connect your payout account", ">Connect with Stripe</button>", "Payment terms accepted", "VAT and legal details"]) assert.ok(html.includes(t), `missing ${t}`);
    assert.ok(!wrap(h(PayoutsPanel, { slug: "o", blocker: "no_payout_account", payout: PAYOUT, termsAccepted: true, termsVersion: "draft-1", isOwner: false, simulated: false })).includes(">Connect with Stripe</button>"));
    assert.ok(wrap(h(PayoutsPanel, { slug: "o", blocker: null, payout: { ...PAYOUT, charges_enabled: true, payouts_enabled: true }, termsAccepted: true, termsVersion: "draft-1", isOwner: true, simulated: false })).includes("You can take payments"));
    assert.ok(wrap(h(PayoutsPanel, { slug: "o", blocker: "no_payout_account", payout: PAYOUT, termsAccepted: false, termsVersion: "draft-1", isOwner: true, simulated: true })).includes("pretend connected account"));
  });
  const M = (o) => ({ membership_id: "m1", business_id: "b1", business_name: "ZZ Cafe", organiser_id: "o1", organiser_name: "Folk Festival", organiser_slug: "folk", tier_name: "Full member", benefits: ["Listed on the members page"], edition_benefit: "free", discount_percent: null, status: "pending_payment", billing_interval: "monthly", source: "application", price_pence: 1000, vat_mode: "none", current_period_end: null, cancel_requested_at: null, message: null, decision_note: null, can_pay: true, pay_blocker: null, live: false, created_at: "2027-01-01T00:00:00Z", ...o });
  test("business view: an invitation is a clear decision with the control guarantees; payment shows the price; overdue is explained", () => {
    let html = wrap(h(BusinessCommerce, { memberships: [M({ status: "invited", message: "Join us!" })], participations: [], payments: [] }));
    assert.ok(html.includes("Yes, join") && html.includes("No thanks") && html.includes("never changes your listing") && html.includes("Join us!") && html.includes("Free participation in this organiser"));
    html = wrap(h(BusinessCommerce, { memberships: [M({})], participations: [], payments: [] })); assert.ok(html.includes("Pay £10.00 and join") && html.includes("£10.00 per month"));
    html = wrap(h(BusinessCommerce, { memberships: [M({ status: "past_due" })], participations: [], payments: [] })); assert.ok(html.includes("did not go through") && html.includes("Pay £10.00 now") && html.includes("Cancel membership"));
    html = wrap(h(BusinessCommerce, { memberships: [M({ can_pay: false, pay_blocker: "self_payment" })], participations: [], payments: [] })); assert.ok(html.includes("You cannot pay your own organiser") && !html.includes("Pay £10.00"));
    html = wrap(h(BusinessCommerce, { memberships: [M({ status: "cancelled" })], participations: [], payments: [] })); assert.ok(html.includes("Earlier (1)") && !html.includes("Pay £10.00"));
  });
  const P = (o) => ({ link_id: "l1", business_id: "b1", business_name: "ZZ Cafe", edition_id: "e1", edition_title: "Wool Week", edition_slug: "wool", organiser_name: "Wool Co", required: true, status: "not_started", base_pence: 2000, discount_pence: 500, price_pence: 1500, charge_pence: 1500, vat_pence: null, basis: "member_discount", refund_policy: "until_date", refund_until: "2027-05-01", tier_name: "Silver", shown: false, can_pay: true, pay_blocker: null, ...o });
  test("participation: the fee, the member discount, the refund promise and the not-shown notice are all visible before paying", () => {
    const html = wrap(h(BusinessCommerce, { memberships: [], participations: [P({})], payments: [] }));
    assert.ok(html.includes("£20.00") && html.includes("member discount £5.00") && html.includes("you pay £15.00") && html.includes("Pay £15.00") && html.includes("Refunded if you withdraw by") && html.includes("Not shown yet") && html.includes("never changed") && html.includes("waiting for you"));
    const free = wrap(h(BusinessCommerce, { memberships: [], participations: [P({ price_pence: 0, charge_pence: 0, discount_pence: 2000 })], payments: [] })); assert.ok(free.includes("Use my membership benefit") && !free.includes("Pay £"));
    const paid = wrap(h(BusinessCommerce, { memberships: [], participations: [P({ status: "paid", shown: true })], payments: [] })); assert.ok(paid.includes("You have paid") && paid.includes("Shown on the Edition") && !paid.includes("Pay £"));
    assert.ok(wrap(h(BusinessCommerce, { memberships: [], participations: [P({ required: false, status: "not_required", shown: true })], payments: [] })).includes("no fee"));
  });
  test("payments history shows the supplier's VAT details when there are any", () => {
    const html = wrap(h(BusinessCommerce, { memberships: [], participations: [], payments: [{ payment_id: "p", created_at: "2027-03-01T00:00:00Z", organiser_name: "Wool Co", kind: "participation", label: "Wool Week", source: "stripe", status: "succeeded", price_pence: 1500, vat_pence: 250, charge_pence: 1500, refunded_pence: 0, vat_mode: "inclusive", vat_number: "GB123456789", legal_name: "Wool Co Ltd", period_end: null }] }));
    assert.ok(html.includes("VAT £2.50") && html.includes("GB123456789") && html.includes("Wool Co Ltd") && html.includes("£15.00"));
  });
  test("members screen: locked without the entitlement; applications and members listed; offline recording only with its entitlement", () => {
    const T = { id: "t1", organiser_id: "o", name: "Full member", description: null, benefits: ["Listed"], price_monthly_pence: 1000, price_annual_pence: 10000, is_free: false, vat_mode: "none", join_mode: "application", edition_benefit: "free", edition_discount_percent: null, max_members: null, active: true, sort: 0, version: 1, archived_at: null };
    const mem = (o) => ({ membership_id: "m", business_id: "b", business_name: "ZZ Cafe", tier_id: "t1", tier_name: "Full member", status: "active", billing_interval: "annual", source: "application", price_pence: 10000, current_period_end: "2028-01-01T00:00:00Z", joined_at: null, past_due_since: null, organiser_note: "Prefers email", message: null, last_payment_at: "2027-01-01T00:00:00Z", last_payment_pence: 10000, live: true, ...o });
    let html = wrap(h(MembersManager, { slug: "o", tiers: [], members: [], renewals: [], canManage: true, hasMemberships: false, hasOffline: false, vatRegistered: false })); assert.ok(html.includes("Memberships are not part of your package yet") && !html.includes("New tier"));
    html = wrap(h(MembersManager, { slug: "o", tiers: [T], members: [mem({}), mem({ membership_id: "m2", business_name: "ZZ Bakery", status: "applied", message: "Hello" })], renewals: [], canManage: true, hasMemberships: true, hasOffline: false, vatRegistered: false }));
    assert.ok(html.includes("New tier") && html.includes("£10.00 a month or £100.00 a year") && html.includes("Applications (1)") && html.includes("Approve") && html.includes("Prefers email") && html.includes("End now") && html.includes("Invite a business") && !html.includes("Record an existing member"));
    html = wrap(h(MembersManager, { slug: "o", tiers: [T], members: [], renewals: [], canManage: true, hasMemberships: true, hasOffline: true, vatRegistered: false })); assert.ok(html.includes("Record an existing member"));
    html = wrap(h(MembersManager, { slug: "o", tiers: [T], members: [mem({})], renewals: [], canManage: false, hasMemberships: true, hasOffline: true, vatRegistered: false })); assert.ok(!html.includes("End now") && !html.includes("Invite a business") && !html.includes("New tier"));
  });
  test("participation manager: terms, fee choice disabled without the package, unpaid partners flagged with waive / record actions", () => {
    const row = (o) => ({ link_id: "l", business_id: "b", business_name: "ZZ Cafe", link_state: "approved", required: true, status: "not_started", basis: null, quoted_charge_pence: null, discount_pence: null, paid_pence: null, shown: false, waiver_note: null, ...o });
    let html = wrap(h(ParticipationManager, { slug: "o", edSlug: "e", terms: null, rows: [], canManage: true, hasFees: false, hasOffline: false })); assert.ok(html.includes("not part of your package yet") && html.includes("Free for businesses"));
    html = wrap(h(ParticipationManager, { slug: "o", edSlug: "e", terms: { mode: "fee_required", fee_pence: 2000, vat_mode: "none", refund_policy: "none", refund_until: null, capacity: null, applications_close: null }, rows: [row({}), row({ link_id: "l2", business_name: "ZZ Bakery", status: "paid", shown: true, paid_pence: 2000 })], canManage: true, hasFees: true, hasOffline: true }));
    assert.ok(html.includes("Not shown until covered") && html.includes("Waive the fee") && html.includes("Record a payment received") && html.includes("Paid") && html.includes("Shown on your Edition"));
  });
  test("public membership page: sign-in link when signed out; no business shows a way to find one; full tiers say so", () => {
    const T = { tier_id: "t", organiser_id: "o", organiser_name: "Folk", name: "Friend", description: "d", benefits: ["A"], price_monthly_pence: 500, price_annual_pence: null, is_free: false, vat_mode: "none", join_mode: "open", edition_benefit: "none", discount_percent: null, full: false };
    assert.match(renderToStaticMarkup(h(ApplyPanel, { tiers: [T], businesses: [], signedIn: false, nextPath: "/organisers/folk/membership" })), /sign-in\?next=%2Forganisers%2Ffolk%2Fmembership/);
    assert.ok(renderToStaticMarkup(h(ApplyPanel, { tiers: [T], businesses: [], signedIn: true, nextPath: "/x" })).includes("Find or add your business"));
    assert.ok(renderToStaticMarkup(h(ApplyPanel, { tiers: [T], businesses: [{ id: "b", name: "ZZ" }], signedIn: true, nextPath: "/x" })).includes("Join and pay"));
    assert.ok(renderToStaticMarkup(h(ApplyPanel, { tiers: [{ ...T, full: true }], businesses: [{ id: "b", name: "ZZ" }], signedIn: true, nextPath: "/x" })).includes("This tier is full"));
  });
});

describe("source guards", () => {
  const files = [...walk("components/editions-commerce"), ...walk("app/organise"), "app/editions/pay-actions.ts", ...walk("app/account/editions"), ...walk("app/admin/editions/commerce"), "lib/editions/commerce.ts", "lib/editions/commerce.server.ts", "lib/editions/payments.server.ts", "components/editions-manage/PayButton.tsx"].filter((f) => /\.(tsx?)$/.test(f));
  test("no service key anywhere in the money code", () => { for (const f of files) assert.ok(!/service[_-]?role|SERVICE_KEY|createAdminClient|service_key/i.test(read(f)), f); });
  test("no action takes an amount to charge from the client: payments start from an id and an idempotency token only", () => {
    const a = read("app/editions/pay-actions.ts");
    assert.match(a, /startPayment\(kind: string, id: string, attempt: string\)/);
    assert.ok(!/amount|price|pence/i.test(a.split("export async function startPayment")[1].split("/** After Stripe")[0].replace(/chargePence|charge_pence/g, "")));
    const o = read("app/organise/commerce-actions.ts");
    assert.match(o, /createPackageOrder\(slug: string, edSlug: string, packageId: string, attempt: string\)/);
  });
  test("simulation only on a loopback database and only when explicitly asked", () => {
    const p = read("lib/editions/payments.server.ts");
    assert.match(p, /EDITIONS_PAYMENTS_MODE === "simulated" && isLoopbackSupabase\(\)/); assert.match(p, /127\.0\.0\.1/);
    assert.match(p, /import "server-only"/);
    for (const f of files) if (f !== "lib/editions/payments.server.ts") assert.ok(!/EDITIONS_PAYMENTS_MODE/.test(read(f)), `${f} must not read the mode directly`);
    const b = read("../oneshetland-be-editions/supabase/migrations/20270102030000_editions_commerce_core.sql");
    for (const m of readdirSync(join(ROOT, "../oneshetland-be-editions/supabase/migrations"))) assert.ok(!/edition_local_simulate/.test(readFileSync(join(ROOT, "../oneshetland-be-editions/supabase/migrations", m), "utf8")), `${m} contains simulator code`);
    assert.ok(b.length > 0);
  });
  test("every organiser action checks a role through ctx(); every admin action starts with requireAdmin()", () => {
    const o = read("app/organise/commerce-actions.ts");
    for (const b of o.split(/^export async function /m).slice(1)) assert.match(b, /ctx\(slug, "(owner|admin|editor)"\)/, b.slice(0, 30));
    const a = read("app/admin/editions/commerce/actions.ts");
    for (const b of a.split(/^export async function /m).slice(1)) assert.match(b, /await requireAdmin\(\)/, b.slice(0, 30));
  });
  test("the CSV route needs sign-in, an admin role and the export entitlement, and answers 404 otherwise", () => {
    const r = read("app/organise/[slug]/payments/export.csv/route.ts");
    assert.match(r, /401/); assert.match(r, /csv_export/); assert.match(r, /role === "owner" \|\| role === "admin"/); assert.match(r, /status: 401|404/);
  });
  test("moderators have no route to suspension: the admin decisions list is admin-only", () => { assert.match(read("app/admin/editions/helpers.ts"), /ADMIN_ONLY_DECISIONS: OrganiserDecision\[\] = \["verify", "reject", "reinstate", "suspend"\]/); });
});


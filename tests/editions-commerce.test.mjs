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
    for (const [k, v, ok] of [["editions.commerce.enabled", "true", true], ["editions.commerce.enabled", "yes", false], ["editions.commerce.fee_payer", "business", false], ["editions.commerce.fee_payer", "organiser", false], ["editions.commerce.participation.fee_percent", "2.5", true], ["editions.commerce.participation.fee_percent", "80", false], ["editions.commerce.participation.fee_fixed_pence", "20", true], ["editions.commerce.participation.fee_fixed_pence", "-1", false], ["editions.commerce.participation.fee_cap_pence", "", true], ["editions.commerce.grace_days", "61", false], ["editions.commerce.max_charge_pence", "12", false], ["editions.commerce.max_charge_pence", "500000", true], ["editions.commerce.vat_rate_percent", "31", false], ["editions.commerce.terms_version", "v 2", false], ["editions.commerce.terms_version", "v2.1", true]]) assert.equal(cfg.validateConfigValue(k, v).ok, ok, `${k}=${v}`);
  });
  test("every key has a default, a label and help; payments default to OFF", () => {
    for (const c of cfg.COMMERCE_KEYS) assert.ok(c.label && c.help && c.def !== undefined, c.key);
    assert.equal(cfg.COMMERCE_KEYS.find((c) => c.key === "editions.commerce.enabled").def, "false");
  });
  test("the preview matches the database examples (see editions-commerce-core and participation suites)", () => {
    const base = { percent: 10, fixed: 0, min: 0, cap: null, stripePercent: 0, stripeFixed: 0, vatRate: 20 };
    assert.deepEqual(cfg.previewFee(10000, base, "inclusive", true), { price: 10000, vatPence: 1667, commission: 1000, recovery: 0, fee: 1000, charge: 10000, net: 9000, variance: null, platformMargin: null, belowCost: false });
    assert.equal(cfg.previewFee(10000, base, "exclusive", true).charge, 12000); assert.equal(cfg.previewFee(10000, base, "exclusive", true).net, 10800);
    assert.equal(cfg.previewFee(10000, base, "exclusive", false).vatPence, 0, "no VAT for an unregistered organiser");
    assert.equal(cfg.previewFee(10000, base, "none", false).charge, 10000, "the customer pays exactly the price: no fee is ever added");
    assert.equal(cfg.previewFee(5000, { ...base, fixed: 20 }, "none", false).fee, 520); assert.equal(cfg.previewFee(100, { ...base, min: 100 }, "none", false).fee, 100); assert.equal(cfg.previewFee(5000, { ...base, cap: 300 }, "none", false).fee, 300); assert.equal(cfg.previewFee(0, base, "none", false).fee, 0);
    assert.equal(cfg.previewFee(2000, { ...base, percent: 2 }, "none", false, 300).belowCost, true, "a 2% commission plus no estimate cannot cover a 3 pound Stripe fee");
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
  test("moderators have no route to suspension: the admin decisions list is admin-only", () => { assert.match(read("app/admin/editions/helpers.ts"), /ADMIN_ONLY_DECISIONS: OrganiserDecision\[\] = \["reinstate", "suspend"\]/); });
});

describe("fee model screens (organiser collects, OneShetland takes a commission, the customer pays exactly the price)", () => {
  const base = { percent: 2, fixed: 0, min: 0, cap: null, stripePercent: 1.5, stripeFixed: 20, vatRate: 20 };
  const keys = cfg.COMMERCE_KEYS.map((c) => c.key);
  test("no fee_payer control exists anywhere in the web source", () => {
    assert.ok(!keys.includes("editions.commerce.fee_payer"));
    for (const f of ["app/admin/editions/commerce/config.ts", "components/admin/EditionsCommerceAdmin.tsx", "components/admin/EditionsFeeReports.tsx", "app/admin/editions/commerce/actions.ts", "lib/editions/commerce.ts", "components/editions-commerce/PaymentsTable.tsx"]) assert.ok(!/fee_payer|feePayer|Who pays the platform fee/.test(read(f)), f);
    assert.equal(cfg.validateConfigValue("editions.commerce.fee_payer", "business").ok, false);
  });
  test("admin config lists the new keys with defaults and SQL-matching validators", () => {
    const want = { "editions.commerce.participation.fee_percent": "2", "editions.commerce.membership.fee_percent": "2", "editions.commerce.participation.stripe_cost_percent": "1.5", "editions.commerce.membership.stripe_cost_percent": "1.5", "editions.commerce.participation.stripe_cost_fixed_pence": "20", "editions.commerce.membership.stripe_cost_fixed_pence": "20", "editions.commerce.stripe_cost_confirmed": "false", "editions.commerce.variance_alert_pence": "20", "editions.commerce.fee_tolerance_pence": "1", "editions.commerce.refund_commission_on_dispute": "false", "platform.vat_registered": "false" };
    for (const [k, d] of Object.entries(want)) assert.equal(cfg.COMMERCE_KEYS.find((c) => c.key === k)?.def, d, k);
    const V = cfg.validateConfigValue;
    assert.equal(V("editions.commerce.participation.stripe_cost_percent", "10").ok, true); assert.equal(V("editions.commerce.participation.stripe_cost_percent", "10.5").ok, false); assert.equal(V("editions.commerce.membership.stripe_cost_percent", "11").ok, false);
    assert.equal(V("editions.commerce.membership.stripe_cost_fixed_pence", "999").ok, true); assert.equal(V("editions.commerce.membership.stripe_cost_fixed_pence", "1000").ok, false);
    assert.equal(V("editions.commerce.variance_alert_pence", "99999").ok, true); assert.equal(V("editions.commerce.variance_alert_pence", "100000").ok, false);
    assert.equal(V("editions.commerce.fee_tolerance_pence", "50").ok, true); assert.equal(V("editions.commerce.fee_tolerance_pence", "51").ok, false);
    assert.equal(V("editions.commerce.stripe_cost_confirmed", "true").ok, true); assert.equal(V("editions.commerce.stripe_cost_confirmed", "maybe").ok, false);
    assert.equal(V("editions.commerce.refund_commission_on_dispute", "true").ok, true);
    assert.equal(V("platform.vat_registered", "true").ok, false, "VAT registration is information only on this screen");
  });
  test("estimate labels say ESTIMATED, placeholder, reconciled; never 'actual Stripe cost'", () => {
    const est = cfg.COMMERCE_KEYS.filter((c) => /stripe_cost_(percent|fixed_pence)$/.test(c.key));
    assert.equal(est.length, 4);
    for (const c of est) { assert.match(c.label, /estimated/i); assert.match(c.help, /ESTIMATED card processing fee recovered from the organiser; placeholder values until confirmed against Stripe's actual pricing/); }
    assert.match(cfg.COMMERCE_KEYS.find((c) => c.key === "editions.commerce.stripe_cost_confirmed").help, /do not switch payments on|must not be enabled/i);
    assert.match(cfg.COMMERCE_KEYS.find((c) => c.key === "editions.commerce.refund_commission_on_dispute").help, /commercial decision/);
    assert.match(cfg.COMMERCE_KEYS.find((c) => c.key === "platform.vat_registered").help, /charges no VAT/);
    for (const c of cfg.COMMERCE_KEYS) assert.ok(!/actual (stripe )?cost/i.test(c.label + c.help), c.key);
  });
  test("the preview matches the approved model and never adds to the customer's total", () => {
    const r = cfg.previewFee(2500, base, "none", false); // commission 50, estimate 38 + 20 = 58 (37.5 rounds half up to 38)
    assert.deepEqual([r.commission, r.recovery, r.fee, r.charge, r.net], [50, 58, 108, 2500, 2392]);
    for (const price of [100, 333, 1000, 2500, 9999, 10000, 50000]) { const q = cfg.previewFee(price, base, "none", false); assert.equal(q.charge, price); assert.ok(q.fee <= q.charge); assert.equal(q.net, q.charge - q.fee); }
    assert.equal(cfg.previewFee(1000, base, "none", false, 170).variance, 35 - 170); assert.equal(cfg.previewFee(1000, base, "none", false, undefined, true).recovery, 0, "recovery waived only by the explicit flag");
    assert.equal(cfg.previewFee(1000, { ...base, percent: 0 }, "none", false).recovery, 35, "a waived or zero commission still recovers processing cost");
    assert.equal(cfg.previewFee(10, base, "none", false).fee, 10, "F never exceeds the charge: recovery is reduced first");
  });
  const row = (o) => ({ payment_id: "p", created_at: "2027-03-01T10:00:00Z", kind: "participation", business_name: "ZZ Cafe", source: "stripe", status: "succeeded", price_pence: 2500, vat_pence: 0, platform_fee_pence: 108, stripe_fee_pence: null, charge_pence: 2500, net_to_organiser_pence: 2392, refunded_pence: 0, method: null, period_start: null, period_end: null, note: null, ref_label: "Spring", commission_pence: 50, processing_fee_estimate_pence: 58, commission_refunded_pence: 0, dispute_recovered_pence: 0, ...o });
  test("organiser payment rows show price, commission, ESTIMATED fee and net separately; refunds show what comes back and what is kept", async () => {
    const { PaymentsTable } = await import("../components/editions-commerce/PaymentsTable.tsx");
    const rates = { participation: 2, membership: 2 };
    let html = renderToStaticMarkup(h(PaymentsTable, { slug: "s", rows: [row({})], statement: [], canRefund: false, csvAllowed: true, rates }));
    for (const t of ["Customer paid", "£25.00", "OneShetland commission", "£0.50", "Estimated card processing fee", "£0.58", "Net before refunds", "Net to you after refunds", "£23.92"]) assert.ok(html.includes(t), t);
    assert.ok(html.includes("Customers pay the price you set; nothing is added at checkout. OneShetland&#x27;s 2% commission and an estimated card processing fee are deducted from each payment. The processing fee is estimated and reconciled to Stripe&#x27;s actual charge.") || html.includes("OneShetland's 2% commission"));
    assert.ok(!/stripe fee|actual (stripe )?(fee|cost)|Stripe's actual fee/i.test(html.replace(/reconciled to Stripe(&#x27;|')s actual charge/, "")), "Stripe's own fee is never shown to an organiser");
    html = renderToStaticMarkup(h(PaymentsTable, { slug: "s", rows: [row({ status: "refunded", refunded_pence: 2500, commission_refunded_pence: 50, net_to_organiser_pence: 2392 })], statement: [], canRefund: false, csvAllowed: false, rates }));
    assert.ok(html.includes("Commission returned to you") && html.includes("Processing cost kept") && html.includes("£0.58"));
    html = renderToStaticMarkup(h(PaymentsTable, { slug: "s", rows: [], statement: [], canRefund: false, csvAllowed: false, rates: { participation: 2.5, membership: 1 } }));
    assert.ok(html.includes("2.5% commission on participation payments and 1% on memberships"), "the rate comes from the live value");
  });
  test("the explanation uses the live rate and no component hard-codes a commission percentage", () => {
    assert.match(C.feeExplanation({ participation: 2, membership: 2 }), /2% commission/); assert.match(C.feeExplanation({ participation: 3, membership: 3 }), /3% commission/); assert.match(C.feeExplanation({ participation: null, membership: null }), /OneShetland's commission and an estimated/);
    for (const f of ["components/editions-commerce/PaymentsTable.tsx", "components/editions-commerce/ParticipationManager.tsx", "components/editions-commerce/MembersManager.tsx", "components/editions-commerce/BusinessCommerce.tsx", "components/editions-commerce/BuyFlow.tsx", "components/admin/EditionsFeeReports.tsx", "components/admin/EditionsCommerceAdmin.tsx"]) assert.ok(!/\b[0-9]+(\.[0-9]+)?\s?% (commission|platform|fee)/i.test(read(f)), f);
    assert.ok(!/5% (platform )?fee|platform fee of 5/i.test(read("app/admin/editions/commerce/config.ts")));
  });
  test("CSV keeps the existing columns and appends commission and estimated fee; never an actual Stripe fee", () => {
    const csv = C.paymentsCsv([row({ stripe_fee_pence: 77 })]); const [head, line] = csv.split("\r\n");
    assert.ok(head.startsWith("Date,Type,Business,For,Source,Method,Status,Price,VAT,Charged,Platform fee,Net to organiser,Refunded,Note"));
    assert.ok(head.endsWith("Commission,Estimated card processing fee,Commission returned on refund,Processing cost retained on refund"));
    assert.ok(line.endsWith(",0.50,0.58,0.00,0.00")); assert.ok(!line.includes("0.77"));
    assert.ok(!/actual/i.test(head));
  });
  test("customer checkout and join screens show exactly the price and nothing added", async () => {
    const src = ["components/editions-commerce/BusinessCommerce.tsx", "components/editions-commerce/BuyFlow.tsx", "components/editions-manage/PayButton.tsx"].map(read).join("\n");
    assert.ok(!/platform_fee|commission|processing fee|service fee|booking fee|recovery_estimate|stripe_fee/i.test(src), "no fee wording or fee fields on customer screens");
    assert.match(src, /Pay \$\{pounds\(m\.price_pence\)\} and join/); assert.match(src, /Pay \$\{pounds\(p\.charge_pence\)\}/);
  });
  test("admin fee reports: new columns, variance and disputes with a reasoned retry, notes, own-box scrolling", () => {
    const c = read("components/admin/EditionsFeeReports.tsx"), a = read("app/admin/editions/commerce/actions.ts"), pg = read("app/admin/editions/commerce/reports/page.tsx");
    for (const t of ["Commission earned", "Est. processing fee recovered", "Stripe actual fees", "Variance", "Dispute losses recovered", "Organiser net", "Retained processing costs", "By month", "By organiser", "Payments over the alert threshold", "Disputes", "Retry recovery"]) assert.ok(c.includes(t), t);
    assert.match(a, /admin_retry_edition_dispute_recovery/); assert.match(a, /p_dispute: dispute, p_note/); assert.match(a, /p_recovery_waived/);
    for (const rpc of ["admin_edition_fee_statement", "admin_edition_variance_report", "admin_edition_variance_items", "admin_edition_fee_model_notes"]) assert.ok(pg.includes(rpc), rpc);
    assert.ok(pg.includes("edition_dispute_recoveries")); assert.match(c, /const box = "overflow-x-auto/); assert.ok((c.match(/className=\{box\}/g) ?? []).length >= 3);
    assert.match(c, /Connect account and payout overheads are absorbed by OneShetland/); assert.match(c, /placeholders/);
  });
  test("reporting ranges", async () => {
    const { rangeDays, RANGES } = await import("../app/admin/editions/commerce/reports/range.ts");
    assert.equal(rangeDays(undefined), 90); assert.equal(rangeDays("30"), 30); assert.equal(rangeDays("x"), 90); assert.equal(RANGES.length, 3);
  });
  test("the admin screen has the processing-estimate panel, the confirm warning and the processing-fee waiver control", () => {
    const c = read("components/admin/EditionsCommerceAdmin.tsx");
    assert.match(c, /Card processing estimate and monitoring/); assert.match(c, /Do not switch payments on yet/); assert.match(c, /recoveryWaived/); assert.match(c, /Customer pays/);
  });

  test("net after refunds, monthly retained cost and received total", async () => {
    const { PaymentsTable } = await import("../components/editions-commerce/PaymentsTable.tsx");
    const full = row({ status: "refunded", refunded_pence: 2500, commission_refunded_pence: 50 });
    const b = C.paymentBreakdown(full); assert.equal(b.netAfter, 2392 - 2500 + 50); assert.equal(b.retained, 58);
    assert.equal(C.paymentBreakdown(row({})).netAfter, 2392);
    const part = row({ created_at: "2027-03-09T10:00:00Z", status: "partially_refunded", refunded_pence: 1000, commission_refunded_pence: 20 });
    assert.equal(C.monthlyRetained([full, part, row({ status: "failed", refunded_pence: 2500 })])["2027-03"], 58 + 23);
    const st = [{ month: "2027-03", payments: 2, gross_pence: 5000, platform_fee_pence: 216, net_to_organiser_pence: 4784, offline_pence: 0, refunded_pence: 3500, commission_pence: 100, processing_fee_estimate_pence: 116, net_after_refunds_pence: 1334 }];
    const html = renderToStaticMarkup(h(PaymentsTable, { slug: "s", rows: [full, part], statement: st, canRefund: false, csvAllowed: false, rates: { participation: 2, membership: 2 } }));
    for (const t of ["Net before refunds", "Processing cost retained on refunds", "What you received (after refunds)", "£13.34", "£0.81"]) assert.ok(html.includes(t), t);
  });
  test("explainer shows fixed, minimum and cap components instead of implying a pure percentage", () => {
    assert.equal(C.rateText({ percent: 2, fixed_pence: 10 }), "2% plus £0.10");
    assert.equal(C.rateText({ percent: 2, min_pence: 20, cap_pence: 100 }), "2% (at least £0.20, at most £1.00)");
    assert.equal(C.rateText({ percent: 2, fixed_pence: 0, min_pence: 0, cap_pence: null }), "2%");
    assert.match(C.feeExplanation({ participation: { percent: 2, fixed_pence: 10 }, membership: { percent: 2, fixed_pence: 10 } }), /2% plus £0\.10 commission and an estimated/);
    assert.match(C.feeExplanation({ participation: { percent: 2 }, membership: { percent: 3, cap_pence: 50 } }), /2% commission on participation payments and 3% \(at most £0\.50\) on memberships/);
  });
  test("getCommissionRates prefers edition_commission_rates() and only falls back to the sample", () => {
    const src = read("lib/editions/commerce.server.ts"); const i = src.indexOf("getCommissionRates");
    const body = src.slice(i, src.indexOf("getParticipationRows", i));
    assert.ok(body.indexOf('rpc("edition_commission_rates")') < body.indexOf('"edition_charge_breakdown"')); assert.match(body, /rpc\.error/);
  });
});

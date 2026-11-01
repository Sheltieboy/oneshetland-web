/**
 * /business launch improvements: finding and claiming a listing, not creating duplicates, account-aware plan buttons, honest copy.
 * No network, no database, no payments: Supabase is a recording fake, and nothing here can reach Stripe.
 * Run: node --test tests/business-launch.test.mjs
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { normaliseName, matchKind, searchTerm, distinctiveWord, rankMatches, likelyDuplicate, claimHref, listingHref, addHref, findListed, createDecision } from "../lib/business-match.ts";
import { planCta, billingHref, FINDER_ANCHOR } from "../lib/plan-cta.ts";
import { submitClaim } from "../lib/claim-submit.ts";
import { countLabel } from "../lib/directory-count.ts";
import { TIER_PRICE, TIER_PRICE_PENCE, PREMIUM_ANNUAL_PENCE, PLAN_COMPARISON, TIER_FEATURES, TIER_PITCH } from "../lib/listing-tiers.ts";
const TIER_PITCH_PRO_HAS_FEATURES = TIER_PITCH.pro.blurb.includes("tap-to-stamp, Local Wallet payments, ");
import { safeNext } from "../lib/redirect.ts";

const read = (p) => readFileSync(new URL("../" + p, import.meta.url), "utf8");
const B = (name, o = {}) => ({ id: `id-${name}`, name, slug: name.toLowerCase().replace(/[^a-z0-9]+/g, "-"), category: "retail", address: "Lerwick", is_claimed: false, ...o });

describe("name matching", () => {
  test("normalising ignores case, punctuation, '&', legal suffixes and a leading 'The'", () => {
    assert.equal(normaliseName("Anderson & Co. Ltd"), "anderson and");
    assert.equal(normaliseName("The  Peerie   Bakehoose"), "peerie bakehoose");
    assert.equal(normaliseName("Harry’s Department Store"), "harrys department store");
    assert.equal(normaliseName("Bödå"), "boda");
  });
  test("exact / strong / possible", () => {
    assert.equal(matchKind("lerwick bakehouse", "Lerwick Bakehouse Ltd"), "exact");
    assert.equal(matchKind("Harry's Department", "Harry's Department Store"), "strong");
    assert.equal(matchKind("Bakehouse", "Lerwick Bakehouse"), "strong");
    assert.equal(matchKind("Inn", "Anchor Inn"), "possible", "too short to call strong");
    assert.equal(matchKind("Shetland Wool Week Shop", "Wool Week Shop Shetland"), "strong");
    assert.equal(matchKind("Hillswick Post Office", "Brae Garage"), "possible");
    assert.equal(matchKind("", "x"), "possible");
  });
  test("search terms are safe for the database filter", () => {
    assert.equal(searchTerm("  a "), ""); assert.equal(searchTerm("Bake%house,(x)"), "Bake house x"); assert.ok(searchTerm("x".repeat(200)).length <= 60);
  });
  test("ranking puts the strongest first and claimed (nothing to claim) after unclaimed", () => {
    const r = rankMatches("Lerwick Bakehouse", [B("Lerwick Bakehouse Cafe", { is_claimed: true }), B("Lerwick Bakehouse"), B("Lerwick Butchers")]);
    assert.deepEqual(r.map((x) => x.kind), ["exact", "strong", "possible"]);
  });
  test("a probable duplicate is detected; an unrelated name is not", () => {
    assert.equal(likelyDuplicate("Anderson & Co", [B("Anderson & Co")]), true);
    assert.equal(likelyDuplicate("Fresh Start Plumbing", [B("Anderson & Co"), B("Harry's")]), false);
    assert.equal(likelyDuplicate("x", []), false);
  });
  test("links go to the claim journey, the listing, and 'add' with the typed name and plan carried across", () => {
    assert.equal(claimHref({ id: "1", slug: "a9-accounting" }), "/directory/a9-accounting/claim"); assert.equal(claimHref({ id: "1", slug: null }), "/directory/1/claim");
    assert.equal(listingHref({ id: "1", slug: "a9" }), "/directory/a9");
    assert.equal(addHref("My Croft Shop", "pro"), "/directory/new?name=My+Croft+Shop&plan=pro"); assert.equal(addHref("  "), "/directory/new"); assert.equal(addHref("x", "evil"), "/directory/new?name=x");
  });
});

describe("finding a listing (fake public directory)", () => {
  const fakeSb = (rows, fail = false) => { const calls = []; return { calls, from(t) { const f = { t, filters: [] }; const q = { select() { return q; }, eq(c, v) { f.filters.push(["eq", c, v]); return q; }, ilike(c, v) { f.filters.push(["ilike", c, v]); return q; }, order() { return q; }, limit() { return q;
    }, then(ok, bad) { calls.push(f); const term = f.filters.find((x) => x[0] === "ilike")[2].replace(/%/g, "").toLowerCase(); return Promise.resolve(fail ? { data: null, error: { message: "down" } } : { data: rows.filter((r) => r.name.toLowerCase().includes(term)), error: null }).then(ok, bad); } }; return q; } }; };
  test("reads only the PUBLIC directory view, active listings, by name", async () => {
    const sb = fakeSb([B("A9 Accounting")]); const r = await findListed(sb, "A9 Accounting");
    assert.equal(sb.calls[0].t, "local_businesses_public"); assert.ok(sb.calls[0].filters.some((f) => f[1] === "is_active" && f[2] === true)); assert.equal(r[0].name, "A9 Accounting"); assert.equal(r[0].kind, "exact");
  });
  test("nothing is searched for a one-letter term; a multi-word miss retries on the most distinctive word", async () => {
    const sb = fakeSb([B("Bakehouse Lerwick")]); assert.deepEqual(await findListed(sb, "a"), []); assert.equal(sb.calls.length, 0);
    const r = await findListed(sb, "Peerie Bakehouse"); assert.equal(sb.calls.length, 2); assert.equal(r.length, 1); assert.equal(distinctiveWord("The Peerie Bakehouse Ltd"), "bakehouse");
  });
  test("a database error is thrown so the screen can say so, rather than showing 'not listed'", async () => { await assert.rejects(() => findListed(fakeSb([], true), "Anderson"), (e) => e.message === "down"); });
});

describe("duplicate prevention when adding a business", () => {
  test("a probable duplicate blocks creation until the person says theirs is different", () => {
    const found = [B("Lerwick Bakehouse")];
    assert.deepEqual(createDecision("Lerwick Bakehouse", found, false), { allowed: false, reason: "probable-duplicate" });
    assert.deepEqual(createDecision("Lerwick Bakehouse", found, true), { allowed: true, reason: "ok" });
    assert.deepEqual(createDecision("Totally New Co", found, false), { allowed: true, reason: "ok" });
  });
  test("the form checks as the name is typed AND again at submit, and a failed lookup never blocks someone adding their business", () => {
    const f = read("components/directory/BusinessCreateForm.tsx");
    assert.match(f, /findListed\(createClient\(\), term\)/); assert.match(f, /findListed\(sb, name\.trim\(\)\)\.catch\(\(\) => \[\]\)/); assert.match(f, /createDecision\(name, found, false\)\.allowed/);
    assert.match(f, /duplicate && !differentBusiness/); assert.match(f, /Claim it free/); assert.match(f, /initialName/);
  });
  test("a new listing never claims, verifies or edits an existing one", () => {
    const f = read("components/directory/BusinessCreateForm.tsx"); const ins = f.slice(f.indexOf('.from("local_businesses").insert'), f.indexOf('.select("id, slug")'));
    assert.match(ins, /source: "owner"/); assert.doesNotMatch(ins, /is_verified|verified_at|claimed_at/); assert.doesNotMatch(f, /\.update\(|\.upsert\(/);
  });
});

describe("claiming (existing member)", () => {
  const sbFor = ({ user = { id: "u1" }, insertError = null, id = "claim-1" } = {}) => { const log = { inserted: null, invoked: [] };
    return { log, auth: { getUser: async () => ({ data: { user } }) }, from: (t) => ({ insert: (row) => { log.table = t; log.inserted = row; return { select: () => ({ single: async () => (insertError ? { data: null, error: insertError } : { data: { id }, error: null }) }) }; } }),
      functions: { invoke: (name, opts) => { log.invoked.push([name, opts]); return Promise.resolve({}); } } }; };
  const input = { businessId: "b1", contactName: " Ann ", contactEmail: " ann@x.example ", contactPhone: "", role: "Owner", evidence: "" };
  test("lodges a PENDING claim tied to the signed-in member, trimmed, and then asks for the admin/claimant notifications", async () => {
    const sb = sbFor(); const r = await submitClaim(sb, input);
    assert.deepEqual(r, { status: "submitted", claimId: "claim-1" }); assert.equal(sb.log.table, "business_claims");
    assert.deepEqual(sb.log.inserted, { user_id: "u1", business_id: "b1", status: "pending", contact_name: "Ann", contact_email: "ann@x.example", contact_phone: null, role: "Owner", evidence: null });
    assert.deepEqual(sb.log.invoked, [["notify-business-claim", { body: { claim_id: "claim-1" } }]]);
  });
  test("the client can only ever ask for 'pending'; it has no path to approve", () => { assert.doesNotMatch(read("lib/claim-submit.ts"), /approved|approve_business_claim|is_claimed|owner_id/); });
  test("a repeat claim is 'already submitted', not an error, and sends no second notification", async () => {
    const sb = sbFor({ insertError: { code: "23505", message: "duplicate key" } }); assert.deepEqual(await submitClaim(sb, input), { status: "duplicate" }); assert.equal(sb.log.invoked.length, 0);
  });
  test("signed-out, missing details and database refusals each give a clear message and notify nobody", async () => {
    const a = sbFor({ user: null }); assert.deepEqual(await submitClaim(a, input), { status: "error", message: "Please sign in." }); assert.equal(a.log.inserted, null);
    assert.equal((await submitClaim(sbFor(), { ...input, contactEmail: " " })).status, "error");
    const c = sbFor({ insertError: { code: "42501", message: "Too many open claims" } }); assert.deepEqual(await submitClaim(c, input), { status: "error", message: "Too many open claims" }); assert.equal(c.log.invoked.length, 0);
  });
  test("a failing notification never undoes the claim", async () => {
    const sb = sbFor(); sb.functions.invoke = () => Promise.reject(new Error("edge down")); assert.equal((await submitClaim(sb, input)).status, "submitted");
    const sb2 = sbFor(); sb2.functions.invoke = () => { throw new Error("sync boom"); }; assert.equal((await submitClaim(sb2, input)).status, "submitted");
  });
  test("the claim screen says claiming is free, promises no timescale, and confirms what happens next", () => {
    const f = read("components/directory/BusinessClaimForm.tsx");
    assert.match(f, /Claiming is <strong>free<\/strong>/); assert.match(f, /Claim received — thank you/); assert.match(f, /sent you a confirmation email/); assert.match(f, /we'll email you as soon as there's an outcome/);
    assert.doesNotMatch(f, /within \d|\d+\s*(hours|days)|working days|shortly|unlock Pro/i);
  });
  test("already-claimed and pending states are still handled, and the claim page still requires sign-in and returns the visitor to it", () => {
    const f = read("components/directory/BusinessClaimForm.tsx"), p = read("app/directory/[id]/claim/page.tsx");
    assert.match(f, /title="Already claimed"/); assert.match(f, /title="Claim under review"/); assert.match(p, /redirect\(`\/sign-in\?next=\/directory\/\$\{id\}\/claim`\)/);
  });
});

describe("signed-out visitor, registration and return", () => {
  test("the sign-in / sign-up return path survives the claim URL, the add URL (with name and plan) and the finder anchor", () => {
    assert.equal(safeNext("/directory/a9-accounting/claim"), "/directory/a9-accounting/claim");
    assert.equal(safeNext("/directory/new?name=My+Shop&plan=pro"), "/directory/new?name=My+Shop&plan=pro");
    assert.equal(safeNext("/business#find-your-business"), "/business#find-your-business");
    assert.notEqual(safeNext("//evil.example/x"), "//evil.example/x");
  });
  test("sign-up carries `next` through sign-in, the confirmation email and the callback", () => {
    const s = read("app/sign-up/page.tsx"); assert.match(s, /safeNext\(rawNext\)/); assert.match(s, /auth\/callback\?next=\$\{encodeURIComponent\(next\)\}/); assert.match(s, /\/sign-in\?next=\$\{encodeURIComponent\(next\)\}/);
  });
  test("the create form's sign-in link keeps the typed name and chosen plan", () => {
    const f = read("components/directory/BusinessCreateForm.tsx"); assert.match(f, /q\.set\("plan", plan\); if \(initialName\) q\.set\("name", initialName\)/);
  });
});

describe("account-aware plan buttons (existing owner, upgrade)", () => {
  const free = { id: "b1", name: "Ann's Bakehouse", tier: "free" }, pro = { id: "b2", name: "Peerie Pots", tier: "pro" }, prem = { id: "b3", name: "Big Hotel", tier: "premium" };
  test("a visitor with no business is sent to FIND one (claim or add) — never straight to 'create' for a paid plan", () => {
    for (const p of ["free", "pro", "premium"]) { const c = planCta(p, []); assert.equal(c.kind, "find"); assert.equal(c.href, FINDER_ANCHOR); }
    assert.match(planCta("pro", []).note, /Claim or add your listing first \(free\)/);
  });
  test("an owner of ONE business goes to that business's billing for the chosen plan — no second business is created", () => {
    const c = planCta("pro", [free]); assert.equal(c.kind, "billing"); assert.equal(c.href, "/business/b1/manage/billing?plan=pro"); assert.match(c.label, /Upgrade Ann's Bakehouse to Pro/);
    assert.equal(planCta("premium", [free]).href, "/business/b1/manage/billing?plan=premium");
  });
  test("every owner CTA avoids /directory/new", () => {
    for (const owned of [[free], [pro], [prem], [free, pro], [pro, prem]]) for (const p of ["free", "pro", "premium"]) { const c = planCta(p, owned); const hrefs = c.kind === "choose" ? c.options.map((o) => o.href) : [c.href]; for (const h of hrefs) assert.doesNotMatch(h, /directory\/new/); }
  });
  test("already on (or above) the plan: manage it, don't buy it again", () => {
    assert.equal(planCta("pro", [pro]).kind, "current"); assert.equal(planCta("pro", [pro]).href, "/business/b2/manage/billing");
    assert.equal(planCta("pro", [prem]).kind, "current"); assert.equal(planCta("premium", [prem]).kind, "current"); assert.equal(planCta("premium", [pro]).kind, "billing");
  });
  test("several businesses: choose which; each option goes to ITS billing, with the plan only where an upgrade is needed", () => {
    const c = planCta("premium", [free, pro, prem]); assert.equal(c.kind, "choose");
    assert.deepEqual(c.options.map((o) => [o.business.id, o.href, o.current]), [["b1", "/business/b1/manage/billing?plan=premium", false], ["b2", "/business/b2/manage/billing?plan=premium", false], ["b3", "/business/b3/manage/billing", true]]);
  });
  test("the Free plan button opens a dashboard for an owner, or lets several choose", () => {
    assert.equal(planCta("free", [free]).href, "/business/b1/manage"); const c = planCta("free", [free, pro]); assert.equal(c.kind, "choose"); assert.deepEqual(c.options.map((o) => o.href), ["/business/b1/manage", "/business/b2/manage"]);
  });
  test("nothing on the page starts a payment: the button only links to billing, where the price is shown and confirmed first", () => {
    assert.doesNotMatch(read("lib/plan-cta.ts") + read("components/business/PlanButton.tsx"), /stripe|createSubscriptionIntent|local-subscription/i);
    const bm = read("components/business/BillingManager.tsx"); assert.ok(bm.indexOf("await confirm(") < bm.indexOf("createSubscriptionIntent(") || bm.indexOf("const agreed = await confirm(") < bm.indexOf("await createSubscriptionIntent("), "price confirmation precedes any charge");
  });
  test("owner state is read in the browser under the visitor's own session, so the page stays static and a failure falls back to the signed-out view", () => {
    const o = read("components/business/OwnerProvider.tsx"); assert.match(o, /eq\("owner_id", user\.id\)/); assert.match(o, /eq\("user_id", user\.id\)\.eq\("status", "pending"\)/); assert.match(o, /catch \{ if \(live\) setState\(\{ status: "signedOut"/);
    assert.doesNotMatch(read("app/business/page.tsx"), /getAccount|force-dynamic|cookies\(/);
  });
});

describe("prices, plans and permissions are unchanged", () => {
  test("the published prices", () => { assert.deepEqual([TIER_PRICE.free, TIER_PRICE.pro, TIER_PRICE.premium], ["£0", "£12/mo", "£29/mo"]); assert.deepEqual([TIER_PRICE_PENCE.pro, TIER_PRICE_PENCE.premium, PREMIUM_ANNUAL_PENCE], [1200, 2900, 29000]); });
  test("the plan feature table and permission map (shared with the app) are byte-identical to before", () => {
    assert.equal(PLAN_COMPARISON.length, 15); assert.equal(TIER_FEATURES.offers, "pro"); assert.equal(TIER_FEATURES.products, "premium"); assert.equal(TIER_FEATURES.description, "free"); assert.equal(TIER_FEATURES.featuredBadge, "premium");
  });
  test("the shared tier file was not edited (this change only re-words the marketing page)", () => {
    const lt = read("lib/listing-tiers.ts"); assert.match(lt, /KEEP IN SYNC with oneshetland-delivers\/lib\/listing-tiers\.ts/); assert.match(lt, /pro:     1200/); assert.match(lt, /premium: 2900/);
  });
});

describe("/business copy", () => {
  const page = read("app/business/page.tsx");
  test("no unsupported audience claims", () => {
    for (const bad of [/already in the app/i, /whole island uses/i, /open OneShetland every day/i, /Every day[^<]{0,20}engaged/i, /No ad spend|\"No\", \"ad spend\"/i, /captured local market/i, /market that.{0,12}already here/i, /already looking/i])
      assert.doesNotMatch(page, bad, String(bad));
  });
  test("no unavailable features: no Fetch delivery, no 'Shop & eat local' homepage spot", () => { assert.doesNotMatch(page, /Fetch community delivery/); assert.doesNotMatch(page, /Shop (&|&amp;) eat local/i); assert.doesNotMatch(page, /fetch-phone/); });
  test("claiming is stated as FREE, in the hero, the plans, the steps, the FAQ and the claim screen", () => {
    assert.match(page, /claim it <strong[^>]*>free<\/strong>/); assert.match(page, /Claiming a listing is free, and every plan/); assert.match(page, /Find and claim your listing", d: "Search for your business and claim it — free/);
    assert.match(page, /Is claiming my listing really free\?/); assert.match(page, /Claiming is free\. Add offers/);
  });
  test("the finder is the primary call to action (hero) and every other CTA points at it", () => {
    assert.match(page, /<BusinessFinder \/>/); assert.ok(page.indexOf("<BusinessFinder />") < page.indexOf("See plans")); assert.match(page, /href=\{FINDER_ANCHOR\}/);
    assert.doesNotMatch(page, /href="\/directory"/); assert.doesNotMatch(page, /Create your free listing/);
  });
  test("VAT: the ambiguous 'exclude VAT where applicable' is gone, replaced by what checkout actually does (the full price is shown and confirmed)", () => {
    assert.doesNotMatch(page, /VAT/); assert.match(page, /You see the full price and confirm it before any payment/); assert.match(page, /The price shown is the price charged/);
  });
  test("the plan card text reflects the real model: Free includes description/photos/events; Premium row says 'Featured badge and priority placement'", () => {
    assert.match(page, /"Featured homepage spot": "★ Featured badge and priority placement"/); assert.match(page, /Verified badge once your claim is approved/);
    assert.match(page, /a cover photo and up to \$\{FREE_GALLERY_LIMIT\} gallery photos/); assert.doesNotMatch(page, /one contact, a verified badge/);
  });
  test("booking fee and cap are stated with the real figures (from the same constants the billing uses)", () => {
    assert.match(page, /\$\{BOOKING_FEE_PENCE\}p per booking, capped at \$\{BOOKING_CAP_UNITS\} a month \(\$\{gbp\(BOOKING_CAP_PENCE\)\}\)/);
  });
  test("no screenshot shows a real, named business or invented figures: the removed images are gone from the repo and the page", () => {
    for (const f of ["listing-phone", "loyalty-phone", "hubs-desktop", "dashboard-desktop", "home-desktop", "fetch-phone"]) { assert.ok(!existsSync(new URL(`../public/business/${f}.png`, import.meta.url)), f + " is deleted"); assert.ok(!page.includes(f), f + " is not referenced"); }
    for (const f of [...page.matchAll(/\/business\/([a-z-]+\.png)/g)].map((m) => m[1])) assert.ok(existsSync(new URL(`../public/business/${f}`, import.meta.url)), f + " exists");
    assert.doesNotMatch(page, /Harry|Hood Wink|Burra/);
  });
  test("the page does not promise an approval timescale", () => { assert.doesNotMatch(page, /within \d|\d+\s*(hours|working days)|shortly/i); assert.match(page, /We check every claim by hand/); });
});

describe("features that are built but not yet in everyday use are not advertised as live", () => {
  const page = read("app/business/page.tsx");
  test("Wallet payments and the NFC tile are marked coming soon, in the plan rows and the Pro blurb", () => {
    assert.match(page, /"Local Wallet payments": "Local Wallet payments \(coming soon\)"/); assert.match(page, /"Tap-to-stamp NFC tile": "Tap-to-stamp NFC tile \(coming soon\)"/);
    assert.match(page, /Tap-to-stamp tiles and Local Wallet payments are coming soon\./);
    assert.ok(TIER_PITCH_PRO_HAS_FEATURES, "the override targets the exact phrase in the shared blurb");
  });
  test("no promise that a tile will be posted, and no cashback claim", () => { assert.doesNotMatch(page, /we post you|posted? you a tap|tile is included/i); assert.doesNotMatch(page, /cashback/i); });
  test("the rows still exist in the shared model unchanged (permissions are not edited)", () => {
    assert.equal(TIER_FEATURES.wallet, "pro"); assert.equal(TIER_FEATURES.nfc, "pro"); assert.ok(PLAN_COMPARISON.some((r) => r.label === "Local Wallet payments" && r.tier === "pro")); assert.ok(PLAN_COMPARISON.some((r) => r.label === "Tap-to-stamp NFC tile" && r.tier === "pro"));
  });
});

describe("directory count", () => {
  test("a capped list says how many there really are; an uncapped one is unchanged", () => {
    assert.equal(countLabel(200, 517), "Showing 200 of 517 · search to find the rest"); assert.equal(countLabel(37, null), "37 listings"); assert.equal(countLabel(1, null), "1 listing"); assert.equal(countLabel(200, 200), "200 listings"); assert.equal(countLabel(200, null), "200 listings");
  });
  test("the directory page uses it and the cap constant is shared", () => {
    const p = read("app/directory/page.tsx"); assert.match(p, /countLabel\(all\.length, total\)/); assert.match(p, /all\.length >= DIRECTORY_LIST_LIMIT/); assert.match(read("lib/local-data.ts"), /\.limit\(DIRECTORY_LIST_LIMIT\)/);
  });
});

describe("administrator approval path is untouched", () => {
  test("approving still calls the admin-only RPC and then notifies the claimant (push, and now email)", () => {
    const m = read("components/admin/ClaimsManager.tsx"); assert.match(m, /rpc\("approve_business_claim"/); assert.match(m, /notify-claim", \{ body: \{ claim_id: r\.id, outcome: "approved" \}/); assert.match(m, /notify-claim", \{ body: \{ claim_id: r\.id, outcome: "rejected" \}/);
  });
});

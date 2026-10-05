/**
 * Launch-partner management — pipeline status, invitation email, draft/validation rules, Business Page V2 section rules.
 * Run: node --test tests/launch-partners.test.mjs
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { derivePipelineStatus, nextAction, countByStatus, pipelineCells, STATUS_ORDER } from "../lib/launch-partners/status.ts";
import { composeInvitationEmail, checkEmail, renderPreview, LINK_PLACEHOLDER } from "../lib/launch-partners/email.ts";
import { parsePreviewConfig, parsePageDraft, isSafeUrl } from "../lib/launch-partners/validate.ts";
import { buildPageDraft } from "../lib/launch-partners/draft.ts";
import { planSections, availability, heroActions, chooseHeroVisual, enforceLive, MAX_HERO_ACTIONS } from "../lib/business-page/sections.ts";
import { PREPARED_COPY } from "../lib/business-page/prepared-copy.ts";
import { buildBusinessPageModel } from "../lib/business-page/model.ts";
import { getPreviewConfig, previewSlugs } from "../lib/launch-preview/registry.ts";
import { CATALOGUE_OPTIONS } from "../lib/launch-preview/catalogue.ts";

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

const row = (o = {}) => ({
  id: "c1", business_id: "b1", slug: "demo-shop", stage: "candidate", is_test: false, positioning: null, name: "Demo", category: "retail", locality: "Lerwick",
  is_active: true, is_claimed: false, has_owner: false, tier: "free", plan_live: false, grant: null,
  invite: { status: "none", created_at: null, expires_at: null }, claim: null, product_count: 0, active_product_count: 0, import_batch_count: 0,
  sent_at: null, first_viewed_at: null, last_viewed_at: null, view_count: 0, setup_ready_at: null, live_at: null,
  has_preview: false, has_page_draft: false, has_email_draft: false, has_contact_email: false, last_activity: null, ...o,
});

describe("pipeline status is derived from real facts", () => {
  test("the editorial stages map straight through", () => {
    assert.equal(derivePipelineStatus(row()), "candidate");
    assert.equal(derivePipelineStatus(row({ stage: "preparing" })), "preparing");
    assert.equal(derivePipelineStatus(row({ stage: "ready_to_invite" })), "ready_to_invite");
    assert.equal(derivePipelineStatus(row({ stage: "sent", sent_at: "2026-10-06" })), "sent");
    assert.equal(derivePipelineStatus(row({ stage: "archived" })), "archived");
  });
  test("viewed needs a view and an invitation that has not been revoked", () => {
    assert.equal(derivePipelineStatus(row({ stage: "sent", first_viewed_at: "2026-10-07", invite: { status: "open" } })), "viewed");
    assert.equal(derivePipelineStatus(row({ stage: "sent", sent_at: "x", first_viewed_at: "2026-10-07", invite: { status: "revoked" } })), "sent");
  });
  test("a claim is derived from business_claims, not from anything Darren typed", () => {
    assert.equal(derivePipelineStatus(row({ stage: "sent", claim: { status: "pending", created_at: "x" } })), "claim_submitted");
    // rejected: back to wherever they were
    assert.equal(derivePipelineStatus(row({ stage: "sent", first_viewed_at: "x", claim: { status: "rejected", created_at: "x" } })), "viewed");
  });
  test("claimed → setting up → ready to go live → live", () => {
    const claimed = { claim: { status: "approved", created_at: "x" }, has_owner: true, stage: "sent" };
    assert.equal(derivePipelineStatus(row(claimed)), "claimed");
    assert.equal(derivePipelineStatus(row({ ...claimed, grant: { tier: "premium", expires_at: "x" } })), "setting_up");
    assert.equal(derivePipelineStatus(row({ ...claimed, product_count: 3 })), "setting_up");
    assert.equal(derivePipelineStatus(row({ ...claimed, setup_ready_at: "x" })), "ready_to_go_live");
    assert.equal(derivePipelineStatus(row({ ...claimed, setup_ready_at: "x", live_at: "y" })), "live");
  });
  test("an approved claim without an owner is NOT treated as claimed", () => {
    assert.equal(derivePipelineStatus(row({ stage: "sent", claim: { status: "approved", created_at: "x" }, has_owner: false })), "sent");
  });
  test("nothing can reach 'live' or 'ready to go live' without the explicit reserved timestamps", () => {
    for (const stage of ["candidate", "preparing", "ready_to_invite", "sent"]) assert.ok(!["live", "ready_to_go_live"].includes(derivePipelineStatus(row({ stage }))));
  });
  test("every status has a next action and the counts add up", () => {
    const rows = STATUS_ORDER.map((s, i) => row({ id: String(i), stage: s === "preparing" ? "preparing" : "candidate" }));
    for (const r of rows) assert.ok(nextAction(r).length > 3);
    assert.equal(Object.values(countByStatus(rows)).reduce((a, b) => a + b, 0), rows.length);
  });
  test("next action walks the preparation: preview, then page, then invitation, then the email", () => {
    assert.match(nextAction(row({ stage: "preparing" })), /launch preview/i);
    assert.match(nextAction(row({ stage: "preparing", has_preview: true })), /business page/i);
    assert.match(nextAction(row({ stage: "preparing", has_preview: true, has_page_draft: true })), /mark it ready/i);
    assert.match(nextAction(row({ stage: "ready_to_invite", has_preview: true })), /private invitation/i);
    assert.match(nextAction(row({ stage: "ready_to_invite", invite: { status: "open" } })), /contact and write the email/i);
    assert.match(nextAction(row({ stage: "ready_to_invite", invite: { status: "open" }, has_contact_email: true, has_email_draft: true })), /yourself/i);
  });
  test("the glance cells show the right facts", () => {
    const c = pipelineCells(row({ has_preview: true, invite: { status: "open" }, first_viewed_at: "x", view_count: 3, grant: { tier: "premium", expires_at: "x" }, product_count: 4, active_product_count: 0, import_batch_count: 1 }));
    assert.equal(c.preview.label, "✓"); assert.equal(c.viewed.label, "✓ ×3"); assert.equal(c.plan.label, "premium (launch)"); assert.equal(c.products.label, "4 (0 live)");
  });
});

describe("the invitation email is prepared, never sent", () => {
  const e = composeInvitationEmail({ businessName: "Shetland Jewellery", contactName: "Alex Smith" });
  test("it is a personal note with one link placeholder and the promised reassurances", () => {
    assert.equal(e.subject, "I've made a private OneShetland preview for Shetland Jewellery");
    assert.ok(e.body.startsWith("Hi Alex,"));
    assert.equal(e.body.split(LINK_PLACEHOLDER).length, 2, "exactly one call to action");
    for (const s of ["private", "Nothing is live", "complimentary Premium", "claim your business if you want to", "Nothing goes live until you review it and approve it yourself"]) assert.ok(e.body.includes(s), s);
  });
  test("the preview shows how the link will appear, and never a real token", () => {
    const p = renderPreview(e);
    assert.ok(!p.body.includes(LINK_PLACEHOLDER)); assert.match(p.body, /created when you're ready to send/);
  });
  test("a draft with a real invitation link or hash is refused", () => {
    const bad = { ...e, body: e.body.replace(LINK_PLACEHOLDER, "https://www.oneshetland.com/launch/x?invite=" + "a".repeat(64)), contactEmail: "a@b.co" };
    assert.equal(checkEmail(bad).ok, false); assert.match(checkEmail(bad).problems.join(" "), /real invitation link/);
    assert.equal(checkEmail({ ...e, contactEmail: "a@b.co" }).ok, true);
    assert.equal(checkEmail({ ...e, contactEmail: "nope" }).ok, false);
  });
  test("no code path in the web app can send the email", () => {
    for (const f of ["lib/launch-partners/email.ts", "lib/launch-partners/campaigns.server.ts", "components/admin/LaunchPartnerEditor.tsx"]) {
      let t; try { t = read(f); } catch { continue; }
      assert.doesNotMatch(t, /sendEmail|send-email|resend|nodemailer|sendgrid|smtp|fetch\(.*\/api\/.*send|invoke\(['"]send/i, f);
    }
  });
});

describe("validation of what an administrator saves", () => {
  test("unsafe addresses are refused everywhere they could appear", () => {
    for (const u of ["javascript:alert(1)", "data:text/html,x", "http://example.com/a.jpg", "//evil.example/a.jpg", "/\\evil"]) assert.equal(isSafeUrl(u), false, u);
    for (const u of ["/launch/x/a.jpg", "https://cdn.shopify.com/a.jpg"]) assert.equal(isSafeUrl(u), true, u);
  });
  test("every existing preview config passes the validator, unchanged", () => {
    for (const slug of previewSlugs()) { const r = parsePreviewConfig(getPreviewConfig(slug), slug); assert.ok(r.ok, `${slug}: ${r.error}`); }
  });
  test("a preview with a javascript: link or an extra product field is rejected", () => {
    const base = structuredClone(getPreviewConfig("shetland-jewellery"));
    assert.equal(parsePreviewConfig({ ...base, sourceSite: { label: "x", url: "javascript:alert(1)" } }).ok, false);
    assert.equal(parsePreviewConfig({ ...base, products: [{ ...base.products[0], checkout: "/buy" }] }).ok, false);
    assert.equal(parsePreviewConfig({ ...base, products: base.products.concat(base.products) }).ok, false);
    assert.equal(parsePreviewConfig({ ...base, slug: "other-name" }, "shetland-jewellery").ok, false);
  });
  test("every page draft built from a preview passes the draft validator", () => {
    for (const slug of previewSlugs()) { const r = parsePageDraft(buildPageDraft(getPreviewConfig(slug))); assert.ok(r.ok, `${slug}: ${r.error}`); }
  });
  test("a page draft needs a picture, a tagline and safe addresses", () => {
    const d = buildPageDraft(getPreviewConfig("the-dowry"));
    assert.equal(parsePageDraft({ ...d, hero: { ...d.hero, image: { src: "javascript:x", alt: "" } } }).ok, false);
    assert.equal(parsePageDraft({ ...d, emphasis: "nonsense" }).ok, false);
    assert.equal(parsePageDraft({ ...d, version: 2 }).ok, false);
  });
});

describe("Business Page V2 adapts to each business", () => {
  const model = (slug, over = {}) => {
    const cfg = getPreviewConfig(slug);
    return buildBusinessPageModel({
      mode: "prepared", business: { id: "b", name: cfg.businessName, category: cfg.business.category ?? "retail", description: cfg.business.description, address: "1 High St, Lerwick", lat: 60.15, lng: -1.14, logo_url: null, cover_url: null, brand_color: null, phone: "01595 000000", website: null, email: null, opening_hours: { mon: "9-5" }, opening_hours_until: null, is_verified: false, is_claimed: false, accepts_bookings: false },
      fallback: { id: "b", name: cfg.businessName }, categoryLabels: { retail: "Retail", food_drink: "Food & Drink" }, products: [], offers: [], passes: [], services: [], loyalty: null, events: [], draft: buildPageDraft(cfg), ...over,
    });
  };
  test("Shetland Jewellery: story → shop → workshop experience, then the practical sections", () => {
    assert.deepEqual(planSections(model("shetland-jewellery")), ["story", "shop", "experience", "rewards", "hours", "location", "contact"]);
  });
  test("The Dowry: booking leads, then about/discovery, then rewards ideas", () => {
    const o = planSections(model("the-dowry"));
    assert.equal(o[0], "book"); assert.ok(o.indexOf("book") < o.indexOf("story") && o.indexOf("story") < o.indexOf("rewards")); assert.ok(!o.includes("shop"), "no shop section for a business with no products");
  });
  test("Shetland Soap Company: story → shop", () => {
    const o = planSections(model("shetland-soap-company")); assert.ok(o.indexOf("story") < o.indexOf("shop"));
  });
  test("Da Craft Shed and Peerie Shop: shop first", () => {
    for (const s of ["da-craft-shed", "peerie-shop"]) { const o = planSections(model(s)); assert.ok(o.indexOf("shop") < o.indexOf("story"), s); }
  });
  test("hours, location and contact always close the page, and hero is not in the middle list", () => {
    for (const s of previewSlugs()) { const o = planSections(model(s)); assert.deepEqual(o.slice(-3).filter((x) => ["hours", "location", "contact"].includes(x)), o.slice(-3).filter((x) => ["hours", "location", "contact"].includes(x))); assert.ok(!o.includes("hero")); const tail = o.slice(o.indexOf("hours")); assert.deepEqual(tail, ["hours", "location", "contact"]); }
  });
  test("no content, no section — nothing is invented", () => {
    const m = model("the-dowry", { draft: null, business: null, fallback: { id: "b", name: "Bare Co" } });
    assert.deepEqual(planSections(m), []);
    assert.equal(m.shop, null); assert.equal(m.book, null); assert.equal(m.rewards, null);
  });
  test("real content replaces examples: real products win, and examples are marked", () => {
    const ex = model("shetland-jewellery");
    assert.ok(ex.shop.example && ex.shop.items.every((i) => i.example));
    const real = model("shetland-jewellery", { products: [{ id: "p1", title: "Real ring", price_pence: 4500, photos: ["https://x/y.jpg"] }] });
    assert.equal(real.shop.example, false); assert.equal(real.shop.items.length, 1); assert.equal(real.shop.items[0].pricePounds, 45);
  });
  test("an explicit layout from Admin reorders the middle only", () => {
    const m = model("shetland-jewellery"); m.layout = ["experience", "shop", "story"];
    assert.deepEqual(planSections(m).slice(0, 3), ["experience", "shop", "story"]);
    assert.ok(availability(m).location);
  });
  test("a real booking replaces the example booking", () => {
    const m = model("the-dowry", { business: { id: "b", name: "The Dowry", category: "food_drink", description: "x", address: "a", lat: null, lng: null, logo_url: null, cover_url: null, brand_color: null, phone: null, website: null, email: null, opening_hours: null, opening_hours_until: null, is_verified: false, is_claimed: true, accepts_bookings: true }, services: [{ id: "s1", name: "Table for two", description: null, duration_minutes: 90, price_pence: null }] });
    assert.equal(m.book.example, false); assert.equal(m.book.services.length, 1);
  });
});

describe("the common preview treatment says Import products — Available", () => {
  test("shared catalogue options", () => {
    const by = Object.fromEntries(CATALOGUE_OPTIONS.map((o) => [o.id, o]));
    assert.equal(by.import.chip, "Available"); assert.equal(by.manual.chip, "Available"); assert.equal(by.connect.chip, "Coming next");
    assert.match(by.import.body, /Upload your existing catalogue and review everything before anything goes live\./);
    assert.equal(by.connect.body, "Shopify · WooCommerce · Square");
    assert.doesNotMatch(JSON.stringify(CATALOGUE_OPTIONS), /Being prepared|connected|synced|live sync/i);
  });
  test("the page takes it from the shared module, with no hand-written chip per preview", () => {
    const page = read("components/launch-preview/PreviewPage.tsx");
    assert.match(page, /CATALOGUE_OPTIONS/); assert.doesNotMatch(page, /Being prepared/);
    for (const slug of previewSlugs()) assert.doesNotMatch(read(`lib/launch-preview/partners/${slug}.ts`), /Being prepared|Import products/);
  });
});

describe("guarantees: admin-only, private drafts, nothing automatic", () => {
  const walk = (d) => { const root = new URL("../", import.meta.url).pathname; const out = []; const go = (p) => { for (const f of readdirSync(p)) { const q = join(p, f); statSync(q).isDirectory() ? go(q) : out.push(q); } }; go(join(root, d)); return out; };
  const actions = read("app/admin/launch-partners/actions.ts");

  test("every admin action begins with requireAdmin()", () => {
    const fns = actions.split(/\nexport async function /).slice(1);
    assert.ok(fns.length >= 10);
    for (const f of fns) {
      const at = f.indexOf("await requireAdmin()");
      assert.ok(at > 0, `${f.split("(")[0]} never checks`);
      assert.doesNotMatch(f.slice(0, at), /await |try \{|rpc\(/, `${f.split("(")[0]} does something before the admin check`);
    }
  });
  test("admin preview pages are admin-gated; the owner page needs ownership AND the database's approved-claim check", () => {
    for (const p of ["app/admin-preview/launch-partners/[id]/business-page/page.tsx", "app/admin-preview/launch-partners/[id]/launch/page.tsx"]) assert.match(read(p), /await requireAdmin\(\)/, p);
    const owner = read("app/business/[id]/manage/page-draft/page.tsx");
    assert.match(owner, /requireBusinessOwner/); assert.match(owner, /readPageDraft/); assert.match(owner, /if \(!d\) notFound\(\)/);
  });
  test("the campaign tables and drafts are reachable only through the admin screens and the server module — no public page, API route or other component names them", () => {
    const banned = /launch_partner_campaigns|launch_partner_events|page_config|preview_config|admin_launch_partner_|launch_partner_page_draft/;
    const allowed = ["lib/launch-partners/", "lib/business-page/", "app/admin/launch-partners/", "app/admin-preview/", "components/admin/launch-partners/", "app/business/[id]/manage/page-draft/"];
    const root = new URL("../", import.meta.url).pathname;
    for (const dir of ["app", "components", "lib"]) for (const f of walk(dir)) {
      if (!/\.(ts|tsx)$/.test(f)) continue;
      const rel = f.slice(root.length);
      if (allowed.some((a) => rel.startsWith(a))) continue;
      if (banned.test(readFileSync(f, "utf8"))) assert.fail(`${rel} references campaign data directly`);
    }
    for (const f of walk("app/api")) assert.doesNotMatch(readFileSync(f, "utf8"), /launch-partners|campaigns\.server|page-draft|page_config/, f);
  });
  test("the server module has no service-role key, no direct table access, and nothing that writes a listing", () => {
    const m = read("lib/launch-partners/campaigns.server.ts") + actions;
    assert.doesNotMatch(m, /service_role|SERVICE_ROLE|serviceClient|createAdminClient/i);
    assert.doesNotMatch(m, /\.from\(["'](?!local_businesses_public)/, "only the public Directory VIEW is read directly");
    assert.doesNotMatch(m, /\.(insert|update|upsert|delete)\(/, "no direct writes");
    assert.doesNotMatch(m, /local_businesses["']\)\s*\.\s*(update|insert)/);
  });
  test("an invitation is created in exactly one place, behind an admin click — never by preparing, importing or viewing", () => {
    const all = walk("app").concat(walk("lib"), walk("components")).filter((f) => /\.(ts|tsx)$/.test(f));
    const users = all.filter((f) => /admin_issue_launch_invite/.test(readFileSync(f, "utf8"))).map((f) => f.split("/").slice(-2).join("/")).sort();
    assert.deepEqual(users, ["launch-partners/actions.ts", "admin/LaunchInvites.tsx"].sort());
    const prepare = actions.slice(actions.indexOf("export async function prepareCampaignAction"), actions.indexOf("export async function importExistingAction"));
    assert.doesNotMatch(prepare, /admin_issue_launch_invite|issueInvitation|setClaimMode|markSent/);
    assert.doesNotMatch(read("lib/launch-partners/campaigns.server.ts").slice(read("lib/launch-partners/campaigns.server.ts").indexOf("export async function importExistingPreviews")), /admin_issue_launch_invite|markSent|setStage/);
  });
  test("a real campaign cannot get an invitation until it is marked ready; only a test fixture is exempt", () => {
    assert.match(actions, /!c\.is_test && c\.stage !== "ready_to_invite" && c\.stage !== "sent"/);
  });
  test("claiming can only be opened while an invitation is live, and the claim action itself refuses a closed preview", () => {
    assert.match(actions, /Generate a private invitation first/);
    assert.match(read("app/launch/[slug]/claim/actions.ts"), /open\.cfg\.claim === "holding"/);
  });
  test("view tracking: not for admins or review tokens, token goes only to the database, failures never break the page", () => {
    const page = read("app/launch/[slug]/page.tsx");
    assert.match(page, /!open\.review && account\?\.profile\?\.role !== "admin"/);
    const s = read("lib/launch-partners/campaigns.server.ts");
    const fn = s.slice(s.indexOf("export async function recordPreviewView"), s.indexOf("export interface ImportOutcome"));
    assert.match(fn, /catch/); assert.doesNotMatch(fn, /console\.|fetch\(|headers|referer/i);
  });
  test("the public business route is untouched: it neither imports Business Page V2 nor reads a draft", () => {
    const pub = read("app/directory/[id]/page.tsx");
    assert.doesNotMatch(pub, /BusinessPageV2|business-page|page-draft|launch-partners|readPageDraft/);
    assert.doesNotMatch(read("components/site/SiteHeader.tsx") + read("app/sitemap.ts"), /admin-preview|page-draft|launch-partners/);
  });
  test("private drafts are never indexed or cached", () => {
    const cfg = read("next.config.ts");
    assert.match(cfg, /source: "\/admin-preview\/:path\*"[\s\S]{0,260}noindex/);
    assert.match(cfg, /source: "\/business\/:id\/manage\/page-draft"[\s\S]{0,260}noindex/);
    for (const p of ["app/admin-preview/launch-partners/[id]/business-page/page.tsx", "app/business/[id]/manage/page-draft/page.tsx"]) assert.match(read(p), /index: false/);
  });
  test("the outreach contact email never reaches a public renderer", () => {
    for (const f of ["components/business-page/BusinessPageV2.tsx", "lib/business-page/model.ts", "lib/business-page/load.server.ts", "components/launch-preview/PreviewPage.tsx", "app/launch/[slug]/page.tsx", "app/business/[id]/manage/page-draft/page.tsx", "app/admin-preview/launch-partners/[id]/business-page/page.tsx"]) {
      assert.doesNotMatch(read(f), /contact_email|contactEmail|email_body|email_subject/, f);
    }
    const s = read("lib/launch-partners/campaigns.server.ts");
    assert.doesNotMatch(s.slice(s.indexOf("export async function readPageDraft"), s.indexOf("export interface ImportOutcome")), /contact_email/);
  });
});


describe("prepared vs live: the customer-facing page shows only genuine content", () => {
  const biz = (o = {}) => ({ id: "b", name: "Shetland Jewellery", category: "retail", description: "A family jewellery business in Weisdale.", address: "Weisdale, Shetland", lat: 60.2, lng: -1.3, logo_url: null, cover_url: null, brand_color: null, phone: "01595 830000", website: "https://example.co.uk", email: null, opening_hours: null, opening_hours_until: null, is_verified: false, is_claimed: false, accepts_bookings: false, ...o });
  const build = (mode, over = {}, slug = "shetland-jewellery") => buildBusinessPageModel({ mode, business: biz(), fallback: { id: "b", name: "Shetland Jewellery" }, categoryLabels: { retail: "Retail" }, products: [], offers: [], passes: [], services: [], loyalty: null, events: [], draft: buildPageDraft(getPreviewConfig(slug)), ...over });

  test("a fully populated draft contributes NOTHING to a live model", () => {
    for (const slug of previewSlugs()) {
      const m = build("live", {}, slug);
      assert.equal(m.mode, "live");
      assert.equal(m.shop, null, `${slug}: no example products`);
      assert.equal(m.book, null, `${slug}: no example booking`);
      assert.equal(m.experience, null, `${slug}: no example experience`);
      assert.equal(m.rewards, null, `${slug}: no suggested rewards`);
      assert.deepEqual(m.useful, []); assert.equal(m.story, null);
      assert.equal(m.hero.collage.length, 0);
      assert.deepEqual(planSections(m).filter((x) => ["shop", "book", "experience", "rewards", "useful"].includes(x)), [], slug);
    }
  });
  test("live uses the Directory facts only: description as About, genuine cover or the branded fallback", () => {
    const m = build("live");
    assert.equal(m.about, "A family jewellery business in Weisdale."); assert.equal(m.hero.visual, "compact"); assert.equal(m.hero.image, null);
    assert.deepEqual(planSections(m), ["story", "location", "contact"]);
    assert.equal(build("live", { business: biz({ cover_url: "https://x/cover.jpg" }) }).hero.visual, "photo");
  });
  test("live shows real products, real services, real loyalty and real passes — and none of them is marked as an example", () => {
    const m = build("live", {
      business: biz({ accepts_bookings: true }),
      products: [{ id: "p1", title: "Ring", price_pence: 4500, photos: ["https://x/r.jpg"] }, { id: "p2", title: "Pendant", price_pence: 9000, photos: ["https://x/p.jpg"] }, { id: "p3", title: "Brooch", price_pence: 6500, photos: ["https://x/b.jpg"] }],
      services: [{ id: "s1", name: "Workshop tour", description: null, duration_minutes: 60, price_pence: 500 }],
      loyalty: { type: "stamps", stamps_required: 8, stamp_reward: "a free repair", points_per_pound: null, points_for_pound: null },
      passes: [{ id: "u1", name: "Tour pass", description: null, price_pence: 1500, image_url: null }],
    });
    assert.ok(m.shop.items.every((i) => i.example === false)); assert.equal(m.shop.example, false);
    assert.equal(m.book.example, false); assert.equal(m.rewards.example, false); assert.equal(m.passes.length, 1);
    assert.equal(m.hero.visual, "mosaic", "no photograph but three real product pictures → mosaic");
    assert.deepEqual(planSections(m), ["shop", "story", "experience", "book", "rewards", "location", "contact"]);
  });
  test("enforceLive is a last line of defence: a live model that somehow carries examples is cleaned", () => {
    const dirty = { ...build("prepared"), mode: "live" };
    assert.ok(dirty.shop.example && dirty.experience && dirty.rewards.example && dirty.story, "precondition: the prepared model has examples");
    const m = enforceLive(dirty);
    assert.equal(m.shop, null); assert.equal(m.experience, null); assert.equal(m.rewards, null); assert.equal(m.book, null); assert.equal(m.story, null); assert.deepEqual(m.useful, []);
    const mixed = enforceLive({ ...dirty, shop: { title: "Shop", example: false, items: [{ id: "1", title: "Real", pricePounds: 5, image: null, example: false }, { id: "2", title: "Fake", pricePounds: 5, image: null, example: true }] } });
    assert.deepEqual(mixed.shop.items.map((i) => i.id), ["1"]);
    assert.equal(enforceLive(build("prepared")).shop.example, true, "prepared mode is untouched");
  });
  test("prepared mode keeps its examples, and every one is flagged so the page can mark it", () => {
    const m = build("prepared");
    assert.ok(m.shop.items.every((i) => i.example)); assert.equal(m.experience.example, true); assert.equal(m.rewards.example, true);
    assert.equal(m.hero.visual, "photo");
  });
  test("the words that mark something as an example live in ONE module and in no live-capable file", () => {
    assert.equal(PREPARED_COPY.intro, "This is a private preview of how your real OneShetland page could look. Example sections disappear unless you choose to set them up.");
    assert.equal(PREPARED_COPY.bar, "Private draft · Not public"); assert.equal(PREPARED_COPY.tag, "Example · not live");
    const forbidden = /Example|Idea\b|Not set up|Replaced by|\bcould\b|[Rr]epresentative|Suggestion|not for sale/;
    const files = ["lib/business-page/model.ts", "lib/business-page/sections.ts", "lib/business-page/tokens.ts", "lib/business-page/load.server.ts", "components/business-page/BusinessPageV2.tsx", "components/business-page/LocationPanel.tsx", "components/business-page/slots.ts", "components/design-v2/primitives.tsx"];
    for (const f of files) assert.doesNotMatch(read(f), forbidden, `${f} spells out prepared-only wording`);
  });
  test("prepared-only wording is reached only through PREPARED_COPY, and the page strips examples before rendering", () => {
    const page = read("components/business-page/BusinessPageV2.tsx");
    assert.match(page, /const model = enforceLive\(given\)/);
    assert.match(page, /\{prepared && <DraftBar/); assert.match(page, /\{prepared && <p [^>]*>\{PREPARED_COPY\.intro\}/);
    for (const k of ["notForSale", "tag", "bookingNote", "experienceNote", "rewardsTag"]) assert.match(page, new RegExp(`PREPARED_COPY\\.${k}`));
  });
  test("slots are never offered an example item", () => {
    const page = read("components/business-page/BusinessPageV2.tsx");
    assert.match(page, /p\.example \? <span[^]*?: slots\.productAction\?\.\(p\)/);
    assert.match(page, /\{!r\.example && slots\.rewardsProgress/);
  });
});

describe("hero: actions come from real capabilities; the visual always has something deliberate", () => {
  const base = { mode: "live", emphasis: undefined, identity: { id: "b", name: "X" }, shop: null, book: null, offers: [], passes: [], experience: null, rewards: null, events: [], useful: [], story: null, about: null, location: { address: null, lat: null, lng: null, mapHref: null }, contact: { phone: null, website: null, email: null }, hours: { hours: null, until: null } };
  test("a business with nothing gets no buttons at all", () => assert.deepEqual(heroActions(base), []));
  test("each button exists only for a capability the business has", () => {
    const ids = (o) => heroActions({ ...base, ...o }).map((a) => a.id);
    assert.deepEqual(ids({ shop: { items: [{}] } }), ["shop"]);
    assert.deepEqual(ids({ offers: [{}] }), ["offers"]);
    assert.deepEqual(ids({ passes: [{}] }), ["experience"]);
    assert.deepEqual(ids({ location: { address: "a", lat: null, lng: null, mapHref: "https://maps/x" } }), ["directions"]);
    assert.deepEqual(ids({ contact: { phone: "123", website: "https://w", email: null } }), ["call", "website"]);
  });
  test("the lead action follows the emphasis, and there are never more than the maximum", () => {
    const rich = { shop: { items: [{}] }, book: { cta: "Reserve a table" }, offers: [{}], passes: [{}], location: { address: "a", lat: null, lng: null, mapHref: "https://maps/x" }, contact: { phone: "1", website: "https://w", email: null } };
    assert.equal(heroActions({ ...base, ...rich, emphasis: "book_first" })[0].id, "book");
    assert.equal(heroActions({ ...base, ...rich, emphasis: "shop_first" })[0].id, "shop");
    assert.equal(heroActions({ ...base, ...rich, emphasis: "experience_first" })[0].id, "experience");
    assert.equal(heroActions({ ...base, ...rich }).length, MAX_HERO_ACTIONS);
  });
  test("hero visual: photograph, then product mosaic, then the branded card — never nothing", () => {
    assert.equal(chooseHeroVisual(undefined, true, 0), "photo"); assert.equal(chooseHeroVisual(undefined, false, 3), "mosaic"); assert.equal(chooseHeroVisual(undefined, false, 1), "brand");
    assert.equal(chooseHeroVisual("mosaic", true, 3), "mosaic"); assert.equal(chooseHeroVisual("mosaic", true, 1), "photo", "an explicit mosaic without enough pictures falls back");
    assert.equal(chooseHeroVisual("photo", false, 0), "brand", "an explicit photo with no photograph falls back");
    assert.equal(chooseHeroVisual("brand", true, 3), "brand");
  });
  test("LIVE hero: a genuine photograph, else real product pictures, else a compact editorial header — never the branded card", () => {
    assert.equal(chooseHeroVisual(undefined, true, 0, "live"), "photo");
    assert.equal(chooseHeroVisual(undefined, false, 3, "live"), "mosaic");
    assert.equal(chooseHeroVisual(undefined, false, 2, "live"), "compact");
    assert.equal(chooseHeroVisual(undefined, false, 0, "live"), "compact");
    assert.equal(chooseHeroVisual("brand", false, 0, "live"), "compact", "even an explicit brand choice cannot reach a live page");
    for (const img of [true, false]) for (const n of [0, 1, 2, 3]) assert.notEqual(chooseHeroVisual("brand", img, n, "live"), "brand");
    assert.equal(chooseHeroVisual(undefined, false, 0, "prepared"), "brand", "prepared heroes are unchanged");
  });
  test("live mode adds no decorative panels: no About side card, no location stand-in", () => {
    const page = read("components/business-page/BusinessPageV2.tsx");
    const story = page.slice(page.indexOf("function Story("), page.indexOf("function Shop("));
    assert.match(story, /\{!live && \(\s*<div className="flex flex-col justify-end rounded-3xl/);
    const loc = page.slice(page.indexOf("function Location("), page.indexOf("function Contact("));
    assert.match(loc, /decorativeFallback=\{!live\}/); assert.match(loc, /\(hasMap \|\| !live\)/);
  });
  test("a live model carrying the branded card is converted to the compact hero", () => {
    const base = buildBusinessPageModel({ mode: "prepared", business: null, fallback: { id: "b", name: "The Dowry" }, categoryLabels: {}, products: [], offers: [], passes: [], services: [], loyalty: null, events: [], draft: buildPageDraft(getPreviewConfig("the-dowry")) });
    assert.equal(base.hero.visual, "brand");
    assert.equal(enforceLive({ ...base, mode: "live" }).hero.visual, "compact");
    assert.equal(enforceLive(base).hero.visual, "brand", "prepared untouched");
  });
  test("the compact hero is content-driven: no picture panel, no gradient card, no monogram", () => {
    const page = read("components/business-page/BusinessPageV2.tsx");
    const compact = page.slice(page.indexOf("function CompactHero"), page.indexOf("function HeroVisual"));
    assert.ok(compact.length > 500);
    assert.doesNotMatch(compact, /aspect-|initials\(|(?<![\w:-])ring-4|shadow-2xl|rounded-\[2rem\]|min-h-|blur-3xl|linear-gradient\((?!180deg)/, "no faux panel, card or glow; only a faint vertical tonal wash");
    assert.match(page, /hero\.visual === "compact"\) return <CompactHero/);
    assert.match(compact, /logoTile &&/); assert.match(compact, /!\/\\\.jpe\?g/, "a photograph filed as a logo is left out, not cropped to fit");
  });
  test("Love From Shetland leads with its products, Shetland Jewellery with its photograph — different heroes from different content", () => {
    const mk = (slug) => buildBusinessPageModel({ mode: "prepared", business: null, fallback: { id: "b", name: slug }, categoryLabels: {}, products: [], offers: [], passes: [], services: [], loyalty: null, events: [], draft: buildPageDraft(getPreviewConfig(slug)) });
    assert.equal(mk("love-from-shetland").hero.visual, "mosaic"); assert.equal(mk("shetland-jewellery").hero.visual, "photo"); assert.equal(mk("the-dowry").hero.visual, "brand");
  });
});

describe("the map fails gracefully", () => {
  test("Google's rejection hook and a load timeout both lead to the caller's fallback, never to Google's error box", () => {
    const m = read("components/local/BusinessLocationMap.tsx");
    assert.match(m, /window\.gm_authFailure = /); assert.match(m, /setTimeout\(/); assert.match(m, /fallback/);
    const panel = read("components/business-page/LocationPanel.tsx");
    assert.match(panel, /fallback=\{card\}/); assert.match(panel, /Open in Maps/);
    assert.match(panel, /if \(!decorativeFallback\) return <BusinessLocationMap/, "live: the map alone, no frame left behind");
  });
});

describe("admin pipeline: small polish", () => {
  test("test fixtures are kept out of the normal pipeline", async () => {
    const { realRows, isTestRow, countByStatus } = await import("../lib/launch-partners/status.ts");
    const rows = [row({ id: "a" }), row({ id: "t", is_test: true, stage: "preparing" })];
    assert.deepEqual(realRows(rows).map((r) => r.id), ["a"]); assert.ok(isTestRow(rows[1]));
    assert.equal(Object.values(countByStatus(realRows(rows))).reduce((x, y) => x + y, 0), 1);
    const ui = read("components/admin/launch-partners/Pipeline.tsx"); assert.match(ui, /filter === "test" \? tests/); assert.match(ui, /Test <span/);
  });
  test("the Next action leads somewhere that already exists", async () => {
    const { nextActionHref } = await import("../lib/launch-partners/status.ts");
    assert.equal(nextActionHref(row({ id: "c1" })), "/admin/launch-partners/c1#preview");
    assert.equal(nextActionHref(row({ id: "c1", stage: "preparing", has_preview: true })), "/admin/launch-partners/c1#page");
    assert.equal(nextActionHref(row({ id: "c1", stage: "preparing", has_preview: true, has_page_draft: true })), "/admin/launch-partners/c1#status");
    assert.equal(nextActionHref(row({ id: "c1", stage: "ready_to_invite" })), "/admin/launch-partners/c1#invitation");
    assert.equal(nextActionHref(row({ id: "c1", stage: "ready_to_invite", invite: { status: "open" } })), "/admin/launch-partners/c1#email");
    assert.equal(nextActionHref(row({ stage: "sent", claim: { status: "pending", created_at: "x" } })), "/admin/claims?status=pending");
    assert.equal(nextActionHref(row({ business_id: "b9", stage: "sent", claim: { status: "approved", created_at: "x" }, has_owner: true })), "/admin/claims?status=launch&business=b9");
  });
  test("email readiness is one compact cell", () => {
    assert.equal(pipelineCells(row()).email.label, "—");
    assert.equal(pipelineCells(row({ has_contact_email: true })).email.label, "contact");
    assert.equal(pipelineCells(row({ has_email_draft: true })).email.label, "draft");
    assert.equal(pipelineCells(row({ has_contact_email: true, has_email_draft: true })).email.label, "ready");
  });
});

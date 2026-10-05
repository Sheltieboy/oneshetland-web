/**
 * Product import — the pure pipeline: CSV reading, text sanitising, money, policy screening, presets, and the plan
 * (matching, validation, variants, diff). Run: node --test tests/product-import-core.test.mjs
 *
 * No database and no network: the database half is proved in the mobile repo's
 * supabase/tests/product-import-foundation.node.test.ts, and the HTTP/image half in
 * product-import-images.test.mjs.
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { parseCsvFile, parseCsvText, detectDelimiter, decodeCsvBytes, toCsv, csvCell, CsvError, MAX_ROWS } from "../lib/product-import/csv.ts";
import { TEMPLATE_HEADERS, TEMPLATE_ROWS, suggestMapping, FIELDS, templateInstructions } from "../lib/product-import/columns.ts";
import { toPlainText, normTitle } from "../lib/product-import/text.ts";
import { parseMoney, parseImageUrl, parseCategory, parseStockMode, parseBool } from "../lib/product-import/normalise.ts";
import { screenText } from "../lib/product-import/restricted.ts";
import { detectPreset, toCanonical, applyMapping } from "../lib/product-import/presets.ts";
import { buildPlan, toDbItem } from "../lib/product-import/plan.ts";

const enc = (s) => new TextEncoder().encode(s);
const csvOf = (rows) => toCsv(rows);
const load = (text, preset = "oneshetland") => {
  const p = parseCsvFile(enc(text));
  return { p, rows: toCanonical(p.headers, p.rows, preset === "oneshetland" ? "oneshetland" : preset) };
};
const HEAD = ["ref", "sku", "title", "price", "category", "stock", "image_1", "variant_name", "variant_price", "variant_stock", "variant_sku", "description", "compare_at_price", "stock_mode"];
const mk = (...rows) => csvOf([HEAD, ...rows.map((r) => HEAD.map((h) => r[h] ?? ""))]);
const plan = (text, existing = [], opts) => buildPlan(load(text).rows, existing, opts);
const IMG = "https://cdn.example.com/a.jpg";
const existing = (o = {}) => ({
  id: "p1", title: "Fair Isle hat", sku: null, external_source: "csv", external_ref: "HAT", description: null, category: "knitwear",
  price_pence: 2500, compare_at_pence: null, stock_mode: "tracked", stock: null, lead_time_days: null, collect_only: false, free_uk_post: false,
  photos: [], is_active: false, reserved: 0, source_hash: null, source_locked_fields: [], variants: [], ...o,
});

describe("CSV reading", () => {
  test("comma, quotes, doubled quotes, embedded newline and delimiter", () => {
    const r = parseCsvText('a,b,c\n1,"x, y","say ""hi"""\n2,"line1\nline2",z\n', ",");
    assert.deepEqual(r.map((x) => x.cells), [["a", "b", "c"], ["1", "x, y", 'say "hi"'], ["2", "line1\nline2", "z"]]);
  });
  test("semicolon files are detected and parsed", () => {
    const text = "title;price\nMug;12,50\n";
    assert.equal(detectDelimiter(text), ";");
    const p = parseCsvFile(enc(text));
    assert.deepEqual(p.headers, ["title", "price"]);
    assert.equal(p.rows[0].cells[1], "12,50");
  });
  test("an Excel BOM is removed, CRLF handled, blank lines dropped, row numbers are file lines", () => {
    const p = parseCsvFile(enc("﻿title,price\r\nA,1\r\n\r\nB,2\r\n"));
    assert.deepEqual(p.headers, ["title", "price"]);
    assert.deepEqual(p.rows.map((r) => r.rowNumber), [2, 4]);
  });
  test("row numbers count physical lines across multi-line cells", () => {
    const p = parseCsvFile(enc('title,price\n"two\nlines",1\nB,2\n'));
    assert.deepEqual(p.rows.map((r) => r.rowNumber), [2, 4]);
  });
  test("refuses: over 2 MB, empty, spreadsheet, non-UTF-8, binary, more than 500 rows, unclosed quote", () => {
    const code = (fn) => { try { fn(); } catch (e) { return e instanceof CsvError ? e.code : "other"; } return "none"; };
    assert.equal(code(() => decodeCsvBytes(new Uint8Array(2 * 1024 * 1024 + 1))), "too_large");
    assert.equal(code(() => decodeCsvBytes(new Uint8Array(0))), "empty");
    assert.equal(code(() => decodeCsvBytes(new Uint8Array([0x50, 0x4b, 0x03, 0x04, 1, 2]))), "spreadsheet");
    assert.equal(code(() => decodeCsvBytes(new Uint8Array([0x74, 0xe9, 0x73, 0x74]))), "not_utf8");
    assert.equal(code(() => decodeCsvBytes(new Uint8Array([0x74, 0, 0x65]))), "binary");
    const many = "title,price\n" + Array.from({ length: MAX_ROWS + 1 }, (_, i) => `P${i},5`).join("\n");
    assert.equal(code(() => parseCsvFile(enc(many))), "too_many_rows");
    assert.equal(code(() => parseCsvFile(enc("title,price\n\"oops,5\n"))), "unclosed_quote");
  });
  test("exactly 500 rows is accepted", () => {
    const ok = "title,price\n" + Array.from({ length: MAX_ROWS }, (_, i) => `P${i},5`).join("\n");
    assert.equal(parseCsvFile(enc(ok)).rows.length, 500);
  });
});

describe("formula-safe writing", () => {
  test("cells that start a formula are neutralised, whatever the quoting", () => {
    for (const bad of ["=SUM(A1)", "+1", "-2", "@cmd", "\tx", "\rx", '=HYPERLINK("http://evil","x")']) {
      assert.ok(csvCell(bad).replace(/^"/, "").startsWith("'"), `${JSON.stringify(bad)} → ${csvCell(bad)}`);
    }
    assert.equal(csvCell("plain"), "plain");
    assert.equal(csvCell('a "q" b'), '"a ""q"" b"');
    assert.equal(csvCell("a,b"), '"a,b"');
  });
  test("the template round-trips through the reader and carries no formula cells", () => {
    const text = toCsv([TEMPLATE_HEADERS, ...TEMPLATE_ROWS]);
    const p = parseCsvFile(enc(text));
    assert.deepEqual(p.headers, FIELDS);
    assert.equal(p.rows.length, TEMPLATE_ROWS.length);
    assert.ok(!text.split("\r\n").some((l) => /^[=+@]/.test(l)));
  });
});

describe("plain text", () => {
  test("HTML becomes plain text; scripts and handlers vanish; entities decode; no markup survives", () => {
    const html = '<p>Warm &amp; soft</p><script>alert(1)</script><ul><li>Wool</li><li>Made in <b>Shetland</b></li></ul><img src=x onerror=alert(1)>&lt;b&gt;x&lt;/b&gt;';
    const t = toPlainText(html);
    assert.ok(!/[<>]/.test(t.replace(/&/g, "")) || !/<[a-z]/i.test(t), t);
    assert.match(t, /Warm & soft/);
    assert.match(t, /• Wool/);
    assert.ok(!/alert/.test(t), t);
    assert.ok(!/onerror/.test(t));
  });
  test("a less-than that is not a tag survives; control and bidi characters go", () => {
    assert.equal(toPlainText("fits under <10cm"), "fits under <10cm");
    assert.equal(toPlainText("a‮b\u0007c​d"), "abcd");
  });
  test("normTitle ignores case, accents, punctuation and ampersands", () => {
    assert.equal(normTitle("  Fair-Isle HAT! "), normTitle("fair isle hat"));
    assert.equal(normTitle("Café & Co"), normTitle("cafe and co"));
  });
});

describe("money and values", () => {
  test("pounds to pence in every ordinary spelling", () => {
    const p = (s) => { const r = parseMoney(s); return r.ok ? r.value : null; };
    assert.equal(p("12"), 1200); assert.equal(p("12.5"), 1250); assert.equal(p("£12.50"), 1250); assert.equal(p("GBP 12.50"), 1250);
    assert.equal(p("1,299.00"), 129900); assert.equal(p("12,50"), 1250); assert.equal(p("1,299"), 129900); assert.equal(p("0.5"), 50);
  });
  test("refuses other currencies, negatives, text and three decimals — with a reason", () => {
    for (const s of ["$12", "€12", "12 USD", "-5", "abc", "12.999", "", "1.2.3"]) {
      const r = parseMoney(s); assert.equal(r.ok, false, s); assert.ok(r.message.length > 3);
    }
    assert.match(parseMoney("$12").message, /GBP/);
  });
  test("categories, stock modes, booleans, image URLs", () => {
    assert.deepEqual(parseCategory("Art & prints"), { ok: true, value: "art" });
    assert.deepEqual(parseCategory("food_drink"), { ok: true, value: "food_drink" });
    assert.equal(parseCategory("Gadgets").ok, false);
    assert.equal(parseStockMode("Made to order").value, "made_to_order");
    assert.equal(parseStockMode("one-off").value, "one_off");
    assert.equal(parseStockMode("sometimes").ok, false);
    assert.equal(parseBool("Yes", "x").value, true); assert.equal(parseBool("", "x").value, false); assert.equal(parseBool("maybe", "x").ok, false);
    assert.equal(parseImageUrl("https://a.example/x.jpg").ok, true);
    for (const bad of ["http://a.example/x.jpg", "ftp://a.example/x.jpg", "javascript:alert(1)", "data:image/png;base64,AAAA", "not a url", "https://u:p@a.example/x.jpg", "https://a.example/logo.svg", "//a.example/x.jpg"]) {
      assert.equal(parseImageUrl(bad).ok, false, bad);
    }
  });
});

describe("policy screen", () => {
  test("blocks unmistakable restricted goods", () => {
    for (const t of ["Fireworks display box", "Disposable vape 20mg nicotine", "Hunting rifle .22", "Rolling tobacco 50g"]) {
      assert.ok(screenText(t).some((h) => h.level === "block"), t);
    }
  });
  test("warns on alcohol and bladed items", () => {
    assert.ok(screenText("Shetland gin 70cl").some((h) => h.level === "warn" && /alcohol/.test(h.reason)));
    assert.ok(screenText("Sgian dubh with horn handle").some((h) => h.level === "warn"));
  });
  test("ordinary goods are not flagged: ginger, crumble, wine glass, butter knife, spirit of Shetland, fake fur", () => {
    for (const t of ["Ginger biscuits", "Rhubarb crumble mix", "Crystal wine glass", "Butter knife set", "The Spirit of Shetland print", "Fake fur hat", "Seaweed soap", "Tweed cap", "Whisky glass candle"]) {
      assert.deepEqual(screenText(t), [], t);
    }
  });
  test("looks at the description and category too", () => {
    assert.ok(screenText("Gift set", "contains a bottle of vodka").length);
    assert.ok(screenText("Gift", "", "tobacco").length);
  });
});

describe("presets: detection and adapters", () => {
  const shopify = [
    ["Handle", "Title", "Body (HTML)", "Vendor", "Type", "Tags", "Published", "Option1 Name", "Option1 Value", "Option2 Name", "Option2 Value", "Variant SKU", "Variant Inventory Tracker", "Variant Inventory Qty", "Variant Price", "Variant Compare At Price", "Image Src", "Image Position", "Status"],
    ["fair-isle-hat", "Fair Isle hat", "<p>Warm <b>wool</b> hat</p>", "Anderson", "Hats", "wool", "TRUE", "Title", "Default Title", "", "", "HAT-1", "shopify", "7", "25.00", "30.00", "https://cdn.shopify.com/a.jpg", "1", "active"],
    ["fair-isle-hat", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "https://cdn.shopify.com/b.jpg", "2", ""],
    ["gansey", "Gansey", "<p>Knit</p>", "Anderson", "Knitwear", "", "TRUE", "Size", "Small", "Colour", "Navy", "G-S-N", "shopify", "3", "85.00", "", "https://cdn.shopify.com/g.jpg", "1", "draft"],
    ["gansey", "", "", "", "", "", "", "", "Large", "", "Navy", "G-L-N", "shopify", "2", "95.00", "", "", "", ""],
  ];
  test("detects Shopify, WooCommerce, Square, our own template and unknown files", () => {
    assert.equal(detectPreset(shopify[0]), "shopify");
    assert.equal(detectPreset(["ID", "Type", "SKU", "Name", "Published", "In stock?", "Stock", "Regular price", "Sale price", "Categories", "Images", "Parent"]), "woocommerce");
    assert.equal(detectPreset(["Token", "Item Name", "Variation Name", "SKU", "Description", "Price", "Current Quantity Lerwick"]), "square");
    assert.equal(detectPreset(TEMPLATE_HEADERS), "oneshetland");
    assert.equal(detectPreset(["Product", "Cost", "Pic"]), "generic");
  });
  test("Shopify: single-variant product, multi-variant product, images in position order, HTML description, price = cheapest variant", () => {
    const rows = shopify.slice(1).map((c, i) => ({ rowNumber: i + 2, cells: c }));
    const canon = toCanonical(shopify[0], rows, "shopify");
    const pl = buildPlan(canon, []);
    assert.equal(pl.counts.found, 2);
    const hat = pl.items.find((i) => i.ref === "fair-isle-hat");
    assert.equal(hat.fields.price_pence, 2500); assert.equal(hat.fields.compare_at_pence, 3000); assert.equal(hat.fields.sku, "HAT-1"); assert.equal(hat.fields.stock, 7);
    assert.equal(hat.fields.description, "Warm wool hat");
    assert.deepEqual(hat.imageUrls, ["https://cdn.shopify.com/a.jpg", "https://cdn.shopify.com/b.jpg"]);
    assert.equal(hat.variants.length, 0);
    const g = pl.items.find((i) => i.ref === "gansey");
    assert.equal(g.fields.price_pence, 8500);
    assert.deepEqual(g.variants.map((v) => [v.name, v.price_delta_pence, v.stock, v.sku]), [["Small · Navy", 0, 3, "G-S-N"], ["Large · Navy", 1000, 2, "G-L-N"]]);
    assert.equal(g.fields.stock, undefined, "product stock stays on the variants");
    assert.ok(pl.items.every((i) => i.action === "create"));
  });
  test("WooCommerce: simple with a sale price, variable with variations resolved through Parent", () => {
    const h = ["ID", "Type", "SKU", "Name", "Published", "Description", "Short description", "Stock", "Regular price", "Sale price", "Categories", "Images", "Parent", "Attribute 1 name", "Attribute 1 value(s)"];
    const data = [
      ["10", "simple", "MUG", "Mug", "1", "<p>A mug</p>", "", "5", "15.00", "12.00", "Home", "https://x.example/m1.jpg, https://x.example/m2.jpg", "", "", ""],
      ["20", "variable", "JMP", "Jumper", "1", "Warm", "", "", "", "", "Knitwear", "https://x.example/j.jpg", "", "Size", "S, M"],
      ["21", "variation", "JMP-S", "Jumper - S", "1", "", "", "4", "80.00", "", "", "", "id:20", "Size", "S"],
      ["22", "variation", "JMP-M", "Jumper - M", "1", "", "", "6", "85.00", "", "", "", "id:20", "Size", "M"],
      ["30", "grouped", "GRP", "Bundle", "1", "", "", "", "", "", "", "", "", "", ""],
    ];
    const canon = toCanonical(h, data.map((c, i) => ({ rowNumber: i + 2, cells: c })), "woocommerce");
    const pl = buildPlan(canon, []);
    const mug = pl.items.find((i) => i.title === "Mug");
    assert.equal(mug.fields.price_pence, 1200); assert.equal(mug.fields.compare_at_pence, 1500); assert.equal(mug.imageUrls.length, 2);
    const j = pl.items.find((i) => i.title === "Jumper");
    assert.equal(j.fields.price_pence, 8000); assert.deepEqual(j.variants.map((v) => [v.name, v.price_delta_pence, v.stock]), [["S", 0, 4], ["M", 500, 6]]);
    assert.equal(pl.items.find((i) => i.ref === "30").action, "error");
    assert.match(pl.items.find((i) => i.ref === "30").errors[0].message, /not supported/);
  });
  test("Square: single 'Regular' variation, multiple variations, archived and service items skipped", () => {
    const h = ["Token", "Item Name", "Variation Name", "SKU", "Description", "Categories", "Item Type", "Price", "Archived", "Current Quantity Lerwick"];
    const data = [
      ["T1", "Tea towel", "Regular", "TT", "Linen", "Home", "Physical good", "9.00", "No", "10"],
      ["T2", "Print", "A4", "PR-A4", "Giclée", "Art", "Physical good", "20.00", "No", "5"],
      ["T2", "Print", "A3", "PR-A3", "Giclée", "Art", "Physical good", "30.00", "No", "2"],
      ["T3", "Old thing", "Regular", "OLD", "", "", "Physical good", "5.00", "Yes", "0"],
      ["T4", "Haircut", "Regular", "", "", "", "Appointment service", "25.00", "No", ""],
    ];
    const canon = toCanonical(h, data.map((c, i) => ({ rowNumber: i + 2, cells: c })), "square");
    const pl = buildPlan(canon, []);
    assert.equal(pl.items.find((i) => i.ref === "T1").fields.stock, 10);
    assert.deepEqual(pl.items.find((i) => i.ref === "T2").variants.map((v) => [v.name, v.price_delta_pence]), [["A4", 0], ["A3", 1000]]);
    assert.equal(pl.items.find((i) => i.ref === "T3").action, "skip");
    assert.equal(pl.items.find((i) => i.ref === "T4").action, "skip");
  });
  test("each preset states what it does not import (nothing is implied)", async () => {
    const { presetInfo } = await import("../lib/product-import/presets.ts");
    for (const id of ["shopify", "woocommerce", "square"]) { assert.ok(presetInfo(id).ignores.length >= 3, id); assert.ok(presetInfo(id).imports.length >= 4, id); }
    assert.ok(presetInfo("square").ignores.some((s) => /Images/.test(s)));
  });
});

describe("plan: acceptance cases", () => {
  test("1 · a simple 3-product file: three creates, defaults applied, nothing live-by-default", () => {
    const pl = plan(mk(
      { ref: "A", title: "Hat", price: "25", image_1: IMG },
      { ref: "B", title: "Scarf", price: "£30.00", category: "Knitwear", stock: "4", image_1: IMG },
      { ref: "C", title: "Mug", price: "9.5", category: "home" },
    ));
    assert.deepEqual(pl.counts, { found: 3, create: 3, update: 0, unchanged: 0, skip: 0, error: 0, warnings: 1 });
    const db = pl.items.map(toDbItem);
    assert.equal(db[0].payload.fields.stock_mode, "tracked");
    assert.equal(db[0].payload.fields.category, "other");
    assert.equal(db[1].payload.fields.category, "knitwear"); assert.equal(db[1].payload.fields.stock, 4); assert.equal(db[1].payload.fields.price_pence, 3000);
    assert.equal(db.every((d) => !("is_active" in d.payload.fields)), true);
    assert.equal(pl.items[2].publish, "needs_photo");
    assert.match(pl.items[2].warnings[0].message, /stay a draft/);
  });

  test("2 · repeating the same file against what the first import created: no creates, all unchanged", () => {
    const text = mk({ ref: "A", title: "Hat", price: "25", image_1: IMG });
    const first = plan(text);
    const it = first.items[0];
    const made = existing({ id: "p1", title: "Hat", external_ref: "A", price_pence: 2500, category: null, photos: ["https://x/p.jpg"], source_hash: it.hash, known_image_urls: [IMG] });
    const again = plan(text, [made]);
    assert.deepEqual(again.counts.create, 0);
    assert.equal(again.items[0].action, "unchanged");
    assert.equal(again.items[0].matchedBy, "ref");
  });

  test("2b · a ref-less repeat does not duplicate either: the title match skips it", () => {
    const text = mk({ title: "Hat", price: "25" });
    const made = existing({ title: "Hat", external_ref: null });
    const again = plan(text, [made]);
    assert.equal(again.items[0].action, "skip");
    assert.equal(again.counts.create, 0);
  });

  test("3 · a changed price and description on an existing imported product is an update with exact changes", () => {
    const text = mk({ ref: "HAT", title: "Fair Isle hat", price: "28", description: "<p>Warm</p>", image_1: IMG });
    const pl = plan(text, [existing({ photos: ["https://x/p.jpg"], source_hash: "old" })]);
    const it = pl.items[0];
    assert.equal(it.action, "update"); assert.equal(it.matchedBy, "ref"); assert.equal(it.targetProductId, "p1");
    assert.deepEqual(it.changes.map((c) => [c.field, c.from, c.to]), [["description", null, "Warm"], ["price_pence", 2500, 2800]]);
  });

  test("3b · a locked field is reported and never in the change list", () => {
    const text = mk({ ref: "HAT", title: "Fair Isle Hat Deluxe", price: "28" });
    const pl = plan(text, [existing({ source_locked_fields: ["title"], photos: ["https://x/p.jpg"] })]);
    const it = pl.items[0];
    assert.deepEqual(it.lockedSkipped, ["title"]);
    assert.deepEqual(it.changes.map((c) => c.field), ["price_pence"]);
  });

  test("4 · SKU and ref only ever match inside the business whose products were supplied", () => {
    const text = mk({ ref: "R9", sku: "SHARED-1", title: "Thing", price: "10" });
    const pl = plan(text, []);            // another business owns SHARED-1, but it is simply not passed in
    assert.equal(pl.items[0].action, "create");
    const same = plan(text, [existing({ sku: "shared-1", external_ref: null, external_source: null, title: "Other" })]);
    assert.equal(same.items[0].action, "update"); assert.equal(same.items[0].matchedBy, "sku");
  });

  test("5 · title-only similarity warns and does NOT merge; opt-in creates a new product", () => {
    const text = mk({ ref: "NEW1", title: "fair isle HAT", price: "25" });
    const e = [existing({ external_ref: "OTHER", title: "Fair Isle hat" })];
    const pl = plan(text, e);
    assert.equal(pl.items[0].action, "skip"); assert.equal(pl.items[0].matchedBy, "title");
    assert.equal(pl.items[0].targetProductId, null, "never a merge target");
    assert.equal(pl.items[0].warnings[0].code, "title_similar");
    const opt = plan(text, e, { allowTitleDuplicates: true });
    assert.equal(opt.items[0].action, "create"); assert.equal(opt.items[0].targetProductId, null);
  });

  test("6 · a product with 3 variants: absolute prices become deltas, flat names, per-variant stock and SKU", () => {
    const pl = plan(mk(
      { ref: "J", title: "Jumper", price: "85", variant_name: "Small", variant_price: "85", variant_stock: "3", variant_sku: "J-S", image_1: IMG },
      { ref: "J", variant_name: "Medium", variant_price: "85", variant_stock: "4", variant_sku: "J-M" },
      { ref: "J", variant_name: "Large", variant_price: "90", variant_stock: "2", variant_sku: "J-L" },
    ));
    const it = pl.items[0];
    assert.equal(pl.counts.found, 1); assert.equal(it.action, "create"); assert.deepEqual(it.rows, [2, 3, 4]);
    assert.deepEqual(it.variants.map((v) => [v.name, v.price_delta_pence, v.stock, v.sku]), [["Small", 0, 3, "J-S"], ["Medium", 0, 4, "J-M"], ["Large", 500, 2, "J-L"]]);
    assert.equal(toDbItem(it).payload.fields.stock, undefined);
  });

  test("7 · variant stock rules: bad stock is an error; product stock plus variants is an error", () => {
    let pl = plan(mk({ ref: "J", title: "J", price: "10", variant_name: "S", variant_stock: "-1" }));
    assert.equal(pl.items[0].action, "error"); assert.match(pl.items[0].errors[0].message, /whole number/);
    pl = plan(mk({ ref: "J", title: "J", price: "10", stock: "5", variant_name: "S", variant_stock: "2" }));
    assert.equal(pl.items[0].action, "error"); assert.match(pl.items[0].errors.map((e) => e.message).join(" "), /stock goes on each variant/);
  });

  test("8 · invalid and too-low prices are errors with the row number and the reason", () => {
    const pl = plan(mk({ ref: "A", title: "A", price: "abc" }, { ref: "B", title: "B", price: "0.10" }, { ref: "C", title: "C", price: "$5" }, { ref: "D", title: "D" }));
    assert.deepEqual(pl.items.map((i) => i.action), ["error", "error", "error", "error"]);
    assert.match(pl.items[0].errors[0].message, /Row 2: price/);
    assert.match(pl.items[1].errors[0].message, /below the £0\.50 minimum/);
    assert.match(pl.items[2].errors[0].message, /GBP/);
    assert.match(pl.items[3].errors[0].message, /price is required/);
  });

  test("compare-at must be above the price", () => {
    const pl = plan(mk({ ref: "A", title: "A", price: "10", compare_at_price: "10" }));
    assert.equal(pl.items[0].action, "error"); assert.match(pl.items[0].errors[0].message, /must be higher/);
  });

  test("9 · an unknown category is an error listing the valid ones", () => {
    const pl = plan(mk({ ref: "A", title: "A", price: "10", category: "Gadgets" }));
    assert.equal(pl.items[0].action, "error"); assert.match(pl.items[0].errors[0].message, /knitwear/);
  });

  test("10 · a missing title is an error; an over-long title and variant name are errors", () => {
    let pl = plan(mk({ ref: "A", price: "10" }));
    assert.equal(pl.items[0].action, "error"); assert.match(pl.items[0].errors[0].message, /title is missing/);
    pl = plan(mk({ ref: "A", title: "x".repeat(201), price: "10" }));
    assert.match(pl.items[0].errors[0].message, /limit is 200/);
    pl = plan(mk({ ref: "A", title: "A", price: "10", variant_name: "v".repeat(81) }));
    assert.match(pl.items[0].errors[0].message, /limit is 80/);
  });

  test("11 · bad image URLs are row errors: http, javascript:, data:, SVG, credentials, junk", () => {
    for (const bad of ["http://a.example/x.jpg", "javascript:alert(1)", "data:image/png;base64,AAAA", "https://a.example/x.svg", "https://u:p@a.example/x.jpg", "nope"]) {
      const pl = plan(mk({ ref: "A", title: "A", price: "10", image_1: bad }));
      assert.equal(pl.items[0].action, "error", bad);
      assert.equal(pl.items[0].errors[0].code, "image_url_invalid");
    }
  });

  test("12 · duplicate SKU or conflicting ref inside the file are errors on every row involved", () => {
    let pl = plan(mk({ ref: "A", sku: "S1", title: "A", price: "10" }, { ref: "B", sku: "s1", title: "B", price: "10" }));
    assert.deepEqual(pl.items.map((i) => i.action), ["error", "error"]);
    assert.match(pl.items[0].errors[0].message, /different products/);
    pl = plan(mk({ ref: "A", title: "A", price: "10" }, { ref: "A", title: "Different", price: "10", variant_name: "x" }));
    assert.equal(pl.items[0].action, "error"); assert.match(pl.items[0].errors[0].message, /different title/);
    pl = plan(mk({ ref: "A", title: "A", price: "10" }, { ref: "A", title: "A", price: "10" }));
    assert.equal(pl.items[0].action, "error"); assert.match(pl.items[0].errors[0].message, /repeats ref/);
    pl = plan(mk({ title: "Same", price: "10" }, { title: "same", price: "11" }));
    assert.deepEqual(pl.items.map((i) => i.action), ["error", "error"]); assert.match(pl.items[0].errors[0].message, /no ref/);
    pl = plan(mk({ ref: "A", title: "A", price: "10", variant_name: "S", variant_sku: "X" }, { ref: "A", variant_name: "M", variant_sku: "x" }));
    assert.equal(pl.items[0].action, "error");
  });

  test("12b · a ref that matches one product and a SKU that matches another is an error, not a guess", () => {
    const e = [existing({ id: "p1", external_ref: "HAT", sku: null }), existing({ id: "p2", title: "Scarf", external_ref: "SCARF", sku: "SC-1" })];
    const pl = plan(mk({ ref: "HAT", sku: "SC-1", title: "Hat", price: "10" }), e);
    assert.equal(pl.items[0].action, "error"); assert.match(pl.items[0].errors[0].message, /must refer to the same product/);
  });

  test("13 · restricted goods: a vape is blocked (error); a gin is allowed as a draft with a review warning and cannot be 'ready'", () => {
    const pl = plan(mk({ ref: "V", title: "Fruit vape 20mg", price: "10", image_1: IMG }, { ref: "G", title: "Shetland gin", price: "30", image_1: IMG }, { ref: "K", title: "Cheese board", price: "20", image_1: IMG }));
    assert.equal(pl.items[0].action, "error"); assert.equal(pl.items[0].errors[0].code, "policy_blocked");
    assert.equal(pl.items[1].action, "create"); assert.equal(pl.items[1].publish, "needs_review"); assert.equal(pl.items[1].warnings.some((w) => w.code === "policy_review"), true);
    assert.equal(pl.items[2].publish, "ready");
  });

  test("15 · nothing in a planned item can make a product live", () => {
    const pl = plan(mk({ ref: "A", title: "A", price: "10", image_1: IMG }));
    const db = toDbItem(pl.items[0]);
    assert.equal(JSON.stringify(db).includes("is_active"), false);
  });

  test("stock mode rules: one-off with variants is an error; stock on made-to-order is ignored with a warning; lead time only for made-to-order", () => {
    let pl = plan(mk({ ref: "A", title: "A", price: "10", stock_mode: "one_off", variant_name: "x" }));
    assert.equal(pl.items[0].action, "error");
    pl = plan(mk({ ref: "A", title: "A", price: "10", stock_mode: "made_to_order", stock: "5" }));
    assert.equal(pl.items[0].action, "create"); assert.equal(pl.items[0].warnings.some((w) => w.code === "stock_ignored"), true);
    assert.equal(toDbItem(pl.items[0]).payload.fields.lead_time_days, 14);
    assert.equal(toDbItem(pl.items[0]).payload.fields.stock, undefined);
  });

  test("an update never carries a field the file did not provide, and variant price is relative to the product price that will exist", () => {
    const pl = plan(mk({ ref: "HAT", title: "Fair Isle hat", price: "30", variant_name: "L", variant_price: "35" }), [existing({ source_locked_fields: ["price_pence"], photos: ["https://x/p.jpg"] })]);
    const db = toDbItem(pl.items[0]);
    assert.equal(db.action, "update");
    assert.equal(db.payload.fields.description, undefined);
    assert.equal(db.payload.variants[0].price_delta_pence, 1000, "35.00 against the locked existing 25.00, not against the file's 30.00");
  });

  test("update safety: stock below reserved, stock on a variant product, and a variant below reserved are errors", () => {
    const base = existing({ photos: ["https://x/p.jpg"], reserved: 6, stock: 10 });
    let pl = plan(mk({ ref: "HAT", title: "Fair Isle hat", price: "25", stock: "4" }), [base]);
    assert.equal(pl.items[0].action, "error"); assert.match(pl.items[0].errors[0].message, /below the 6/);
    const withVars = existing({ photos: ["https://x/p.jpg"], stock: null, variants: [{ id: "v1", name: "S", sku: "S1", price_delta_pence: 0, stock: 9, reserved: 5, is_active: true }] });
    pl = plan(mk({ ref: "HAT", title: "Fair Isle hat", price: "25", stock: "4" }), [withVars]);
    assert.match(pl.items[0].errors[0].message, /has variants/);
    pl = plan(mk({ ref: "HAT", title: "Fair Isle hat", price: "25", variant_name: "S", variant_sku: "S1", variant_stock: "2" }), [withVars]);
    assert.equal(pl.items[0].action, "error"); assert.match(pl.items[0].errors[0].message, /below the 5/);
  });

  test("variants left out of the file are untouched (the plan never lists a removal)", () => {
    const withVars = existing({ photos: ["https://x/p.jpg"], stock: null, variants: [
      { id: "v1", name: "S", sku: "S1", price_delta_pence: 0, stock: 9, reserved: 0, is_active: true },
      { id: "v2", name: "M", sku: "M1", price_delta_pence: 0, stock: 9, reserved: 0, is_active: true }] });
    const pl = plan(mk({ ref: "HAT", title: "Fair Isle hat", price: "25", variant_name: "S", variant_sku: "S1", variant_stock: "9" }), [withVars]);
    assert.equal(pl.items[0].action, "unchanged");
    assert.equal(JSON.stringify(pl.items[0]).includes("remove"), false);
  });

  test("a product with no photo is retried when the same file is imported again with image URLs", () => {
    const text = mk({ ref: "HAT", title: "Fair Isle hat", price: "25", image_1: IMG, category: "knitwear" });
    const first = plan(text);
    const noPhoto = existing({ photos: [], source_hash: first.items[0].hash });
    const again = plan(text, [noPhoto]);
    assert.equal(again.items[0].action, "update"); assert.equal(again.items[0].willFetchImages, true);
  });

  test("template example rows are called out", () => {
    const text = toCsv([TEMPLATE_HEADERS, ...TEMPLATE_ROWS]);
    const pl = buildPlan(load(text).rows, []);
    assert.equal(pl.counts.found, 2);
    assert.ok(pl.items.every((i) => i.warnings.some((w) => w.code === "template_example")));
  });

  test("mapping a foreign file by hand works and unmapped columns are ignored", () => {
    const text = "Product,Cost,Pic,Notes\nMug,£9,https://a.example/m.jpg,secret\n";
    const p = parseCsvFile(enc(text));
    const m = suggestMapping(p.headers);
    assert.equal(m.title, 0); assert.equal(m.price, 1);
    const canon = applyMapping(p.rows, { title: 0, price: 1, image_1: 2 });
    const pl = buildPlan(canon, []);
    assert.equal(pl.items[0].fields.price_pence, 900);
    assert.equal(JSON.stringify(pl.items[0]).includes("secret"), false);
  });

  test("a variant row with no parent says so: no ref at all, or a ref with no product row", () => {
    let pl = plan(mk({ variant_name: "Large", variant_price: "22" }));
    assert.equal(pl.items[0].action, "error"); assert.equal(pl.items[0].errors[0].code, "variant_no_parent");
    assert.match(pl.items[0].errors[0].message, /no product ref/);
    pl = plan(mk({ ref: "TEE", variant_name: "Large", variant_price: "22" }));
    assert.equal(pl.items[0].errors[0].code, "variant_no_parent"); assert.match(pl.items[0].errors[0].message, /no product row/);
  });

  test("the Shetland T-shirt: absolute variant prices become deltas against the £20 base; SKUs and stock ride along", () => {
    const pl = plan(mk(
      { ref: "TEE", title: "Shetland T-shirt", price: "20", variant_name: "Small · Navy", variant_price: "20", variant_stock: "5", variant_sku: "TEE-S-NVY", image_1: IMG },
      { ref: "TEE", variant_name: "Medium · Navy", variant_price: "20", variant_stock: "6", variant_sku: "TEE-M-NVY" },
      { ref: "TEE", variant_name: "Large · Navy", variant_price: "22", variant_stock: "2", variant_sku: "TEE-L-NVY" },
    ));
    const it = pl.items[0];
    assert.equal(it.action, "create"); assert.equal(it.fields.price_pence, 2000);
    assert.deepEqual(it.variants.map((v) => [v.name, v.price_delta_pence, v.stock, v.sku]), [["Small · Navy", 0, 5, "TEE-S-NVY"], ["Medium · Navy", 0, 6, "TEE-M-NVY"], ["Large · Navy", 200, 2, "TEE-L-NVY"]]);
    assert.equal(toDbItem(it).payload.fields.stock, undefined, "no product-level stock alongside variant stock");
  });

  test("a renamed product with the same ref is an UPDATE of that product (and the new title is the change), not a new product", () => {
    const pl = plan(mk({ ref: "HAT", title: "Fair Isle beanie", price: "25", image_1: IMG }), [existing({ photos: ["https://x/p.jpg"] })]);
    assert.equal(pl.items[0].action, "update"); assert.equal(pl.items[0].matchedBy, "ref");
    assert.deepEqual(pl.items[0].changes.map((c) => [c.field, c.from, c.to]).filter((c) => c[0] === "title"), [["title", "Fair Isle hat", "Fair Isle beanie"]]);
  });

  test("the instructions file travels with the template and names every column", () => {
    const t = templateInstructions();
    for (const w of ["title", "price", "ref", "variant_name", "image_1", "CSV UTF-8", "draft"]) assert.ok(t.includes(w), w);
    assert.doesNotMatch(t, /external_ref|idempotent|normalis/i);
    assert.ok(TEMPLATE_ROWS.every((r) => r.length === TEMPLATE_HEADERS.length), "every example row has one cell per column");
  });

  test("a repeat import never downloads a picture it already copied; only new addresses are fetched", () => {
    const e = existing({ photos: ["https://x/p.jpg"], known_image_urls: [IMG] });
    let pl = plan(mk({ ref: "HAT", title: "Fair Isle hat", price: "28", image_1: IMG }), [e]);
    assert.equal(pl.items[0].action, "update"); assert.equal(pl.items[0].willFetchImages, false);
    assert.deepEqual(toDbItem(pl.items[0]).payload.image_urls, []);
    pl = plan(mk({ ref: "HAT", title: "Fair Isle hat", price: "25", image_1: IMG, category: "knitwear" }), [e]);
    assert.equal(pl.items[0].action, "unchanged");
    const csv = toCsv([HEAD.slice(0, 7).concat("image_2"), ["HAT", "", "Fair Isle hat", "25", "knitwear", "", IMG, "https://cdn.example.com/b.jpg"]]);
    pl = buildPlan(load(csv).rows, [e]);
    assert.equal(pl.items[0].willFetchImages, true); assert.deepEqual(toDbItem(pl.items[0]).payload.image_urls, ["https://cdn.example.com/b.jpg"]);
  });
});

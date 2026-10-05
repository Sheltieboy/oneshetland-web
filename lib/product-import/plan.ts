/**
 * plan.ts — turns canonical rows into an import PLAN: for every product in the
 * file, what would happen (create / update / unchanged / skip / error), why,
 * and which rows and fields are responsible. Nothing here touches a database:
 * the caller supplies the business's existing products, and the plan is a
 * value that can be shown, filtered, downloaded, and only later confirmed.
 *
 * SERVER-SIDE: it hashes with node:crypto. Client code imports types only.
 *
 * Matching is deterministic and confined to the one business whose products
 * were passed in:
 *   1. external source + ref        → update
 *   2. SKU (case-insensitive)       → update
 *   3. normalised title             → WARNING; the row is skipped unless the
 *                                     merchant opts in. Never an automatic merge.
 * A SKU or ref used incompatibly — twice in the file, or pointing at two
 * different existing products — is an error on every row involved.
 */
import { createHash } from 'node:crypto';
import { LIMITS, IMAGE_COLUMNS, TEMPLATE_EXAMPLE_PREFIX, type Field } from './columns.ts';
import {
  parseMoney, parseInt0, parseBool, parseStockMode, parseCategory, parseImageUrl, type Parsed,
} from './normalise.ts';
import { toPlainText, toPlainLine, normTitle } from './text.ts';
import { screenText, type PolicyHit } from './restricted.ts';
import type { CanonicalRow } from './presets.ts';

/* ── Types ───────────────────────────────────────────────────────────────── */

export interface Issue { row?: number; field?: string; code: string; message: string }

export type Action = 'create' | 'update' | 'unchanged' | 'skip' | 'error';

export interface ItemVariant {
  name: string;
  /** Absolute price as written in the file, in pence (kept so the delta can be recomputed against the effective product price). */
  price_pence: number | null;
  price_delta_pence: number;
  stock?: number | null;
  sku?: string;
  row: number;
}

/** Product-level values the file PROVIDED. Absent = not provided = never overwritten on update. */
export interface ItemFields {
  title?: string;
  description?: string;
  category?: string;
  price_pence?: number;
  compare_at_pence?: number;
  stock_mode?: 'tracked' | 'made_to_order' | 'one_off';
  stock?: number | null;
  lead_time_days?: number;
  collect_only?: boolean;
  free_uk_post?: boolean;
  sku?: string;
}

export interface ExistingVariant { id: string; name: string; sku: string | null; price_delta_pence: number; stock: number | null; reserved: number; is_active: boolean }
export interface ExistingProduct {
  id: string; title: string; sku: string | null; external_source: string | null; external_ref: string | null;
  description: string | null; category: string | null; price_pence: number; compare_at_pence: number | null;
  stock_mode: string; stock: number | null; lead_time_days: number | null; collect_only: boolean; free_uk_post: boolean;
  photos: string[]; is_active: boolean; reserved: number; source_hash: string | null; source_locked_fields: string[];
  variants: ExistingVariant[];
}

export interface PlanChange { field: string; from: unknown; to: unknown }

export interface PlanItem {
  index: number;
  rows: number[];
  action: Action;
  title: string;
  ref: string | null;
  sku: string | null;
  matchedBy: 'ref' | 'sku' | 'title' | null;
  targetProductId: string | null;
  targetTitle: string | null;
  fields: ItemFields;
  variants: ItemVariant[];
  imageUrls: string[];
  hash: string;
  changes: PlanChange[];
  variantChanges: { name: string; kind: 'new' | 'changed'; detail?: string }[];
  lockedSkipped: string[];
  willFetchImages: boolean;
  /** After import + images: can it be published, or is something missing? */
  publish: 'ready' | 'needs_photo' | 'needs_review' | 'blocked' | 'not_applicable';
  errors: Issue[];
  warnings: Issue[];
  policy: PolicyHit[];
}

export interface PlanCounts { found: number; create: number; update: number; unchanged: number; skip: number; error: number; warnings: number }

export interface Plan { items: PlanItem[]; counts: PlanCounts; fileRows: number }

export interface PlanOptions { allowTitleDuplicates?: boolean }

/* ── Step A: validate rows and group into items ──────────────────────────── */

interface Draft {
  rows: number[];
  ref: string | null;
  fields: ItemFields;
  variants: ItemVariant[];
  imageUrls: string[];
  errors: Issue[];
  warnings: Issue[];
  skip?: string;
  titleRaw: string;
  descRaw: string;
  categoryRaw: string;
}

const PRODUCT_FIELDS: Field[] = ['sku', 'title', 'description', 'category', 'price', 'compare_at_price', 'stock_mode', 'stock', 'lead_time_days', 'collect_only', 'free_uk_post'];

function groupRows(rows: CanonicalRow[]): CanonicalRow[][] {
  const groups: CanonicalRow[][] = [];
  const byRef = new Map<string, CanonicalRow[]>();
  for (const r of rows) {
    const ref = (r.v.ref ?? '').trim();
    if (!ref) { groups.push([r]); continue; }
    const k = ref.toLowerCase();
    const g = byRef.get(k);
    if (g) g.push(r); else { const ng = [r]; byRef.set(k, ng); groups.push(ng); }
  }
  return groups;
}

const val = (r: CanonicalRow, f: Field) => (r.v[f] ?? '').trim();
const hasVariant = (r: CanonicalRow) => !!(val(r, 'variant_name') || val(r, 'variant_price') || val(r, 'variant_stock') || val(r, 'variant_sku'));

function draftGroup(g: CanonicalRow[]): Draft {
  const first = g[0];
  const d: Draft = {
    rows: g.map((r) => r.rowNumber), ref: val(first, 'ref') || null, fields: {}, variants: [], imageUrls: [],
    errors: [], warnings: [], titleRaw: '', descRaw: '', categoryRaw: '',
  };
  const err = (row: number | undefined, field: string | undefined, code: string, message: string) => d.errors.push({ row, field, code, message });
  const warn = (row: number | undefined, field: string | undefined, code: string, message: string) => d.warnings.push({ row, field, code, message });

  for (const r of g) {
    if (r.preError) err(r.rowNumber, undefined, 'source_unsupported', r.preError);
    for (const n of r.notes ?? []) warn(r.rowNumber, undefined, 'note', n);
  }
  const skipped = g.find((r) => r.preSkip);
  if (skipped) d.skip = skipped.preSkip;
  if (d.errors.length || d.skip) { d.titleRaw = val(first, 'title'); return d; }

  /* Product-level fields: the first non-blank value wins, a later different one is a conflict. */
  const merged: Partial<Record<Field, { v: string; row: number }>> = {};
  for (const r of g) {
    for (const f of PRODUCT_FIELDS) {
      const v = val(r, f);
      if (!v) continue;
      const have = merged[f];
      if (!have) { merged[f] = { v, row: r.rowNumber }; continue; }
      const same = f === 'title' ? normTitle(v) === normTitle(have.v) : v.toLowerCase() === have.v.toLowerCase();
      if (!same) err(r.rowNumber, f, 'ref_conflict', `Row ${r.rowNumber} gives a different ${f.replace(/_/g, ' ')} ("${v.slice(0, 60)}") from row ${have.row} for the same ref "${d.ref}". Rows that share a ref must agree about the product, and differ only in their variant columns.`);
    }
  }
  // Rows after the first that are not variants repeat a ref for no reason.
  g.slice(1).forEach((r) => {
    if (!hasVariant(r)) err(r.rowNumber, 'ref', 'ref_repeated', `Row ${r.rowNumber} repeats ref "${d.ref}" but has no variant_name. A repeated ref means "another variant of the same product".`);
  });

  /* Title */
  const titleM = merged.title;
  if (!titleM) err(first.rowNumber, 'title', 'title_missing', `Row ${first.rowNumber}: title is required.`);
  else {
    d.titleRaw = titleM.v;
    const t = toPlainLine(titleM.v);
    if (!t) err(titleM.row, 'title', 'title_missing', `Row ${titleM.row}: title is required.`);
    else if (t.length > LIMITS.titleMax) err(titleM.row, 'title', 'title_long', `Row ${titleM.row}: title is ${t.length} characters; the limit is ${LIMITS.titleMax}.`);
    else d.fields.title = t;
    if (t.startsWith(TEMPLATE_EXAMPLE_PREFIX)) warn(titleM.row, 'title', 'template_example', `Row ${titleM.row}: this looks like an example row from the template.`);
  }

  /* Price */
  let basePence: number | null = null;
  const priceM = merged.price;
  if (!priceM) err(first.rowNumber, 'price', 'price_missing', `Row ${first.rowNumber}: price is required.`);
  else {
    const p = parseMoney(priceM.v);
    if (!p.ok) err(priceM.row, 'price', 'price_invalid', `Row ${priceM.row}: price ${p.message}.`);
    else if (p.value < LIMITS.minPricePence) err(priceM.row, 'price', 'price_low', `Row ${priceM.row}: price £${(p.value / 100).toFixed(2)} is below the £0.50 minimum.`);
    else { basePence = p.value; d.fields.price_pence = p.value; }
  }
  const cmpM = merged.compare_at_price;
  if (cmpM) {
    const c = parseMoney(cmpM.v);
    if (!c.ok) err(cmpM.row, 'compare_at_price', 'compare_invalid', `Row ${cmpM.row}: compare-at price ${c.message}.`);
    else if (basePence !== null && c.value <= basePence) err(cmpM.row, 'compare_at_price', 'compare_low', `Row ${cmpM.row}: compare-at price £${(c.value / 100).toFixed(2)} must be higher than the price £${(basePence / 100).toFixed(2)}.`);
    else d.fields.compare_at_pence = c.value;
  }

  /* Description (plain text) */
  const descM = merged.description;
  if (descM) {
    d.descRaw = descM.v;
    let t = toPlainText(descM.v);
    if (t.length > LIMITS.descriptionMax) { t = t.slice(0, LIMITS.descriptionMax).trimEnd(); warn(descM.row, 'description', 'description_truncated', `Row ${descM.row}: description was longer than ${LIMITS.descriptionMax} characters and has been shortened.`); }
    if (t) d.fields.description = t;
  }

  /* Category */
  const catM = merged.category;
  if (catM) {
    d.categoryRaw = catM.v;
    const c = parseCategory(catM.v);
    if (!c.ok) err(catM.row, 'category', 'category_invalid', `Row ${catM.row}: ${c.message}.`);
    else d.fields.category = c.value;
  }

  /* SKU */
  const skuM = merged.sku;
  if (skuM) {
    const sku = toPlainLine(skuM.v);
    if (sku.length > LIMITS.skuMax) err(skuM.row, 'sku', 'sku_long', `Row ${skuM.row}: SKU is longer than ${LIMITS.skuMax} characters.`);
    else d.fields.sku = sku;
  }
  if (d.ref && d.ref.length > LIMITS.refMax) err(first.rowNumber, 'ref', 'ref_long', `Row ${first.rowNumber}: ref is longer than ${LIMITS.refMax} characters.`);

  /* Variants */
  const variantRows = g.filter(hasVariant);
  const seenNames = new Set<string>();
  const seenSkus = new Set<string>();
  for (const r of variantRows) {
    const rawName = val(r, 'variant_name');
    const name = toPlainLine(rawName);
    if (!name) { err(r.rowNumber, 'variant_name', 'variant_name_missing', `Row ${r.rowNumber}: a variant needs a variant_name.`); continue; }
    if (name.length > LIMITS.variantNameMax) { err(r.rowNumber, 'variant_name', 'variant_name_long', `Row ${r.rowNumber}: variant name "${name.slice(0, 30)}…" is ${name.length} characters; the limit is ${LIMITS.variantNameMax}.`); continue; }
    if (seenNames.has(name.toLowerCase())) { err(r.rowNumber, 'variant_name', 'variant_duplicate', `Row ${r.rowNumber}: variant "${name}" appears twice for this product.`); continue; }
    seenNames.add(name.toLowerCase());
    const v: ItemVariant = { name, price_pence: null, price_delta_pence: 0, row: r.rowNumber };
    const vp = val(r, 'variant_price');
    if (vp) {
      const m = parseMoney(vp);
      if (!m.ok) err(r.rowNumber, 'variant_price', 'variant_price_invalid', `Row ${r.rowNumber}: variant price ${m.message}.`);
      else if (m.value < LIMITS.minPricePence) err(r.rowNumber, 'variant_price', 'variant_price_low', `Row ${r.rowNumber}: variant price £${(m.value / 100).toFixed(2)} is below the £0.50 minimum.`);
      else { v.price_pence = m.value; if (basePence !== null) v.price_delta_pence = m.value - basePence; }
    }
    const vs = val(r, 'variant_stock');
    if (vs) {
      const s = parseInt0(vs, 'Variant stock', LIMITS.stockMax);
      if (!s.ok) err(r.rowNumber, 'variant_stock', 'variant_stock_invalid', `Row ${r.rowNumber}: ${s.message}.`);
      else v.stock = s.value;
    }
    const vk = val(r, 'variant_sku');
    if (vk) {
      const sku = toPlainLine(vk);
      if (sku.length > LIMITS.skuMax) err(r.rowNumber, 'variant_sku', 'sku_long', `Row ${r.rowNumber}: variant SKU is longer than ${LIMITS.skuMax} characters.`);
      else if (seenSkus.has(sku.toLowerCase())) err(r.rowNumber, 'variant_sku', 'sku_duplicate', `Row ${r.rowNumber}: variant SKU "${sku}" is used twice for this product.`);
      else { seenSkus.add(sku.toLowerCase()); v.sku = sku; }
    }
    d.variants.push(v);
  }
  if (d.variants.length > LIMITS.maxVariants) err(first.rowNumber, 'variant_name', 'too_many_variants', `This product has ${d.variants.length} variants; the limit is ${LIMITS.maxVariants}.`);
  const cheapest = d.variants.find((v) => v.price_pence !== null && v.price_pence < (basePence ?? 0));
  if (cheapest) warn(cheapest.row, 'variant_price', 'variant_below_base', `Row ${cheapest.row}: variant "${cheapest.name}" is cheaper than the product price, so it is stored as a discount from it.`);

  /* Stock mode and stock: the product keeps stock, or its variants do — never both. */
  const modeM = merged.stock_mode;
  if (modeM) {
    const m = parseStockMode(modeM.v);
    if (!m.ok) err(modeM.row, 'stock_mode', 'stock_mode_invalid', `Row ${modeM.row}: ${m.message}.`);
    else d.fields.stock_mode = m.value;
  }
  const mode = d.fields.stock_mode;
  const stockM = merged.stock;
  if (stockM) {
    const s = parseInt0(stockM.v, 'Stock', LIMITS.stockMax);
    if (!s.ok) err(stockM.row, 'stock', 'stock_invalid', `Row ${stockM.row}: ${s.message}.`);
    else if (d.variants.length) err(stockM.row, 'stock', 'stock_conflict', `Row ${stockM.row}: this product has variants, so stock goes on each variant (variant_stock), not on the product.`);
    else if (mode && mode !== 'tracked') warn(stockM.row, 'stock', 'stock_ignored', `Row ${stockM.row}: stock is ignored for ${mode === 'one_off' ? 'one-off' : 'made-to-order'} products.`);
    else d.fields.stock = s.value;
  }
  if (mode === 'one_off' && d.variants.length) err(first.rowNumber, 'stock_mode', 'one_off_variants', `Row ${first.rowNumber}: a one-off item cannot have variants.`);
  const leadM = merged.lead_time_days;
  if (leadM) {
    const l = parseInt0(leadM.v, 'Lead time', LIMITS.leadTimeMax);
    if (!l.ok) err(leadM.row, 'lead_time_days', 'lead_invalid', `Row ${leadM.row}: ${l.message}.`);
    else if (l.value < LIMITS.leadTimeMin || l.value > LIMITS.leadTimeMax) err(leadM.row, 'lead_time_days', 'lead_range', `Row ${leadM.row}: lead time must be between ${LIMITS.leadTimeMin} and ${LIMITS.leadTimeMax} days.`);
    else if (mode && mode !== 'made_to_order') warn(leadM.row, 'lead_time_days', 'lead_ignored', `Row ${leadM.row}: lead time only applies to made-to-order products and is ignored.`);
    else d.fields.lead_time_days = l.value;
  }
  for (const f of ['collect_only', 'free_uk_post'] as const) {
    const m = merged[f];
    if (!m) continue;
    const b: Parsed<boolean> = parseBool(m.v, f === 'collect_only' ? 'Collect only' : 'Free UK postage');
    if (!b.ok) err(m.row, f, `${f}_invalid`, `Row ${m.row}: ${b.message}.`);
    else d.fields[f] = b.value;
  }

  /* Images */
  const urls: string[] = [];
  for (const r of g) {
    for (const col of IMAGE_COLUMNS) {
      const raw = val(r, col);
      if (!raw) continue;
      const u = parseImageUrl(raw);
      if (!u.ok) err(r.rowNumber, col, 'image_url_invalid', `Row ${r.rowNumber}: ${col.replace('_', ' ')} ${u.message}.`);
      else if (!urls.includes(u.value)) urls.push(u.value);
    }
  }
  d.imageUrls = urls.slice(0, LIMITS.maxImages);

  return d;
}

/* ── Step B+C: in-file conflicts, matching, diff ─────────────────────────── */

export function sha256(s: string): string { return createHash('sha256').update(s).digest('hex'); }

const stable = (v: unknown): string => JSON.stringify(v, (_k, x) =>
  x && typeof x === 'object' && !Array.isArray(x) ? Object.fromEntries(Object.entries(x as object).sort(([a], [b]) => a.localeCompare(b))) : x);

export function itemHash(fields: ItemFields, variants: ItemVariant[], imageUrls: string[]): string {
  return sha256(stable({ fields, variants: variants.map((v) => ({ n: v.name.toLowerCase(), p: v.price_pence, s: v.stock ?? null, k: v.sku ?? null })), imageUrls }));
}

const DIFF_FIELDS: [keyof ItemFields, keyof ExistingProduct, string][] = [
  ['title', 'title', 'title'], ['description', 'description', 'description'], ['category', 'category', 'category'],
  ['price_pence', 'price_pence', 'price_pence'], ['compare_at_pence', 'compare_at_pence', 'compare_at_pence'],
  ['stock_mode', 'stock_mode', 'stock_mode'], ['stock', 'stock', 'stock'], ['lead_time_days', 'lead_time_days', 'lead_time_days'],
  ['collect_only', 'collect_only', 'collect_only'], ['free_uk_post', 'free_uk_post', 'free_uk_post'], ['sku', 'sku', 'sku'],
];

export function buildPlan(rows: CanonicalRow[], existing: ExistingProduct[], opts: PlanOptions = {}): Plan {
  const groups = groupRows(rows);
  const drafts = groups.map(draftGroup);

  /* B. The same title with no ref: ambiguous, because variants cannot be grouped without a ref. */
  const refless = new Map<string, Draft[]>();
  for (const d of drafts) {
    if (d.ref || !d.fields.title) continue;
    const k = normTitle(d.fields.title);
    (refless.get(k) ?? refless.set(k, []).get(k)!).push(d);
  }
  for (const [, ds] of refless) {
    if (ds.length < 2) continue;
    for (const d of ds) d.errors.push({ row: d.rows[0], field: 'ref', code: 'title_repeated_no_ref',
      message: `Row ${d.rows[0]}: "${d.fields.title}" appears on ${ds.length} rows with no ref. Add a ref column so variants are grouped, or give the products different titles.` });
  }

  /* B. SKU used by two different products in the file (product SKUs and variant SKUs share one namespace). */
  const skuOwners = new Map<string, Draft[]>();
  const claim = (sku: string | undefined, d: Draft) => {
    if (!sku) return;
    const k = sku.toLowerCase();
    const list = skuOwners.get(k) ?? [];
    if (!list.includes(d)) list.push(d);
    skuOwners.set(k, list);
  };
  for (const d of drafts) { claim(d.fields.sku, d); d.variants.forEach((v) => claim(v.sku, d)); }
  for (const [k, ds] of skuOwners) {
    if (ds.length < 2) continue;
    for (const d of ds) d.errors.push({ row: d.rows[0], field: 'sku', code: 'sku_duplicate_in_file',
      message: `SKU "${k}" is used by ${ds.length} different products in this file (rows ${ds.map((x) => x.rows[0]).join(', ')}). Each SKU must belong to one product.` });
  }

  /* C. Matching and the diff, one item at a time. */
  const byRef = new Map<string, ExistingProduct>();
  const bySku = new Map<string, ExistingProduct>();
  const byTitle = new Map<string, ExistingProduct[]>();
  for (const e of existing) {
    if (e.external_source === 'csv' && e.external_ref) byRef.set(e.external_ref, e);
    if (e.sku) bySku.set(e.sku.toLowerCase(), e);
    const k = normTitle(e.title);
    (byTitle.get(k) ?? byTitle.set(k, []).get(k)!).push(e);
  }

  const items: PlanItem[] = drafts.map((d, index) => {
    const warnings = [...d.warnings];
    const errors = [...d.errors];
    const policy = screenText(d.fields.title ?? d.titleRaw, d.fields.description ?? toPlainText(d.descRaw), d.categoryRaw);
    for (const h of policy) {
      if (h.level === 'block') errors.push({ row: d.rows[0], field: 'title', code: 'policy_blocked', message: `Row ${d.rows[0]}: "${h.term}" — ${h.reason}. See the Selling Policy.` });
      else warnings.push({ row: d.rows[0], field: 'title', code: 'policy_review', message: `Row ${d.rows[0]}: "${h.term}" — ${h.reason}. It will import as a draft; you will be asked to confirm before it can be published.` });
    }

    const item: PlanItem = {
      index, rows: d.rows, action: 'create', title: d.fields.title ?? d.titleRaw, ref: d.ref, sku: d.fields.sku ?? null,
      matchedBy: null, targetProductId: null, targetTitle: null, fields: d.fields, variants: d.variants, imageUrls: d.imageUrls,
      hash: itemHash(d.fields, d.variants, d.imageUrls), changes: [], variantChanges: [], lockedSkipped: [], willFetchImages: d.imageUrls.length > 0,
      publish: 'not_applicable', errors, warnings, policy,
    };

    if (d.skip) { item.action = 'skip'; item.warnings.push({ row: d.rows[0], code: 'skipped_by_source', message: d.skip }); return item; }
    if (errors.length) { item.action = 'error'; item.willFetchImages = false; return item; }

    /* Match. */
    const refHit = d.ref ? byRef.get(d.ref) : undefined;
    const skuHit = d.fields.sku ? bySku.get(d.fields.sku.toLowerCase()) : undefined;
    let target: ExistingProduct | undefined;
    if (refHit && skuHit && refHit.id !== skuHit.id) {
      item.errors.push({ row: d.rows[0], field: 'sku', code: 'match_conflict', message: `Row ${d.rows[0]}: ref "${d.ref}" belongs to "${refHit.title}" but SKU "${d.fields.sku}" belongs to "${skuHit.title}". They must refer to the same product.` });
    } else if (refHit) { target = refHit; item.matchedBy = 'ref'; }
    else if (skuHit) {
      if (d.ref && skuHit.external_ref && skuHit.external_ref !== d.ref) {
        item.errors.push({ row: d.rows[0], field: 'sku', code: 'match_conflict', message: `Row ${d.rows[0]}: SKU "${d.fields.sku}" already belongs to "${skuHit.title}", which was imported with a different ref ("${skuHit.external_ref}").` });
      } else { target = skuHit; item.matchedBy = 'sku'; }
    } else {
      const sims = byTitle.get(normTitle(item.title));
      if (sims?.length) {
        item.matchedBy = 'title';
        item.targetTitle = sims[0].title;
        item.warnings.push({ row: d.rows[0], field: 'title', code: 'title_similar',
          message: `Row ${d.rows[0]}: you already have "${sims[0].title}". Matching on the title alone is never automatic.` + (opts.allowTitleDuplicates ? ' Imported as a new product because you chose to.' : ' Not imported — add a ref or SKU to update it, or choose to import it as new.') });
        if (!opts.allowTitleDuplicates) { item.action = 'skip'; item.willFetchImages = false; return item; }
      }
    }
    if (item.errors.length) { item.action = 'error'; item.willFetchImages = false; return item; }

    if (!target) {
      item.action = 'create';
      item.publish = item.imageUrls.length ? 'ready' : 'needs_photo';
      if (!item.imageUrls.length) item.warnings.push({ row: d.rows[0], code: 'no_image', message: `Row ${d.rows[0]}: no image — it will stay a draft until you add a photo.` });
      return finishPublish(item);
    }

    /* Update or unchanged: diff against the matched product. */
    item.targetProductId = target.id;
    item.targetTitle = target.title;
    const locks = new Set(target.source_locked_fields);
    const live = d.fields;
    for (const [k, col, name] of DIFF_FIELDS) {
      if (live[k] === undefined) continue;
      const cur = target[col] as unknown;
      const want = live[k] as unknown;
      if ((cur ?? null) === (want ?? null)) continue;
      if (locks.has(name)) item.lockedSkipped.push(name);
      else item.changes.push({ field: name, from: cur ?? null, to: want });
    }
    const effectivePrice = live.price_pence !== undefined && !locks.has('price_pence') ? live.price_pence : target.price_pence;
    const activeVariants = target.variants.filter((v) => v.is_active);
    // A variant's stored delta is measured from the price the product WILL have: if the price is locked, that is the existing one.
    item.variants = item.variants.map((v) => (v.price_pence !== null ? { ...v, price_delta_pence: v.price_pence - effectivePrice } : v));
    if (live.stock !== undefined && live.stock !== null && activeVariants.length) {
      item.errors.push({ row: d.rows[0], field: 'stock', code: 'stock_conflict', message: `Row ${d.rows[0]}: "${target.title}" has variants, so stock is kept on the variants, not the product.` });
    }
    if (live.stock !== undefined && live.stock !== null && !locks.has('stock') && live.stock < target.reserved) {
      item.errors.push({ row: d.rows[0], field: 'stock', code: 'stock_below_reserved', message: `Row ${d.rows[0]}: stock ${live.stock} is below the ${target.reserved} currently held by open orders.` });
    }
    if (d.variants.length) {
      if (target.stock !== null && !locks.has('stock') && live.stock === undefined && !activeVariants.length) {
        item.errors.push({ row: d.rows[0], field: 'variant_name', code: 'stock_conflict', message: `Row ${d.rows[0]}: "${target.title}" keeps its own stock count (${target.stock}), so it cannot also have variants. Clear its stock first.` });
      }
      if (locks.has('variants')) item.lockedSkipped.push('variants');
      else {
        for (const v of d.variants) {
          const delta = v.price_pence !== null ? v.price_pence - effectivePrice : undefined;
          const ev = (v.sku && target.variants.find((x) => x.sku && x.sku.toLowerCase() === v.sku!.toLowerCase())) || target.variants.find((x) => x.name.toLowerCase() === v.name.toLowerCase());
          if (delta !== undefined && effectivePrice + delta < LIMITS.minPricePence) {
            item.errors.push({ row: v.row, field: 'variant_price', code: 'variant_price_low', message: `Row ${v.row}: variant "${v.name}" would sell for less than £0.50.` });
          }
          if (!ev) { item.variantChanges.push({ name: v.name, kind: 'new' }); continue; }
          if (v.stock !== undefined && v.stock !== null && v.stock < ev.reserved) {
            item.errors.push({ row: v.row, field: 'variant_stock', code: 'stock_below_reserved', message: `Row ${v.row}: variant "${ev.name}" stock ${v.stock} is below the ${ev.reserved} held by open orders.` });
          }
          const parts: string[] = [];
          if (delta !== undefined && delta !== ev.price_delta_pence) parts.push('price');
          if (v.stock !== undefined && (v.stock ?? null) !== ev.stock) parts.push('stock');
          if (v.name !== ev.name) parts.push('name');
          if (parts.length) item.variantChanges.push({ name: ev.name, kind: 'changed', detail: parts.join(', ') });
        }
      }
    }
    if (item.errors.length) { item.action = 'error'; item.willFetchImages = false; return item; }

    const photosLocked = locks.has('photos');
    const imageWork = d.imageUrls.length > 0 && !photosLocked && (item.hash !== target.source_hash || target.photos.length === 0);
    if (d.imageUrls.length && photosLocked) item.lockedSkipped.push('photos');
    item.willFetchImages = imageWork;
    item.action = item.changes.length || item.variantChanges.length || imageWork ? 'update' : 'unchanged';
    item.publish = target.photos.length || d.imageUrls.length ? 'ready' : 'needs_photo';
    if (target.photos.length === 0 && !d.imageUrls.length) item.warnings.push({ row: d.rows[0], code: 'no_image', message: `Row ${d.rows[0]}: "${target.title}" has no photo, so it cannot be published yet.` });
    return finishPublish(item);
  });

  const counts: PlanCounts = { found: items.length, create: 0, update: 0, unchanged: 0, skip: 0, error: 0, warnings: 0 };
  for (const it of items) { counts[it.action]++; if (it.warnings.length) counts.warnings++; }
  return { items, counts, fileRows: rows.length };
}

function finishPublish(item: PlanItem): PlanItem {
  if (item.policy.some((p) => p.level === 'warn') && item.publish === 'ready') item.publish = 'needs_review';
  return item;
}

/** The exact payload import_add_rows stores for one item. */
export function toDbItem(it: PlanItem): Record<string, unknown> {
  const fields: Record<string, unknown> = { ...it.fields };
  if (it.action === 'create') {
    fields.stock_mode ??= 'tracked';
    fields.category ??= 'other';
    if (fields.stock_mode === 'made_to_order') fields.lead_time_days ??= 14;
    if (fields.stock_mode !== 'tracked' || it.variants.length) delete fields.stock;
    if (fields.stock_mode !== 'made_to_order') delete fields.lead_time_days;
  }
  const variants = it.variants.map((v) => {
    const o: Record<string, unknown> = { name: v.name };
    // No variant_price in the file means "no opinion": an update must not reset an existing delta to zero.
    if (v.price_pence !== null || it.action === 'create') o.price_delta_pence = v.price_delta_pence;
    if (v.stock !== undefined) o.stock = v.stock;
    if (v.sku) o.sku = v.sku;
    return o;
  });
  return {
    item_index: it.index,
    row_numbers: it.rows,
    action: it.action,
    title: it.title,
    ext_ref: it.ref,
    sku: it.sku,
    target_product_id: it.targetProductId,
    payload: { fields, variants, image_urls: it.willFetchImages ? it.imageUrls : [], source_hash: it.hash },
    errors: it.errors,
    warnings: it.warnings,
  };
}

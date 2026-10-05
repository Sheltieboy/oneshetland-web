/**
 * presets.ts — header detection and adapters for ordinary product-export CSVs
 * from Shopify, WooCommerce and Square. This is NOT an API integration: the
 * merchant downloads a CSV from their shop admin and uploads it here, and an
 * adapter rewrites it into OneShetland's own column layout before the normal
 * validation runs.
 *
 * Each preset states what it does and does not bring across, and the screen
 * shows that list. Anything not listed is ignored, never guessed.
 *
 * The column names below are those the three platforms publish for their
 * product exports. They were built from the published formats and exercised
 * with fixtures of that shape; they have not been run against live exports
 * from each platform's admin, so the mapping step stays available as a
 * fallback ("Map the columns myself") for any file that differs.
 */
import { FIELDS, IMAGE_COLUMNS, LIMITS, normHeader, suggestMapping, type Field } from './columns.ts';

export type PresetId = 'oneshetland' | 'shopify' | 'woocommerce' | 'square' | 'generic';

export interface CanonicalRow {
  /** 1-based line in the uploaded file (header = 1). */
  rowNumber: number;
  v: Partial<Record<Field, string>>;
  /** Row cannot be imported; the message is shown against this row. */
  preError?: string;
  /** Row is deliberately not imported (e.g. archived in the source shop). */
  preSkip?: string;
  /** Plain observations from the adapter, shown as warnings (e.g. more than five images). */
  notes?: string[];
}

export interface PresetInfo {
  id: PresetId;
  label: string;
  /** What we bring across. */
  imports: string[];
  /** What we do NOT bring across — shown so nothing is implied. */
  ignores: string[];
}

const INFO: Record<PresetId, PresetInfo> = {
  oneshetland: { id: 'oneshetland', label: 'OneShetland template', imports: ['Every column in the template'], ignores: [] },
  generic: { id: 'generic', label: 'Your own columns', imports: ['The columns you map in the next step'], ignores: ['Any column you do not map'] },
  shopify: {
    id: 'shopify', label: 'Shopify product export',
    imports: ['Handle (as the reference)', 'Title', 'Description (converted to plain text)', 'Price and compare-at price', 'SKU', 'Stock quantity (where Shopify tracks it)',
      'Variants (option values joined into one name, e.g. "Large · Navy")', 'Up to 5 images'],
    ignores: ['Vendor, product category, type and tags (choose a OneShetland category after importing)', 'SEO fields', 'Weight, barcode and shipping settings', 'Metafields and gift-card settings',
      'Published / Status (everything arrives as a draft)', 'Per-variant images'],
  },
  woocommerce: {
    id: 'woocommerce', label: 'WooCommerce product export',
    imports: ['ID (as the reference)', 'Name', 'Description (converted to plain text; the short description is used if there is none)', 'Regular and sale price (a sale becomes the price, with the regular price as compare-at)',
      'SKU', 'Stock', 'Variations of variable products', 'Up to 5 images'],
    ignores: ['Categories and tags (choose a OneShetland category after importing)', 'Shipping class, weight and dimensions', 'Grouped and external products', 'Published (everything arrives as a draft)', 'Reviews, upsells and cross-sells'],
  },
  square: {
    id: 'square', label: 'Square item library export',
    imports: ['Token (as the reference)', 'Item name', 'Description (converted to plain text)', 'Price', 'SKU', 'Stock quantity (first location)', 'Variations'],
    ignores: ['Categories (choose a OneShetland category after importing)', 'Images — Square exports do not include them, so add photos before publishing', 'Taxes, vendor and cost fields', 'Archived items (skipped)', 'Services and gift cards'],
  },
};
export const presetInfo = (id: PresetId): PresetInfo => INFO[id];

/* ── Detection ───────────────────────────────────────────────────────────── */

export function detectPreset(headers: string[]): PresetId {
  const h = new Set(headers.map(normHeader));
  const has = (...names: string[]) => names.every((n) => h.has(n));
  const ownCols = FIELDS.filter((f) => h.has(f.replace(/_/g, ' '))).length;
  if (has('title', 'price') && ownCols >= 4 && !has('handle')) return 'oneshetland';
  if (has('handle', 'title') && (h.has('variant price') || h.has('option1 name') || h.has('body html'))) return 'shopify';
  if (has('name', 'regular price') && (h.has('type') || h.has('sku')) && (h.has('categories') || h.has('in stock'))) return 'woocommerce';
  if (has('item name', 'variation name') ) return 'square';
  return 'generic';
}

/* ── Generic mapping ─────────────────────────────────────────────────────── */

export type Mapping = Partial<Record<Field, number>>;

/** Apply a column→field mapping to raw rows. */
export function applyMapping(rows: { rowNumber: number; cells: string[] }[], mapping: Mapping): CanonicalRow[] {
  return rows.map((r) => {
    const v: Partial<Record<Field, string>> = {};
    for (const f of FIELDS) {
      const idx = mapping[f];
      if (idx !== undefined && idx >= 0) v[f] = (r.cells[idx] ?? '').trim();
    }
    return { rowNumber: r.rowNumber, v };
  });
}

/* ── Helpers for adapters ────────────────────────────────────────────────── */

type Lookup = (row: string[], name: string) => string;
function lookup(headers: string[]): { get: Lookup; has: (n: string) => boolean; indexOfPrefix: (p: string) => number } {
  const norm = headers.map(normHeader);
  const idx = new Map<string, number>();
  norm.forEach((n, i) => { if (!idx.has(n)) idx.set(n, i); });
  return {
    get: (row, name) => { const i = idx.get(name); return i === undefined ? '' : (row[i] ?? '').trim(); },
    has: (n) => idx.has(n),
    indexOfPrefix: (p) => norm.findIndex((n) => n.startsWith(p)),
  };
}

const num = (s: string): number | null => {
  const t = s.replace(/[£,\s]/g, '').replace(/^gbp/i, '');
  if (!/^\d+(\.\d+)?$/.test(t)) return null;
  return Number(t);
};
const moneyStr = (n: number) => n.toFixed(2);

function groupBy<T>(items: T[], key: (t: T) => string): Map<string, T[]> {
  const m = new Map<string, T[]>();
  for (const it of items) {
    const k = key(it);
    const arr = m.get(k);
    if (arr) arr.push(it); else m.set(k, [it]);
  }
  return m;
}

function imageFields(urls: string[]): Partial<Record<Field, string>> {
  const out: Partial<Record<Field, string>> = {};
  const uniq = [...new Set(urls.filter(Boolean))];
  IMAGE_COLUMNS.forEach((c, i) => { if (uniq[i]) out[c] = uniq[i]; });
  return out;
}
const imgNote = (urls: string[]): string[] | undefined => {
  const n = new Set(urls.filter(Boolean)).size;
  return n > IMAGE_COLUMNS.length ? [`${n} images found; only the first ${IMAGE_COLUMNS.length} are imported`] : undefined;
};

const variantLabel = (parts: string[]): string => parts.map((p) => p.trim()).filter(Boolean).join(' · ').slice(0, LIMITS.variantNameMax);

/* ── Shopify ─────────────────────────────────────────────────────────────── */

function adaptShopify(headers: string[], rows: { rowNumber: number; cells: string[] }[]): CanonicalRow[] {
  const L = lookup(headers);
  const out: CanonicalRow[] = [];
  const groups = groupBy(rows, (r) => L.get(r.cells, 'handle').toLowerCase() || `__row${r.rowNumber}`);
  for (const [, g] of groups) {
    const handle = L.get(g[0].cells, 'handle');
    const primary = g.find((r) => L.get(r.cells, 'title')) ?? g[0];
    const title = L.get(primary.cells, 'title');
    const body = L.get(primary.cells, 'body html');

    // Rows that describe a variant carry an option value or a variant price/SKU.
    const isVariantRow = (r: { cells: string[] }) =>
      !!(L.get(r.cells, 'option1 value') || L.get(r.cells, 'variant price') || L.get(r.cells, 'variant sku'));
    const variantRows = g.filter(isVariantRow);
    const single = variantRows.length === 1 &&
      (!L.get(variantRows[0].cells, 'option1 value') || L.get(variantRows[0].cells, 'option1 value').toLowerCase() === 'default title');

    // Images: every Image Src in the group, in Image Position order.
    const imgs = g
      .map((r, i) => ({ src: L.get(r.cells, 'image src'), pos: Number(L.get(r.cells, 'image position')) || 1000 + i }))
      .filter((x) => x.src)
      .sort((a, b) => a.pos - b.pos)
      .map((x) => x.src);

    const qty = (r: { cells: string[] }) => (L.get(r.cells, 'variant inventory tracker') ? L.get(r.cells, 'variant inventory qty') : '');

    const base: Partial<Record<Field, string>> = { ref: handle, title, description: body, ...imageFields(imgs) };

    if (variantRows.length === 0) {
      out.push({ rowNumber: primary.rowNumber, v: { ...base, price: '' }, notes: imgNote(imgs) });
      continue;
    }
    if (single) {
      const r = variantRows[0];
      out.push({ rowNumber: primary.rowNumber, v: {
        ...base, sku: L.get(r.cells, 'variant sku'), price: L.get(r.cells, 'variant price'),
        compare_at_price: L.get(r.cells, 'variant compare at price'), stock: qty(r), stock_mode: 'tracked',
      }, notes: imgNote(imgs) });
      continue;
    }
    // Several variants: product price = the lowest, each variant carries its own full price.
    const prices = variantRows.map((r) => num(L.get(r.cells, 'variant price'))).filter((n): n is number => n !== null);
    const min = prices.length ? Math.min(...prices) : null;
    variantRows.forEach((r, i) => {
      const name = variantLabel([L.get(r.cells, 'option1 value'), L.get(r.cells, 'option2 value'), L.get(r.cells, 'option3 value')]);
      const v: Partial<Record<Field, string>> = {
        ref: handle,
        variant_name: name, variant_price: L.get(r.cells, 'variant price'),
        variant_stock: qty(r), variant_sku: L.get(r.cells, 'variant sku'),
      };
      if (i === 0) Object.assign(v, base, { price: min !== null ? moneyStr(min) : '', stock_mode: 'tracked' });
      out.push({ rowNumber: r.rowNumber, v, notes: i === 0 ? imgNote(imgs) : undefined });
    });
  }
  return out.sort((a, b) => a.rowNumber - b.rowNumber);
}

/* ── WooCommerce ─────────────────────────────────────────────────────────── */

function adaptWoo(headers: string[], rows: { rowNumber: number; cells: string[] }[]): CanonicalRow[] {
  const L = lookup(headers);
  const out: CanonicalRow[] = [];
  const type = (r: { cells: string[] }) => L.get(r.cells, 'type').toLowerCase();
  const refOf = (r: { cells: string[] }) => L.get(r.cells, 'id') || L.get(r.cells, 'sku');

  // Parent resolution: "id:123", an ID, or the parent's SKU.
  const byId = new Map<string, string>();
  const bySku = new Map<string, string>();
  for (const r of rows) {
    if (type(r) === 'variation') continue;
    const ref = refOf(r);
    if (L.get(r.cells, 'id')) byId.set(L.get(r.cells, 'id'), ref);
    if (L.get(r.cells, 'sku')) bySku.set(L.get(r.cells, 'sku').toLowerCase(), ref);
  }
  const parentRef = (r: { cells: string[] }): string => {
    const p = L.get(r.cells, 'parent');
    if (!p) return '';
    const m = /^id:\s*(\d+)$/i.exec(p);
    if (m) return byId.get(m[1]) ?? m[1];
    return byId.get(p) ?? bySku.get(p.toLowerCase()) ?? p;
  };
  const price = (r: { cells: string[] }) => {
    const regular = L.get(r.cells, 'regular price'), sale = L.get(r.cells, 'sale price');
    const rn = num(regular), sn = num(sale);
    if (sn !== null && rn !== null && sn < rn) return { price: sale, compare: regular };
    return { price: regular || sale, compare: '' };
  };
  const images = (r: { cells: string[] }) => L.get(r.cells, 'images').split(/\s*,\s*(?=https?:)/i).map((s) => s.trim()).filter(Boolean);
  const stockOf = (r: { cells: string[] }) => L.get(r.cells, 'stock');
  const attrValues = (r: { cells: string[] }) => [1, 2, 3, 4, 5].map((n) => L.get(r.cells, `attribute ${n} value s`));

  const variations = rows.filter((r) => type(r) === 'variation');
  const variationsByParent = groupBy(variations, parentRef);

  for (const r of rows) {
    const t = type(r);
    if (t === 'variation') {
      if (!parentRef(r)) out.push({ rowNumber: r.rowNumber, v: {}, preError: 'This variation has no parent product in the file' });
      continue;      // otherwise emitted with its parent
    }
    if (t === 'grouped' || t === 'external') {
      out.push({ rowNumber: r.rowNumber, v: { ref: refOf(r), title: L.get(r.cells, 'name') }, preError: `"${t}" products are not supported — only simple and variable products` });
      continue;
    }
    const ref = refOf(r);
    const desc = L.get(r.cells, 'description') || L.get(r.cells, 'short description');
    const base: Partial<Record<Field, string>> = { ref, sku: L.get(r.cells, 'sku'), title: L.get(r.cells, 'name'), description: desc, ...imageFields(images(r)) };
    if (t === 'variable') {
      const vs = variationsByParent.get(ref) ?? [];
      if (!vs.length) { out.push({ rowNumber: r.rowNumber, v: { ...base, sku: '', price: '' } }); continue; }
      const prices = vs.map((v) => num(price(v).price)).filter((n): n is number => n !== null);
      const min = prices.length ? Math.min(...prices) : null;
      vs.forEach((v, i) => {
        const o: Partial<Record<Field, string>> = {
          ref, variant_name: variantLabel(attrValues(v)) || L.get(v.cells, 'name'),
          variant_price: price(v).price, variant_stock: stockOf(v), variant_sku: L.get(v.cells, 'sku'),
        };
        if (i === 0) Object.assign(o, base, { sku: '', price: min !== null ? moneyStr(min) : '', stock_mode: 'tracked' });
        out.push({ rowNumber: i === 0 ? r.rowNumber : v.rowNumber, v: o, notes: i === 0 ? imgNote(images(r)) : undefined });
      });
      continue;
    }
    const p = price(r);
    out.push({ rowNumber: r.rowNumber, v: { ...base, price: p.price, compare_at_price: p.compare, stock: stockOf(r), stock_mode: 'tracked' }, notes: imgNote(images(r)) });
  }
  return out.sort((a, b) => a.rowNumber - b.rowNumber);
}

/* ── Square ──────────────────────────────────────────────────────────────── */

function adaptSquare(headers: string[], rows: { rowNumber: number; cells: string[] }[]): CanonicalRow[] {
  const L = lookup(headers);
  const qtyCol = L.indexOfPrefix('current quantity');
  const qty = (r: { cells: string[] }) => (qtyCol >= 0 ? (r.cells[qtyCol] ?? '').trim() : '');
  const out: CanonicalRow[] = [];
  const key = (r: { cells: string[] }) => (L.get(r.cells, 'token') || L.get(r.cells, 'item name')).toLowerCase();
  const groups = groupBy(rows, key);
  for (const [, g] of groups) {
    const first = g[0];
    const type = L.get(first.cells, 'item type').toLowerCase();
    const title = L.get(first.cells, 'item name');
    const ref = L.get(first.cells, 'token') || title;
    if (type && !/physical|good|^$/.test(type)) {
      out.push({ rowNumber: first.rowNumber, v: { ref, title }, preSkip: `"${L.get(first.cells, 'item type')}" is not a physical product, so it was not imported` });
      continue;
    }
    const live = g.filter((r) => !/^(yes|true|y)$/i.test(L.get(r.cells, 'archived')));
    if (!live.length) { out.push({ rowNumber: first.rowNumber, v: { ref, title }, preSkip: 'Archived in Square, so it was not imported' }); continue; }
    const desc = L.get(live[0].cells, 'description');
    const single = live.length === 1 && (/^(regular|default|)$/i.test(L.get(live[0].cells, 'variation name')));
    if (single) {
      out.push({ rowNumber: live[0].rowNumber, v: {
        ref, title, description: desc, sku: L.get(live[0].cells, 'sku'), price: L.get(live[0].cells, 'price'), stock: qty(live[0]), stock_mode: 'tracked',
      } });
      continue;
    }
    const prices = live.map((r) => num(L.get(r.cells, 'price'))).filter((n): n is number => n !== null);
    const min = prices.length ? Math.min(...prices) : null;
    live.forEach((r, i) => {
      const name = L.get(r.cells, 'variation name') || variantLabel([L.get(r.cells, 'option value 1')]);
      const v: Partial<Record<Field, string>> = {
        ref, variant_name: name, variant_price: L.get(r.cells, 'price'), variant_stock: qty(r), variant_sku: L.get(r.cells, 'sku'),
      };
      if (i === 0) Object.assign(v, { title, description: desc, price: min !== null ? moneyStr(min) : '', stock_mode: 'tracked' });
      out.push({ rowNumber: r.rowNumber, v });
    });
  }
  return out.sort((a, b) => a.rowNumber - b.rowNumber);
}

/* ── Entry points ────────────────────────────────────────────────────────── */

export function adaptPreset(id: PresetId, headers: string[], rows: { rowNumber: number; cells: string[] }[]): CanonicalRow[] {
  switch (id) {
    case 'shopify': return adaptShopify(headers, rows);
    case 'woocommerce': return adaptWoo(headers, rows);
    case 'square': return adaptSquare(headers, rows);
    case 'oneshetland': return applyMapping(rows, suggestMapping(headers));
    default: throw new Error('adaptPreset needs a preset; use applyMapping for your own columns');
  }
}

/** Rows ready for validation, from either a preset or the merchant's own mapping. */
export function toCanonical(
  headers: string[], rows: { rowNumber: number; cells: string[] }[],
  preset: PresetId, mapping?: Mapping,
): CanonicalRow[] {
  if (preset === 'generic') return applyMapping(rows, mapping ?? suggestMapping(headers));
  return adaptPreset(preset, headers, rows);
}

/**
 * columns.ts — the OneShetland product CSV: the fields we understand, the
 * limits we enforce, the downloadable template, and the header aliases used to
 * pre-fill the mapping step for a file that is not in our own format.
 */

export const IMAGE_COLUMNS = ['image_1', 'image_2', 'image_3', 'image_4', 'image_5'] as const;

export const FIELDS = [
  'ref', 'sku', 'title', 'description', 'category', 'price', 'compare_at_price',
  'stock_mode', 'stock', 'lead_time_days', 'collect_only', 'free_uk_post',
  ...IMAGE_COLUMNS,
  'variant_name', 'variant_price', 'variant_stock', 'variant_sku',
] as const;
export type Field = (typeof FIELDS)[number];

export const REQUIRED_FIELDS: Field[] = ['title', 'price'];

export const FIELD_LABELS: Record<Field, string> = {
  ref: 'Reference (groups variants, repeat imports)',
  sku: 'SKU',
  title: 'Title',
  description: 'Description',
  category: 'Category',
  price: 'Price (£)',
  compare_at_price: 'Compare-at price (£)',
  stock_mode: 'Stock mode',
  stock: 'Stock',
  lead_time_days: 'Lead time (days)',
  collect_only: 'Collect only',
  free_uk_post: 'Free UK postage',
  image_1: 'Image 1 (web address)', image_2: 'Image 2', image_3: 'Image 3', image_4: 'Image 4', image_5: 'Image 5',
  variant_name: 'Variant name',
  variant_price: 'Variant price (£, full price)',
  variant_stock: 'Variant stock',
  variant_sku: 'Variant SKU',
};

export const LIMITS = {
  titleMax: 200,
  descriptionMax: 5000,
  variantNameMax: 80,
  skuMax: 100,
  refMax: 200,
  minPricePence: 50,
  maxPricePence: 1_000_000,      // £10,000 — a typo guard, not a business rule
  leadTimeMin: 1,
  leadTimeMax: 90,
  stockMax: 1_000_000,
  maxImages: 5,
  maxVariants: 100,
  urlMax: 2000,
} as const;

/** The shop's category list, kept in step with lib/shop-data.ts PRODUCT_CATEGORIES. */
export const CATEGORIES: { value: string; label: string }[] = [
  { value: 'knitwear', label: 'Knitwear' },
  { value: 'craft', label: 'Craft' },
  { value: 'art', label: 'Art & prints' },
  { value: 'food_drink', label: 'Food & drink' },
  { value: 'home', label: 'Home' },
  { value: 'beauty', label: 'Health & beauty' },
  { value: 'outdoor', label: 'Outdoor' },
  { value: 'books_music', label: 'Books & music' },
  { value: 'other', label: 'Other' },
];

export const STOCK_MODES = ['tracked', 'made_to_order', 'one_off'] as const;
export type StockModeValue = (typeof STOCK_MODES)[number];

/** Normalise a header for comparison: lower-case, punctuation → single spaces. */
export const normHeader = (h: string): string =>
  h.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

/** Header text (normalised) → field, for pre-filling the mapping of an unrecognised file. */
const ALIASES: Record<Field, string[]> = {
  ref: ['ref', 'reference', 'external id', 'product id', 'id', 'handle', 'item id'],
  sku: ['sku', 'product sku', 'item sku', 'stock code', 'product code', 'code'],
  title: ['title', 'name', 'product', 'product name', 'product title', 'item name', 'item'],
  description: ['description', 'product description', 'details', 'body', 'long description'],
  category: ['category', 'categories', 'product category', 'type', 'department'],
  price: ['price', 'price gbp', 'price £', 'regular price', 'selling price', 'retail price', 'unit price', 'cost'],
  compare_at_price: ['compare at price', 'compare at', 'was price', 'rrp', 'original price', 'list price'],
  stock_mode: ['stock mode', 'stock type', 'availability type'],
  stock: ['stock', 'quantity', 'qty', 'stock quantity', 'inventory', 'in stock', 'on hand'],
  lead_time_days: ['lead time days', 'lead time', 'days to make', 'making time'],
  collect_only: ['collect only', 'collection only', 'click and collect only', 'pickup only'],
  free_uk_post: ['free uk post', 'free uk postage', 'free postage', 'free shipping', 'free uk shipping'],
  image_1: ['image 1', 'image1', 'image', 'image url', 'photo', 'photo 1', 'picture', 'pic', 'image src'],
  image_2: ['image 2', 'image2', 'photo 2', 'picture 2'],
  image_3: ['image 3', 'image3', 'photo 3', 'picture 3'],
  image_4: ['image 4', 'image4', 'photo 4', 'picture 4'],
  image_5: ['image 5', 'image5', 'photo 5', 'picture 5'],
  variant_name: ['variant name', 'variant', 'option', 'option name', 'variation', 'variation name', 'size', 'option value'],
  variant_price: ['variant price', 'option price', 'variation price'],
  variant_stock: ['variant stock', 'variant quantity', 'variant qty', 'option stock', 'variation stock'],
  variant_sku: ['variant sku', 'option sku', 'variation sku'],
};

/** Best-guess mapping: each field to the first header that matches an alias. A header is used once. */
export function suggestMapping(headers: string[]): Partial<Record<Field, number>> {
  const norm = headers.map(normHeader);
  const used = new Set<number>();
  const out: Partial<Record<Field, number>> = {};
  // Exact names first so "variant price" is not swallowed by "price".
  for (const f of FIELDS) {
    const hit = norm.findIndex((h, i) => !used.has(i) && h === f.replace(/_/g, ' '));
    if (hit >= 0) { out[f] = hit; used.add(hit); }
  }
  for (const f of FIELDS) {
    if (out[f] !== undefined) continue;
    const hit = norm.findIndex((h, i) => !used.has(i) && ALIASES[f].includes(h));
    if (hit >= 0) { out[f] = hit; used.add(hit); }
  }
  return out;
}

/* ── The downloadable template ───────────────────────────────────────────── */

export const TEMPLATE_HEADERS: Field[] = [...FIELDS];

/** Example rows are obviously examples; the importer warns if one is uploaded as-is. */
export const TEMPLATE_EXAMPLE_PREFIX = 'Example:';

export const TEMPLATE_ROWS: string[][] = [
  // simple product
  ['EXAMPLE-MUG', 'EX-MUG-01', 'Example: Hand-thrown mug', 'Stoneware mug, made in a Shetland studio. Dishwasher safe.', 'craft', '14.50', '', 'tracked', '12', '', 'no', 'no',
    'https://example.com/photos/mug-1.jpg', '', '', '', '', '', '', '', ''],
  // product with variants: first row carries the product, every row with a variant_name is one variant
  ['EXAMPLE-JUMPER', 'EX-JUMP', 'Example: Fair Isle jumper', 'Knitted to order in pure Shetland wool.', 'knitwear', '85.00', '', 'tracked', '', '', 'no', 'yes',
    'https://example.com/photos/jumper-1.jpg', 'https://example.com/photos/jumper-2.jpg', '', '', '', 'Small', '85.00', '3', 'EX-JUMP-S'],
  ['EXAMPLE-JUMPER', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', 'Medium', '85.00', '4', 'EX-JUMP-M'],
  ['EXAMPLE-JUMPER', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', 'Large', '90.00', '2', 'EX-JUMP-L'],
];

export const TEMPLATE_NOTES: { field: string; note: string }[] = [
  { field: 'title, price', note: 'Required. Price is in pounds, at least £0.50. GBP only.' },
  { field: 'ref', note: 'Your own code for the product. Rows that share a ref are variants of one product, and the ref lets a later import update the same product instead of adding it again.' },
  { field: 'sku', note: 'Optional stock code. Unique within your shop.' },
  { field: 'category', note: 'One of: ' + CATEGORIES.map((c) => c.value).join(', ') + '. Blank means Other.' },
  { field: 'stock_mode', note: 'tracked (default), made_to_order or one_off.' },
  { field: 'stock', note: 'Whole number, for tracked products with no variants. Blank means plenty.' },
  { field: 'lead_time_days', note: 'Made-to-order only: 1–90 days.' },
  { field: 'collect_only, free_uk_post', note: 'yes / no.' },
  { field: 'image_1 … image_5', note: 'Public https:// web addresses of JPEG, PNG or WebP photos. We copy them into your shop; we never link to the original.' },
  { field: 'variant_name, variant_price, variant_stock, variant_sku', note: 'One row per variant. variant_price is the full price of that variant (we work out the difference from the product price).' },
];

/** Plain-text "how to fill this in", downloaded beside the template. */
export function templateInstructions(): string {
  const lines = [
    'OneShetland product import — how to fill in the template',
    '',
    'Open oneshetland-products-template.csv in Excel, Numbers or Google Sheets. The first row holds the column names: leave it exactly as it is.',
    'The two example products under it (their titles start with "Example:") show a simple product and a product with sizes. Delete them, then add your own, one product per row.',
    'When you are done, save or export as CSV (in Excel: File > Save As > "CSV UTF-8"), then upload it on the Import products page.',
    '',
    'Only title and price are needed. Everything else is optional.',
    '',
    ...TEMPLATE_NOTES.map((n) => `${n.field}: ${n.note}`),
    '',
    'Products with sizes or options: put the product on its first row with a ref (any short code you like, such as JUMPER-1).',
    'Add one more row for each extra option, repeating the same ref and filling in variant_name, variant_price, variant_stock and variant_sku.',
    'The first option can go on the product row itself.',
    '',
    'Nothing is saved until you have looked at the plan and pressed confirm, and everything arrives as a draft only you can see.',
  ];
  return lines.join('\r\n') + '\r\n';
}

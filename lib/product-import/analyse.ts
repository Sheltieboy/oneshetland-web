/**
 * analyse.ts — the two read-only questions the importer asks of an uploaded
 * file: "what is in it?" (inspect) and "what would importing it do?" (plan).
 * Neither writes anything; both are pure given the bytes and the business's
 * existing products, which is what lets the confirm step recompute the plan it
 * is about to apply instead of trusting one sent back by the browser.
 */
import { CsvError, parseCsvFile } from './csv.ts';
import { FIELDS, REQUIRED_FIELDS, suggestMapping, type Field } from './columns.ts';
import { detectPreset, presetInfo, toCanonical, type Mapping, type PresetId } from './presets.ts';
import { buildPlan, sha256, type ExistingProduct, type Plan, type PlanOptions } from './plan.ts';

export interface Inspection {
  filename: string;
  delimiter: ',' | ';';
  headers: string[];
  rowCount: number;
  preset: PresetId;
  presetInfo: ReturnType<typeof presetInfo>;
  suggestedMapping: Mapping;
  sample: string[][];
}

export type AnalyseError = { error: string; code: string };

export function inspectFile(bytes: Uint8Array, filename: string): Inspection | AnalyseError {
  try {
    const p = parseCsvFile(bytes);
    const preset = detectPreset(p.headers);
    return {
      filename, delimiter: p.delimiter, headers: p.headers, rowCount: p.rows.length, preset, presetInfo: presetInfo(preset),
      suggestedMapping: suggestMapping(p.headers), sample: p.rows.slice(0, 5).map((r) => r.cells),
    };
  } catch (e) {
    if (e instanceof CsvError) return { error: e.message, code: e.code };
    throw e;
  }
}

/** A mapping from the browser, cleaned: only known fields, only integer column indexes inside the header range. */
export function cleanMapping(raw: unknown, width: number): Mapping {
  const out: Mapping = {};
  if (!raw || typeof raw !== 'object') return out;
  for (const f of FIELDS) {
    const v = (raw as Record<string, unknown>)[f];
    if (typeof v === 'number' && Number.isInteger(v) && v >= 0 && v < width) out[f as Field] = v;
  }
  return out;
}

export function planFromUpload(
  bytes: Uint8Array,
  choice: { preset?: string; mapping?: unknown },
  existing: ExistingProduct[],
  opts: PlanOptions = {},
): { plan: Plan; preset: PresetId; mapping: Mapping; headers: string[]; delimiter: ',' | ';' } | AnalyseError {
  let parsed;
  try { parsed = parseCsvFile(bytes); }
  catch (e) { if (e instanceof CsvError) return { error: e.message, code: e.code }; throw e; }

  const known: PresetId[] = ['oneshetland', 'shopify', 'woocommerce', 'square', 'generic'];
  const preset = (known as string[]).includes(choice.preset ?? '') ? (choice.preset as PresetId) : detectPreset(parsed.headers);
  const mapping = preset === 'generic' || preset === 'oneshetland' ? cleanMapping(choice.mapping, parsed.headers.length) : {};
  const effective: Mapping = Object.keys(mapping).length ? mapping : suggestMapping(parsed.headers);

  if (preset === 'generic' || preset === 'oneshetland') {
    const missing = REQUIRED_FIELDS.filter((f) => effective[f] === undefined);
    if (missing.length) return { error: `Choose which column holds the ${missing.join(' and ')}.`, code: 'mapping_incomplete' };
  }
  const canonical = toCanonical(parsed.headers, parsed.rows, preset, effective);
  const plan = buildPlan(canonical, existing, opts);
  return { plan, preset, mapping: effective, headers: parsed.headers, delimiter: parsed.delimiter };
}

/** What the merchant reviewed. Confirm refuses if the plan it recomputes differs. */
export function planSignature(plan: Plan): string {
  return sha256(JSON.stringify(plan.items.map((i) => [i.index, i.action, i.targetProductId, i.hash, i.errors.length])));
}

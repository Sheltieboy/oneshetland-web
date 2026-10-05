/**
 * normalise.ts — turns one cell of text into the value the product table holds,
 * or says exactly why it cannot. Pure functions; each returns either
 * { ok: true, value } or { ok: false, message }.
 */
import { CATEGORIES, LIMITS, STOCK_MODES, type StockModeValue } from './columns.ts';

export type Parsed<T> = { ok: true; value: T } | { ok: false; message: string };
const ok = <T,>(value: T): Parsed<T> => ({ ok: true, value });
const bad = (message: string): Parsed<never> => ({ ok: false, message });

const FOREIGN_CURRENCY = /(\$|€|¥|₹|usd|eur|euro|euros|dollar|dollars|aud|cad|nzd|chf|sek|nok|dkk|yen|rmb|cny)/i;

/**
 * Pounds → pence. Accepts "12", "12.5", "£12.50", "GBP 12.50", "1,299.00",
 * "12,50" (comma as the decimal mark, when exactly two digits follow and there
 * is no dot). Rejects other currencies, negatives and anything ambiguous.
 */
export function parseMoney(raw: string): Parsed<number> {
  let s = raw.trim();
  if (!s) return bad('is empty');
  if (FOREIGN_CURRENCY.test(s)) return bad(`"${raw.trim()}" is not in pounds — OneShetland prices are in GBP (£) only`);
  s = s.replace(/^(gbp|£)\s*/i, '').replace(/\s*(gbp|£)$/i, '').replace(/\s+/g, '');
  if (/^-/.test(s)) return bad(`"${raw.trim()}" is negative`);
  if (!/^\d[\d,.]*$/.test(s)) return bad(`"${raw.trim()}" is not a price`);
  const dots = (s.match(/\./g) ?? []).length;
  const commas = (s.match(/,/g) ?? []).length;
  if (dots > 1 && commas === 0) return bad(`"${raw.trim()}" is not a price`);
  if (dots === 1 && commas >= 1) {
    // "1,299.00": commas are thousands separators, but only if they come first.
    if (s.lastIndexOf(',') > s.indexOf('.')) return bad(`"${raw.trim()}" is not a price`);
    s = s.replace(/,/g, '');
  } else if (commas >= 1 && dots === 0) {
    const last = s.lastIndexOf(',');
    const tail = s.length - last - 1;
    if (commas === 1 && tail <= 2) s = s.replace(',', '.');           // 12,50 → 12.50
    else if (/^\d{1,3}(,\d{3})+$/.test(s)) s = s.replace(/,/g, '');    // 1,299 → 1299
    else return bad(`"${raw.trim()}" is not a price`);
  }
  if (!/^\d+(\.\d{1,2})?$/.test(s)) return bad(`"${raw.trim()}" has more than two decimal places`);
  const pence = Math.round(Number(s) * 100);
  if (!Number.isFinite(pence)) return bad(`"${raw.trim()}" is not a price`);
  if (pence > LIMITS.maxPricePence) return bad(`"${raw.trim()}" is over £${LIMITS.maxPricePence / 100} — check for a typo`);
  return ok(pence);
}

export function parseInt0(raw: string, label: string, max: number): Parsed<number> {
  const s = raw.trim().replace(/,/g, '');
  if (!/^\d+$/.test(s)) {
    if (/^\d+\.0+$/.test(s)) return ok(Number(s.split('.')[0]));   // "12.0" from a spreadsheet
    return bad(`${label} "${raw.trim()}" must be a whole number, zero or more`);
  }
  const n = Number(s);
  if (n > max) return bad(`${label} ${n} is too large`);
  return ok(n);
}

const TRUE_SET = new Set(['yes', 'y', 'true', 't', '1', 'on', 'x', 'checked']);
const FALSE_SET = new Set(['no', 'n', 'false', 'f', '0', 'off', '']);
export function parseBool(raw: string, label: string): Parsed<boolean> {
  const s = raw.trim().toLowerCase();
  if (TRUE_SET.has(s)) return ok(true);
  if (FALSE_SET.has(s)) return ok(false);
  return bad(`${label} "${raw.trim()}" should be yes or no`);
}

const MODE_ALIASES: Record<string, StockModeValue> = {
  tracked: 'tracked', track: 'tracked', 'in stock': 'tracked', stock: 'tracked', 'i have stock': 'tracked',
  made_to_order: 'made_to_order', 'made to order': 'made_to_order', mto: 'made_to_order', 'make to order': 'made_to_order', bespoke: 'made_to_order',
  one_off: 'one_off', 'one off': 'one_off', 'one-off': 'one_off', unique: 'one_off', oneoff: 'one_off',
};
export function parseStockMode(raw: string): Parsed<StockModeValue> {
  const s = raw.trim().toLowerCase().replace(/[_\s-]+/g, ' ');
  const key = Object.keys(MODE_ALIASES).find((k) => k.replace(/[_\s-]+/g, ' ') === s);
  if (key) return ok(MODE_ALIASES[key]);
  return bad(`Stock mode "${raw.trim()}" should be one of: ${STOCK_MODES.join(', ')}`);
}

export function parseCategory(raw: string): Parsed<string> {
  const s = raw.trim().toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, ' ').trim();
  for (const c of CATEGORIES) {
    if (s === c.value.replace(/_/g, ' ') || s === c.label.toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, ' ').trim()) return ok(c.value);
  }
  return bad(`Category "${raw.trim()}" is not one we know. Use one of: ${CATEGORIES.map((c) => c.value).join(', ')}`);
}

export interface UrlProblem { message: string }
/** Syntax-level check only; the fetcher re-validates and resolves addresses. */
export function parseImageUrl(raw: string): Parsed<string> {
  const s = raw.trim();
  if (!s) return bad('is empty');
  if (s.length > LIMITS.urlMax) return bad('web address is too long');
  let u: URL;
  try { u = new URL(s); } catch { return bad(`"${s.slice(0, 80)}" is not a web address`); }
  if (u.protocol !== 'https:') return bad(`"${s.slice(0, 80)}" must start with https:// (plain http and other schemes are not accepted)`);
  if (u.username || u.password) return bad('web addresses with a username or password are not accepted');
  if (!u.hostname || !u.hostname.includes('.') && !/^\[.*\]$/.test(u.hostname)) return bad(`"${s.slice(0, 80)}" has no valid host name`);
  if (/\.svg(\?|#|$)/i.test(u.pathname)) return bad('SVG images are not accepted — use JPEG, PNG or WebP');
  return ok(u.toString());
}

/** A page of free text from a cell, bounded. */
export function clampText(s: string, max: number): { text: string; truncated: boolean } {
  return s.length > max ? { text: s.slice(0, max), truncated: true } : { text: s, truncated: false };
}

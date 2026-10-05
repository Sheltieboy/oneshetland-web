/**
 * text.ts — CSV text becomes plain text.
 *
 * Descriptions from a shop export are often HTML ("Body (HTML)" in Shopify,
 * descriptions in WooCommerce). OneShetland renders descriptions as plain text
 * everywhere, so the import converts rather than stores markup: tags are
 * removed (block tags become line breaks), entities decoded, <script>/<style>
 * bodies dropped, control characters stripped. What is stored can never carry
 * markup, and React escapes it on display regardless.
 */

const NAMED: Record<string, string> = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', pound: '£', euro: '€', copy: '©', reg: '®',
  ndash: '–', mdash: '—', lsquo: '‘', rsquo: '’', ldquo: '“', rdquo: '”', hellip: '…', bull: '•', deg: '°', times: '×',
  eacute: 'é', egrave: 'è', aacute: 'á', agrave: 'à', oacute: 'ó', uacute: 'ú', iacute: 'í', ntilde: 'ñ', ouml: 'ö', uuml: 'ü', auml: 'ä', szlig: 'ß', aring: 'å', oslash: 'ø', aelig: 'æ',
};

function decodeEntities(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z][a-z0-9]*);/gi, (m, e: string) => {
    if (e[0] === '#') {
      const code = e[1].toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      if (!Number.isFinite(code) || code < 32 && code !== 9 && code !== 10 || code > 0x10ffff || (code >= 0xd800 && code <= 0xdfff)) return '';
      return String.fromCodePoint(code);
    }
    return NAMED[e.toLowerCase()] ?? m;
  });
}

export function toPlainText(input: string): string {
  let s = input.replace(/\r\n?/g, '\n');
  // Elements whose CONTENT is never text.
  s = s.replace(/<(script|style|iframe|object|embed|noscript)\b[\s\S]*?<\/\1\s*>/gi, ' ');
  s = s.replace(/<!--[\s\S]*?-->/g, ' ');
  // Block-level boundaries and <br> become line breaks; list items get a bullet.
  s = s.replace(/<\s*li\b[^>]*>/gi, '\n• ');
  s = s.replace(/<\s*br\s*\/?\s*>/gi, '\n');
  s = s.replace(/<\/\s*(p|div|h[1-6]|ul|ol|tr|table|blockquote|section|article)\s*>/gi, '\n');
  // Any remaining tag. A "<" that does not open a tag (e.g. "under <10cm") survives as text.
  s = s.replace(/<\/?[a-z!][^>]*>/gi, '');
  s = decodeEntities(s);
  // Decoding can produce markup again (&lt;b&gt;): take it out a second time.
  s = s.replace(/<\/?[a-z!][^>]*>/gi, '');
  // eslint-disable-next-line no-control-regex
  s = s.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f\u200b-\u200f\u2028\u2029\u202a-\u202e\u2066-\u2069\ufeff]/g, '');
  s = s.replace(/[ \t\u00a0]+/g, ' ').replace(/ *\n */g, '\n').replace(/\n{3,}/g, '\n\n');
  return s.trim();
}

/** Single-line text (titles, names, SKUs): plain text, line breaks and runs of spaces collapsed. */
export function toPlainLine(input: string): string {
  return toPlainText(input).replace(/\s+/g, ' ').trim();
}

/** Lower-case, accents and punctuation removed — the key titles are compared on. */
export function normTitle(input: string): string {
  return toPlainLine(input)
    .normalize('NFKD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, ' ').trim();
}

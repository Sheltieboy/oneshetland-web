/**
 * One CSV reader for the data scripts.
 *
 * There were two: this character-by-character one, and a regex in
 * find-duplicate-listings.mjs that emitted a zero-length match for every empty
 * field, so `a,,b` drifted by a cell and a listing's NAME arrived where its id
 * should be. Postgres caught it — "invalid input syntax for type uuid" — but
 * only because ids are typed. A shifted name column would have gone through.
 *
 * Handles quoted fields, doubled quotes inside them, CRLF, and empty fields.
 */
export function parseCsv(text) {
  const rows = [];
  let row = [], field = "", quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") { row.push(field); field = ""; }
    else if (c === "\n") { row.push(field); rows.push(row); row = []; field = ""; }
    else if (c !== "\r") field += c;
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  const head = rows.shift().map((h) => h.trim());
  return rows
    .filter((r) => r.some((v) => v !== ""))
    .map((r) => Object.fromEntries(head.map((h, i) => [h, (r[i] ?? "").trim()])));
}

/** Quote a value for CSV output only when it needs it. */
export const csvEscape = (v) =>
  /[",\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v);

/** True if `v` looks like a UUID — a cheap guard against a drifted column. */
export const isUuid = (v) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(v || "").trim());

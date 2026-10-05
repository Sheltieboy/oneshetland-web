/**
 * csv.ts — a small, strict CSV reader and a formula-safe CSV writer.
 *
 * Pure: no imports, so it runs under plain node in tests and in the browser.
 *
 * READING
 *   · UTF-8 only (a leading Excel BOM is removed). Bytes that are not valid
 *     UTF-8 are refused rather than guessed at, because a wrongly decoded "£"
 *     becomes a wrong price.
 *   · Comma or semicolon delimiter, detected from the header line (Excel in a
 *     UK/EU locale writes semicolons when a comma is the decimal mark).
 *   · RFC 4180 quoting: "" inside quotes, delimiters and newlines inside quotes.
 *   · Hard limits: 2 MB and 500 data rows, checked before anything is parsed.
 *
 * WRITING
 *   A cell that begins with = + - @ tab or CR is treated by Excel / Sheets as a
 *   formula. The error report echoes merchant-supplied (and so untrusted) text,
 *   so every such cell is prefixed with an apostrophe before quoting.
 */

export const MAX_BYTES = 2 * 1024 * 1024;
export const MAX_ROWS = 500;

export type CsvErrorCode = 'too_large' | 'empty' | 'not_utf8' | 'binary' | 'spreadsheet' | 'too_many_rows' | 'no_header' | 'unclosed_quote';

export class CsvError extends Error {
  code: CsvErrorCode;
  constructor(code: CsvErrorCode, message: string) { super(message); this.code = code; this.name = 'CsvError'; }
}

export function decodeCsvBytes(bytes: Uint8Array): string {
  if (bytes.byteLength > MAX_BYTES) {
    throw new CsvError('too_large', `That file is ${(bytes.byteLength / 1048576).toFixed(1)} MB. The limit is 2 MB — split it into smaller files.`);
  }
  if (bytes.byteLength === 0) throw new CsvError('empty', 'That file is empty.');
  // .xlsx / .xlsm / .ods are zip archives.
  if (bytes.length > 3 && bytes[0] === 0x50 && bytes[1] === 0x4b && bytes[2] === 0x03 && bytes[3] === 0x04) {
    throw new CsvError('spreadsheet', 'That looks like an Excel or spreadsheet file, not a CSV. In Excel choose File → Save As → "CSV UTF-8 (Comma delimited)", then upload that.');
  }
  if (bytes.includes(0)) {
    // UTF-16 text files contain NULs too; both are refused with the same advice.
    throw new CsvError('binary', 'That file is not plain UTF-8 text. Save it as "CSV UTF-8" and try again.');
  }
  let text: string;
  try {
    text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    throw new CsvError('not_utf8', 'That file is not UTF-8. In Excel choose "CSV UTF-8 (Comma delimited)" when saving, then upload that.');
  }
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
}

/** Comma or semicolon, whichever the header line uses more outside quotes. */
export function detectDelimiter(text: string): ',' | ';' {
  let commas = 0, semis = 0, inQ = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') inQ = !inQ;
    else if (!inQ) {
      if (c === '\n' || c === '\r') break;
      if (c === ',') commas++; else if (c === ';') semis++;
    }
  }
  return semis > commas ? ';' : ',';
}

/** Parse into rows of cells with the physical line each row starts on (the header is line 1). Blank lines are dropped. */
export function parseCsvText(text: string, delimiter: ',' | ';'): { cells: string[]; line: number }[] {
  const rows: { cells: string[]; line: number }[] = [];
  let row: string[] = [];
  let cell = '';
  let inQ = false;
  let touched = false;           // anything seen on this row, even an empty quoted cell
  let line = 1;                  // physical line of the cursor
  let rowLine = 1;               // physical line the current row started on
  const endCell = () => { row.push(cell); cell = ''; };
  const endRow = () => {
    endCell();
    if (touched && !(row.length === 1 && row[0].trim() === '')) rows.push({ cells: row, line: rowLine });
    row = []; touched = false;
  };
  const touch = () => { if (!touched) { touched = true; rowLine = line; } };
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQ) {
      if (c === '"') {
        if (text[i + 1] === '"') { cell += '"'; i++; } else inQ = false;
      } else {
        if (c === '\n') line++;
        else if (c === '\r' && text[i + 1] !== '\n') line++;
        cell += c;
      }
      continue;
    }
    if (c === '"' && cell === '') { touch(); inQ = true; continue; }
    if (c === delimiter) { touch(); endCell(); continue; }
    if (c === '\r') { if (text[i + 1] === '\n') i++; endRow(); line++; continue; }
    if (c === '\n') { endRow(); line++; continue; }
    touch(); cell += c;
  }
  if (inQ) throw new CsvError('unclosed_quote', 'A quoted cell is never closed — check for a stray " in the file.');
  if (touched || cell !== '' || row.length) endRow();
  return rows;
}

export interface ParsedCsv {
  delimiter: ',' | ';';
  headers: string[];
  /** Data rows keyed by the physical file line they start on (the header is row 1, as in Excel). */
  rows: { rowNumber: number; cells: string[] }[];
}

export function parseCsvFile(bytes: Uint8Array): ParsedCsv {
  const text = decodeCsvBytes(bytes);
  const delimiter = detectDelimiter(text);
  const all = parseCsvText(text, delimiter);
  if (all.length === 0) throw new CsvError('empty', 'That file is empty.');
  const headers = all[0].cells.map((h) => h.trim());
  if (headers.every((h) => h === '')) throw new CsvError('no_header', 'The first line of the file must be the column names.');
  const body = all.slice(1);
  if (body.length > MAX_ROWS) {
    throw new CsvError('too_many_rows', `That file has ${body.length} rows. The limit is ${MAX_ROWS} — split it into smaller files.`);
  }
  return { delimiter, headers, rows: body.map((r) => ({ rowNumber: r.line, cells: r.cells })) };
}

/* ── Writing ─────────────────────────────────────────────────────────────── */

const FORMULA_START = /^[=+\-@\t\r]/;

export function csvCell(v: unknown): string {
  let s = v == null ? '' : String(v);
  if (FORMULA_START.test(s)) s = `'${s}`;
  return /[",\r\n;]/.test(s) || s !== s.trim() ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(rows: unknown[][]): string {
  return rows.map((r) => r.map(csvCell).join(',')).join('\r\n') + '\r\n';
}

/**
 * gen-marketing-docx.mjs — regenerate OneShetland-Marketing-Plan.docx from
 * MARKETING_PLAN.md (the source of truth). Handles the markdown subset the plan
 * uses: # / ## / ### headings, - bullets, 1. numbered lists, | tables |, ---
 * rules, and inline **bold** / *italic*.
 *
 * Usage:  (from oneshetland-web)
 *   npm install docx --no-save
 *   node scripts/gen-marketing-docx.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
  Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType,
  Table, TableRow, TableCell, WidthType, BorderStyle, ShadingType,
} from 'docx';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const SRC = join(ROOT, 'MARKETING_PLAN.md');
const OUT = join(ROOT, 'OneShetland-Marketing-Plan.docx');

const NAVY = '032F4C';
const INK = '23303A';
const MUTED = '5B6B75';

// ── Inline **bold** / *italic* → TextRun[] ──────────────────────────────────
function inlineRuns(text, base = {}) {
  const runs = [];
  let i = 0, buf = '', bold = false, italic = false;
  const flush = () => { if (buf) { runs.push(new TextRun({ text: buf, bold, italics: italic, color: base.color ?? INK, ...base })); buf = ''; } };
  while (i < text.length) {
    if (text[i] === '*' && text[i + 1] === '*') { flush(); bold = !bold; i += 2; continue; }
    if (text[i] === '*') { flush(); italic = !italic; i += 1; continue; }
    buf += text[i++];
  }
  flush();
  return runs.length ? runs : [new TextRun({ text: '', ...base })];
}

function heading(text, level) {
  const size = level === 1 ? 40 : level === 2 ? 30 : 24;
  return new Paragraph({
    heading: level === 1 ? HeadingLevel.TITLE : level === 2 ? HeadingLevel.HEADING_1 : HeadingLevel.HEADING_2,
    spacing: { before: level === 1 ? 0 : 280, after: level === 1 ? 80 : 120 },
    children: inlineRuns(text, { bold: true, color: NAVY, size }),
  });
}

function bullet(text) {
  return new Paragraph({ bullet: { level: 0 }, spacing: { after: 60 }, children: inlineRuns(text) });
}
function numbered(num, text) {
  return new Paragraph({
    spacing: { after: 60 }, indent: { left: 360, hanging: 360 },
    children: [new TextRun({ text: `${num}.  `, bold: true, color: NAVY }), ...inlineRuns(text)],
  });
}
function para(text, opts = {}) {
  return new Paragraph({ spacing: { after: 120 }, children: inlineRuns(text, opts.run), alignment: opts.align });
}
function rule() {
  return new Paragraph({ spacing: { before: 80, after: 80 }, border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: 'D7E0E6' } }, children: [new TextRun('')] });
}

const cellBorders = (color = 'D7E0E6') => {
  const b = { style: BorderStyle.SINGLE, size: 4, color };
  return { top: b, bottom: b, left: b, right: b };
};

function buildTable(rows) {
  const header = rows[0];
  const body = rows.slice(2); // skip the |---| separator row
  const cols = header.length;
  const mk = (cells, isHeader) =>
    new TableRow({
      tableHeader: isHeader,
      children: cells.map((c) =>
        new TableCell({
          width: { size: Math.floor(100 / cols), type: WidthType.PERCENTAGE },
          shading: isHeader ? { type: ShadingType.CLEAR, fill: NAVY, color: 'auto' } : undefined,
          borders: cellBorders(),
          margins: { top: 60, bottom: 60, left: 90, right: 90 },
          children: [new Paragraph({
            spacing: { after: 0 },
            children: inlineRuns(c, isHeader ? { bold: true, color: 'FFFFFF' } : {}),
          })],
        })),
    });
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [mk(header, true), ...body.map((r) => mk(r, false))],
  });
}

// ── Parse markdown ──────────────────────────────────────────────────────────
const md = readFileSync(SRC, 'utf8').replace(/\r\n/g, '\n');
const lines = md.split('\n');
const children = [];
let i = 0;
while (i < lines.length) {
  const line = lines[i];
  const t = line.trim();

  if (t === '') { i++; continue; }
  if (t === '---') { children.push(rule()); i++; continue; }

  if (t.startsWith('### ')) { children.push(heading(t.slice(4), 3)); i++; continue; }
  if (t.startsWith('## ')) { children.push(heading(t.slice(3), 2)); i++; continue; }
  if (t.startsWith('# ')) { children.push(heading(t.slice(2), 1)); i++; continue; }

  // Table block
  if (t.startsWith('|')) {
    const block = [];
    while (i < lines.length && lines[i].trim().startsWith('|')) {
      block.push(lines[i].trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map((c) => c.trim()));
      i++;
    }
    children.push(buildTable(block));
    children.push(new Paragraph({ spacing: { after: 120 }, children: [new TextRun('')] }));
    continue;
  }

  if (t.startsWith('- ')) { children.push(bullet(t.slice(2))); i++; continue; }
  const num = t.match(/^(\d+)\.\s+(.*)$/);
  if (num) { children.push(numbered(num[1], num[2])); i++; continue; }

  // Whole-line italic subtitle (*...*) → centred muted italic
  if (/^\*[^*].*\*$/.test(t) && !t.includes('**')) {
    children.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 160 }, children: [new TextRun({ text: t.slice(1, -1), italics: true, color: MUTED })] }));
    i++; continue;
  }

  children.push(para(t));
  i++;
}

const doc = new Document({
  creator: 'OneShetland',
  title: 'OneShetland — Launch Marketing Plan',
  styles: { default: { document: { run: { font: 'Calibri', size: 22, color: INK } } } },
  sections: [{ properties: { page: { margin: { top: 1100, bottom: 1100, left: 1100, right: 1100 } } }, children }],
});

const buf = await Packer.toBuffer(doc);
writeFileSync(OUT, buf);
console.log(`Wrote ${OUT} (${(buf.length / 1024).toFixed(1)} KB)`);

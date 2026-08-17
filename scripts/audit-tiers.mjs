#!/usr/bin/env node
/**
 * audit-tiers.mjs — finds every place that decides what a tier gets, and flags
 * any that don't derive from TIER_FEATURES.
 *
 * WHY THIS EXISTS.
 * The tier collapse replaced four disagreeing definitions with one map. Then a
 * fifth was found (dashboard tiles), then a sixth (the homepage shelf). Each was
 * invisible to typechecking, because hard-coding `=== "premium"` is perfectly
 * valid TypeScript that simply disagrees with the map.
 *
 * Run it after ANY change to tiers, pricing or gating:
 *   node scripts/audit-tiers.mjs
 *
 * Exit code 1 means something needs a human decision — not necessarily a bug,
 * but a place where the answer isn't derived and could drift.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = new URL("..", import.meta.url).pathname;
const SCAN = ["app", "components", "lib"];
const SKIP_FILES = ["listing-tiers.ts", "business-data.ts", "audit-tiers.mjs"];

/** Hard-coded tier comparisons — the pattern that keeps drifting. */
const HARDCODED = /subscription_tier\s*===?\s*["']|subscription_tier\s*!==?\s*["']|tier\s*===\s*["'](free|pro|premium)["']|tier\s*!==\s*["'](free|pro|premium)["']|\.in\(\s*["']subscription_tier["']/;
/** Money written as a literal rather than read from the price table.
 *  Only counts numbers used AS money — a 1200ms timeout isn't a price. */
const PRICE_LITERAL = /(£\s?\d+(\.\d\d)?\s*\/\s*(mo|month|yr|year))|((amount|price|pence|Pence|total|Total)\w*\s*[:=]\s*\d{3,6})|(\b(1999|4999)\b)/;
/** Copy that asserts which tier something belongs to. */
const TIER_CLAIM = /(with|on|to|from)\s+Premium\b|Premium (businesses|only|plan)|included with (Pro|Premium)|Go Premium/i;

function walk(dir, out = []) {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) { if (e !== "node_modules" && e !== ".next") walk(p, out); }
    else if (/\.(ts|tsx)$/.test(e) && !SKIP_FILES.includes(e)) out.push(p);
  }
  return out;
}

const findings = { hardcoded: [], price: [], claim: [] };

for (const dir of SCAN) {
  let files = [];
  try { files = walk(join(ROOT, dir)); } catch { continue; }
  for (const file of files) {
    const rel = relative(ROOT, file);
    readFileSync(file, "utf8").split("\n").forEach((line, i) => {
      const at = `${rel}:${i + 1}`;
      const t = line.trim();
      if (t.startsWith("//") || t.startsWith("*")) return;
      if (HARDCODED.test(line))     findings.hardcoded.push({ at, line: t.slice(0, 120) });
      if (PRICE_LITERAL.test(line)) findings.price.push({ at, line: t.slice(0, 120) });
      if (TIER_CLAIM.test(line))    findings.claim.push({ at, line: t.slice(0, 120) });
    });
  }
}

const section = (title, rows, why) => {
  console.log(`\n${title} — ${rows.length}`);
  console.log(`  ${why}`);
  if (!rows.length) return console.log("  (none)");
  for (const r of rows) console.log(`  • ${r.at}\n      ${r.line}`);
};

section("HARD-CODED TIER COMPARISONS", findings.hardcoded,
  "Each should either derive from tierUnlocks(tier, feature), or be a genuine\n  presentational choice (e.g. which card shows 'Recommended').");
section("PRICE LITERALS", findings.price,
  "Money written inline. Should come from TIER_PRICE / BOOKING_FEE_PENCE so a\n  price change can't leave a stale number behind.");
section("TIER CLAIMS IN COPY", findings.claim,
  "Sentences asserting which tier something belongs to. These can't be\n  typechecked — read each against TIER_FEATURES.");

const total = findings.hardcoded.length + findings.price.length + findings.claim.length;
console.log(`\n${total} places to eyeball. This is a prompt to check, not a list of bugs.`);
process.exit(total ? 1 : 0);

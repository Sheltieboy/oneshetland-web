/**
 * Write the opening-hours CSV back, after a human has been through it.
 *
 * Refuses to touch a listing that ALREADY has hours. Whoever put those there
 * — an owner in the editor, most likely — knows better than a script reading a
 * website, and silently replacing them would be the one way to turn this from
 * a help into a liability.
 *
 * Validates every value before it goes near the database, because the whole
 * point of the exercise is that the planner can trust what it reads: a day
 * that says "10:00-17:00" and means it, or nothing at all.
 *
 *   node scripts/apply-opening-hours.mjs                     # dry run
 *   SUPABASE_SERVICE_ROLE_KEY='…' node scripts/apply-opening-hours.mjs --write
 */
import fs from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { parseCsv, isUuid } from "./lib/csv.mjs";

const WRITE = process.argv.includes("--write");
const FILE = new URL("./data/opening-hours-proposals.csv", import.meta.url).pathname;

const envFile = new URL("../.env.local", import.meta.url).pathname;
if (fs.existsSync(envFile)) {
  for (const line of fs.readFileSync(envFile, "utf8").split("\n")) {
    const m = line.match(/^([A-Z_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}
const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  WRITE ? process.env.SUPABASE_SERVICE_ROLE_KEY
        : process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
);

const DAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];

/** Canonical "HH:MM-HH:MM", or "Closed". Anything else is rejected loudly. */
function normalise(v) {
  const t = (v ?? "").trim();
  if (!t) return { skip: true };
  if (/^closed$/i.test(t)) return { value: "Closed" };
  const m = /^(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})$/.exec(t);
  if (!m) return { error: `"${t}" is not HH:MM-HH:MM or Closed` };
  const [h1, m1, h2, m2] = [+m[1], +m[2], +m[3], +m[4]];
  if (h1 > 23 || h2 > 23 || m1 > 59 || m2 > 59) return { error: `"${t}" is not a real time` };
  const pad = (n) => String(n).padStart(2, "0");
  return { value: `${pad(h1)}:${pad(m1)}-${pad(h2)}:${pad(m2)}` };
}

const rows = parseCsv(fs.readFileSync(FILE, "utf8"));
const ids = rows.map((r) => r.id).filter(isUuid);

const { data: current, error } = await sb
  .from("local_businesses")
  .select("id, name, opening_hours, opening_hours_until")
  .in("id", ids);
if (error) { console.error(error.message); process.exit(1); }
const existing = new Map((current ?? []).map((r) => [r.id, r]));

const updates = [];
const problems = [];
let skippedHasHours = 0, skippedEmpty = 0;

for (const r of rows) {
  if (!isUuid(r.id)) { problems.push(`${r.name || "(no name)"}: "${r.id}" is not an id — row misread`); continue; }

  const now = existing.get(r.id);
  const hours = {};
  let bad = false;
  for (const d of DAYS) {
    const out = normalise(r[d]);
    if (out.error) { problems.push(`${r.name} (${d}): ${out.error}`); bad = true; break; }
    if (!out.skip) hours[d] = out.value;
  }
  if (bad) continue;
  if (Object.keys(hours).length === 0) { skippedEmpty++; continue; }

  /*
   * A row that already has hours is normally left alone — whoever put them
   * there, most likely the owner, knows better than a script reading a
   * website.
   *
   * The one exception is a row whose stored hours are EXACTLY what this file
   * says, which means we wrote them ourselves on an earlier run. Then the only
   * change is stamping on the season end date, and refusing would leave the
   * four seasonal museums with no expiry — the very problem this is for.
   * Anything else, including an owner correcting a single day, is left be.
   */
  const stored = now?.opening_hours ?? null;
  const hasStored = stored && Object.keys(stored).length > 0;
  if (hasStored) {
    const same = JSON.stringify(Object.entries(stored).sort()) === JSON.stringify(Object.entries(hours).sort());
    const dateAlreadyRight = (now?.opening_hours_until ?? null) === ((r.until || "").trim() || null);
    if (!same || dateAlreadyRight) { skippedHasHours++; continue; }
  }

  // Seasonal hours carry the date they stop being true, so the planner can
  // drop back to "check opening times" on its own instead of waiting for
  // somebody to remember.
  const until = (r.until || "").trim();
  if (until && !/^\d{4}-\d{2}-\d{2}$/.test(until)) {
    problems.push(`${r.name}: until "${until}" is not YYYY-MM-DD`);
    continue;
  }

  updates.push({ id: r.id, name: r.name, basis: r.basis, hours, until: until || null });
}

const byBasis = {};
updates.forEach((u) => { byBasis[u.basis] = (byBasis[u.basis] ?? 0) + 1; });

console.log(`${rows.length} rows in ${FILE.split("/").pop()}`);
console.log(`  to apply:                 ${updates.length}   ${JSON.stringify(byBasis)}`);
console.log(`  skipped (already has):    ${skippedHasHours}`);
console.log(`  skipped (nothing filled): ${skippedEmpty}`);
console.log(`  with a season end date:   ${updates.filter((u) => u.until).length}`);
if (problems.length) {
  console.log(`\n${problems.length} row(s) rejected — fix and re-run:`);
  problems.slice(0, 20).forEach((p) => console.log(`  · ${p}`));
}

if (!WRITE) { console.log("\nDRY RUN — nothing written. Pass --write."); process.exit(0); }
if (!process.env.SUPABASE_SERVICE_ROLE_KEY) { console.error("Writing needs SUPABASE_SERVICE_ROLE_KEY."); process.exit(1); }

let ok = 0, failed = 0;
for (const u of updates) {
  const { error: e } = await sb
    .from("local_businesses")
    .update({ opening_hours: u.hours, opening_hours_until: u.until })
    .eq("id", u.id);
  if (e) { failed++; console.error(`  ${u.name}: ${e.message}`); } else ok++;
}
console.log(`\nupdated: ${ok}, failed: ${failed}`);

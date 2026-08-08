/**
 * Write back the planner-context CSV after a human has been through it.
 *
 * The proposal script guesses; this one only ever applies what's in the file
 * you hand it. Anything you changed is marked `reviewed`, which outranks rules
 * and inference and will never be regenerated over.
 *
 * Refuses to touch a listing whose context came from its OWNER. Their answer
 * beats ours, always — that's the whole basis on which we can then ask them to
 * correct it.
 *
 *   node scripts/apply-planner-context.mjs                    # dry run
 *   SUPABASE_SERVICE_ROLE_KEY='…' node scripts/apply-planner-context.mjs --write
 *   … --file some-other.csv
 */
import fs from "node:fs";
import { createClient } from "@supabase/supabase-js";

const WRITE = process.argv.includes("--write");
const fileArg = process.argv.indexOf("--file");
const FILE = fileArg > -1
  ? process.argv[fileArg + 1]
  : new URL("./data/planner-context-proposals.csv", import.meta.url).pathname;

const envFile = new URL("../.env.local", import.meta.url).pathname;
if (fs.existsSync(envFile)) {
  for (const line of fs.readFileSync(envFile, "utf8").split("\n")) {
    const m = line.match(/^([A-Z_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}

/** Minimal CSV reader — handles quoted fields and doubled quotes. */
function parseCsv(text) {
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
  return rows.filter((r) => r.some((v) => v !== "")).map((r) => Object.fromEntries(head.map((h, i) => [h, (r[i] ?? "").trim()])));
}

const VALID_SETTING = ["indoor", "outdoor", "both"];
const VALID_BOOKING = ["none", "advised", "required"];
const VALID_CHIPS = [
  "families", "wet_day", "quick_stop", "proper_visit", "food_on_site", "dogs", "accessible", "free",
  "stay_overnight", "local_shop_food_etc", "quick_food_stop",
];

/**
 * Forgiving on spelling, strict on meaning.
 *
 * A human filling in 391 rows in a spreadsheet writes "indoors" and, once,
 * "outddors". Rejecting the row over that would be pedantry — the intent is
 * unmistakable. Anything genuinely ambiguous still fails loudly.
 */
function normaliseSetting(v) {
  const t = (v || "").trim().toLowerCase();
  if (!t) return "";
  if (/^in/.test(t)) return "indoor";        // indoor, indoors
  if (/^out/.test(t)) return "outdoor";      // outdoor, outdoors, outddors
  if (/^both|^bit/.test(t)) return "both";
  return v;
}

const parsed = parseCsv(fs.readFileSync(FILE, "utf8"));
const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  WRITE
    ? process.env.SUPABASE_SERVICE_ROLE_KEY
    : process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
);

// Owners always win. Fetch current state so we never overwrite one.
const { data: current } = await sb
  .from("local_businesses")
  .select("id, name, planner_context_source")
  .in("id", parsed.map((r) => r.id).filter(Boolean));
const sourceById = new Map((current ?? []).map((r) => [r.id, r.planner_context_source]));

const updates = [];
const problems = [];
let skippedOwner = 0;

for (const r of parsed) {
  if (!r.id) continue;
  if (sourceById.get(r.id) === "owner") { skippedOwner++; continue; }

  const ready = /^(true|yes|y|1)$/i.test(r.visitor_ready) ? true
    : /^(false|no|n|0)$/i.test(r.visitor_ready) ? false
    : null;
  if (ready === null) { problems.push(`${r.name}: visitor_ready "${r.visitor_ready}" not understood`); continue; }

  const patch = { planner_visitor_ready: ready };

  if (ready) {
    const dwell = Number(r.dwell_minutes);
    if (r.dwell_minutes && (!Number.isFinite(dwell) || dwell < 5 || dwell > 480)) {
      problems.push(`${r.name}: dwell "${r.dwell_minutes}" out of range`); continue;
    }
    if (dwell) patch.planner_dwell_minutes = dwell;

    const setting = normaliseSetting(r.setting);
    if (setting) {
      if (!VALID_SETTING.includes(setting)) { problems.push(`${r.name}: setting "${r.setting}"`); continue; }
      patch.planner_setting = setting;
    }
    if (r.booking) {
      if (!VALID_BOOKING.includes(r.booking)) { problems.push(`${r.name}: booking "${r.booking}"`); continue; }
      patch.planner_booking = r.booking;
    }
    if (r.good_for) {
      // Pipe is what the file asks for; commas happen. Accept both.
      const chips = r.good_for.split(/[|,]/).map((c) => c.trim()).filter(Boolean);
      const bad = chips.filter((c) => !VALID_CHIPS.includes(c));
      if (bad.length) { problems.push(`${r.name}: unknown chips ${bad.join(", ")}`); continue; }
      patch.planner_good_for = chips;
    }
    if (r.note) {
      if (r.note.length > 140) { problems.push(`${r.name}: note ${r.note.length} chars, max 140`); continue; }
      patch.planner_note = r.note;
    }
  }

  // Anything a person has been through counts as reviewed, which outranks
  // rules and inference and won't be regenerated over.
  patch.planner_context_source = r.proposed_by === "rules" || r.proposed_by === "inferred"
    ? r.proposed_by
    : "reviewed";

  updates.push({ id: r.id, name: r.name, patch });
}

console.log(`${parsed.length} rows in ${FILE.split("/").pop()}`);
console.log(`  to apply:            ${updates.length}`);
console.log(`  skipped (owner set): ${skippedOwner}`);
console.log(`  visitor-ready:       ${updates.filter((u) => u.patch.planner_visitor_ready).length}`);
if (problems.length) {
  console.log(`\n${problems.length} row(s) with problems — these are SKIPPED, fix and re-run:`);
  problems.slice(0, 20).forEach((p) => console.log(`  · ${p}`));
}

if (!WRITE) { console.log("\nDRY RUN — nothing written. Pass --write."); process.exit(0); }
if (!process.env.SUPABASE_SERVICE_ROLE_KEY) { console.error("Writing needs SUPABASE_SERVICE_ROLE_KEY."); process.exit(1); }

let ok = 0, failed = 0;
for (const u of updates) {
  const { error } = await sb.from("local_businesses").update(u.patch).eq("id", u.id);
  if (error) { failed++; console.error(`  ${u.name}: ${error.message}`); } else ok++;
}
console.log(`\nupdated: ${ok}, failed: ${failed}`);

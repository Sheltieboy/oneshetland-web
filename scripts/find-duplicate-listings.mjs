/**
 * Find listings that are the same place twice, and retire the thinner record.
 *
 * The directory holds pairs like "Jarlshof" and "Jarlshof Prehistoric and Norse
 * Settlement", 81 metres apart, both visitor-ready, with different dwell times —
 * so a plan could send somebody to Jarlshof twice and tell them 30 minutes when
 * it's 90.
 *
 * Narrow on purpose: same-ish name AND within 150 metres. Two shops in one
 * building are not duplicates — the Toll Clock centre alone has half a dozen
 * neighbours inside 100m, all genuinely separate businesses.
 *
 * Never DELETES. Sets is_active = false on the weaker record, so it drops out
 * of the directory and the planner but the row, and anything referencing it,
 * survives. Reversible with one update.
 *
 *   node scripts/find-duplicate-listings.mjs                  # report only
 *   SUPABASE_SERVICE_ROLE_KEY='…' … --write                   # retire the losers
 */
import fs from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { parseCsv, csvEscape, isUuid } from "./lib/csv.mjs";

const WRITE = process.argv.includes("--write");
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

const { data, error } = await sb
  .from("local_businesses")
  .select("id, name, description, website, phone, lat, lng, logo_url, cover_url, opening_hours, owner_id, is_claimed, planner_visitor_ready, planner_dwell_minutes, planner_note, planner_context_source, subscription_tier")
  .eq("is_active", true)
  .not("lat", "is", null);
if (error) { console.error(error.message); process.exit(1); }

const km = (a, b) =>
  Math.hypot((b.lat - a.lat) * 111, (b.lng - a.lng) * 111 * Math.cos((a.lat * Math.PI) / 180));
const key = (s) => (s || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

/**
 * Which record to SUGGEST keeping. A suggestion only — the CSV is where the
 * decision gets made.
 *
 * `reviewed` is deliberately NOT scored. It got Jarlshof backwards: the bare
 * "Jarlshof" row counted as reviewed merely for being in the bulk file, and so
 * outranked "Jarlshof Prehistoric and Norse Settlement" with its 90-minute
 * time and hand-written note. Being in a file somebody skimmed is not evidence
 * of quality.
 */
function score(b) {
  return (b.owner_id ? 1000 : 0)
    + (b.is_claimed ? 500 : 0)
    + (b.planner_note ? 60 : 0)
    + (b.description ? 30 : 0)
    + (b.opening_hours ? 20 : 0)
    + (b.website ? 15 : 0)
    + (b.phone ? 10 : 0)
    + (b.logo_url || b.cover_url ? 10 : 0)
    + (b.planner_dwell_minutes ? 5 : 0)
    + b.name.length / 100;   // the fuller name, all else equal
}

const pairs = [];
for (let i = 0; i < data.length; i++) {
  for (let j = i + 1; j < data.length; j++) {
    const a = data[i], b = data[j];
    const n1 = key(a.name), n2 = key(b.name);
    if (!(n1 === n2 || (n1.length > 5 && (n1.includes(n2) || n2.includes(n1))))) continue;
    const d = km({ lat: +a.lat, lng: +a.lng }, { lat: +b.lat, lng: +b.lng });
    if (d > 0.15) continue;
    const [keep, drop] = score(a) >= score(b) ? [a, b] : [b, a];
    pairs.push({ keep, drop, metres: Math.round(d * 1000) });
  }
}

if (pairs.length === 0) { console.log("No duplicate listings found."); process.exit(0); }

console.log(`${pairs.length} duplicate pair(s):\n`);
for (const p of pairs) {
  const both = p.keep.planner_visitor_ready && p.drop.planner_visitor_ready;
  console.log(`  ${p.metres}m apart${both ? "   ← both in plans, so a day could contain it twice" : ""}`);
  console.log(`    KEEP    ${p.keep.name}  (${p.keep.planner_dwell_minutes ?? "-"}min${p.keep.planner_note ? ", has a note" : ""}${p.keep.owner_id ? ", OWNED" : ""})`);
  console.log(`    retire  ${p.drop.name}  (${p.drop.planner_dwell_minutes ?? "-"}min${p.drop.owner_id ? ", OWNED — will NOT touch" : ""})`);
  console.log("");
}

const safe = pairs.filter((p) => !p.drop.owner_id && !p.drop.is_claimed);
if (safe.length !== pairs.length) {
  console.log(`${pairs.length - safe.length} pair(s) skipped: the weaker record is claimed or owned, which is a decision for a human.`);
}

const CSV = new URL("./data/duplicate-listings.csv", import.meta.url).pathname;

if (!WRITE) {
  // Write the decisions out for a human. `action` is the only column to edit:
  //   retire_b  — keep the first, retire the second (the suggestion)
  //   retire_a  — the other way round
  //   skip      — leave both alone, they're genuinely different
  const cols = ["action", "a_id", "a_name", "a_dwell", "a_note", "b_id", "b_name", "b_dwell", "b_note", "metres", "both_in_plans"];
  const rows = pairs.map((p) => ({
    action: "retire_b",
    a_id: p.keep.id, a_name: p.keep.name, a_dwell: p.keep.planner_dwell_minutes ?? "", a_note: (p.keep.planner_note ?? "").slice(0, 60),
    b_id: p.drop.id, b_name: p.drop.name, b_dwell: p.drop.planner_dwell_minutes ?? "", b_note: (p.drop.planner_note ?? "").slice(0, 60),
    metres: p.metres, both_in_plans: p.keep.planner_visitor_ready && p.drop.planner_visitor_ready ? "yes" : "no",
  }));
  fs.writeFileSync(CSV, [cols.join(","), ...rows.map((r) => cols.map((c) => csvEscape(r[c])).join(","))].join("\n") + "\n");
  console.log(`Decisions written to ${CSV}`);
  console.log("Set `action` per row: retire_b (keep the a_ one), retire_a (keep the b_ one), or skip.");
  console.log("Then re-run with --write.");
  process.exit(0);
}

if (!process.env.SUPABASE_SERVICE_ROLE_KEY) { console.error("Writing needs SUPABASE_SERVICE_ROLE_KEY."); process.exit(1); }
if (!fs.existsSync(CSV)) { console.error(`No ${CSV} — run without --write first and check it.`); process.exit(1); }

let ok = 0, skipped = 0;
for (const r of parseCsv(fs.readFileSync(CSV, "utf8"))) {
  const action = (r.action || "").trim();
  const target = action === "retire_b" ? r.b_id : action === "retire_a" ? r.a_id : null;
  const name = action === "retire_b" ? r.b_name : r.a_name;
  if (!target) { skipped++; continue; }
  // A drifted column is the failure mode worth guarding: an id cell holding a
  // name means the whole row is misaligned, so refuse it rather than write
  // is_active = false somewhere unintended.
  if (!isUuid(target)) { console.error(`  ${name || action}: "${target}" is not an id — row misread, skipping`); skipped++; continue; }
  const { error: e } = await sb.from("local_businesses").update({ is_active: false }).eq("id", target);
  if (e) console.error(`  ${name}: ${e.message}`); else { ok++; console.log(`  retired: ${name}`); }
}
console.log(`\nretired: ${ok}, skipped: ${skipped}  (is_active = false — reversible)`);

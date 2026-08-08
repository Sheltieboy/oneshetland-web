/**
 * Give the seeded OpenStreetMap places their planner context.
 *
 * Nobody owns a broch, so nobody is going to fill this in — but the defaults
 * are knowable from what the place IS. A lighthouse is a 25-minute outdoor
 * stop; a museum is an hour indoors and the right answer on a wet day.
 *
 * Only ever touches rows this project seeded (source='openstreetmap' AND a
 * source_ref), and only where the field is still null — anything a human has
 * since set is left exactly alone.
 *
 * Dry run by default. Pass --write, with SUPABASE_SERVICE_ROLE_KEY.
 */
import fs from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { SEEDED_DEFAULTS } from "../lib/planner-context.ts";

const WRITE = process.argv.includes("--write");
const envFile = new URL("../.env.local", import.meta.url).pathname;
if (fs.existsSync(envFile)) {
  for (const line of fs.readFileSync(envFile, "utf8").split("\n")) {
    const m = line.match(/^([A-Z_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}

const rows = JSON.parse(
  fs.readFileSync(new URL("./data/shetland-places-osm.json", import.meta.url).pathname, "utf8"),
);
const kindByRef = new Map(rows.map((r) => [r.osm_id, r.kind]));

function client() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  // A dry run only reads, and the listings are public — so it works on the anon
  // key and anybody can preview what this would do. Writing needs the service
  // role key, because RLS rightly refuses these updates otherwise.
  const key = WRITE
    ? process.env.SUPABASE_SERVICE_ROLE_KEY
    : process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    console.error(WRITE ? "Writing needs SUPABASE_SERVICE_ROLE_KEY." : "Need NEXT_PUBLIC_SUPABASE_URL.");
    process.exit(1);
  }
  return createClient(url, key);
}

const sb = client();
const { data: seeded, error } = await sb
  .from("local_businesses")
  .select("id, name, source_ref, planner_visitor_ready, planner_dwell_minutes, planner_setting, planner_good_for, planner_note")
  .eq("source", "openstreetmap")
  .not("source_ref", "is", null);

if (error) { console.error(error.message); process.exit(1); }

const updates = [];
const unknownKinds = new Set();

for (const row of seeded) {
  const kind = kindByRef.get(row.source_ref);
  if (!kind) continue;
  const d = SEEDED_DEFAULTS[kind];
  if (!d) { unknownKinds.add(kind); continue; }

  // Only fill what nobody has set. A human's answer always wins.
  const patch = { id: row.id };
  if (row.planner_visitor_ready === null) patch.planner_visitor_ready = d.visitorReady;
  if (row.planner_dwell_minutes === null && d.dwell) patch.planner_dwell_minutes = d.dwell;
  if (row.planner_setting === null && d.setting) patch.planner_setting = d.setting;
  if (row.planner_good_for === null && d.goodFor) patch.planner_good_for = d.goodFor;
  if (row.planner_note === null && d.note) patch.planner_note = d.note;
  if (Object.keys(patch).length > 1) updates.push({ patch, name: row.name, kind });
}

const ready = updates.filter((u) => u.patch.planner_visitor_ready === true).length;
const notReady = updates.filter((u) => u.patch.planner_visitor_ready === false).length;
console.log(`${seeded.length} seeded places; ${updates.length} to fill in`);
console.log(`  marked visitor-ready:     ${ready}`);
console.log(`  marked NOT for visitors:  ${notReady}  (halls, library — stay in the Directory)`);
if (unknownKinds.size) console.log(`  no default for kind:      ${[...unknownKinds].join(", ")}`);
console.log("\nfirst five:");
for (const u of updates.slice(0, 5)) {
  console.log(`  · ${u.name} (${u.kind}) → ${u.patch.planner_dwell_minutes ?? "—"} min, ${u.patch.planner_setting ?? "—"}`);
}

if (!WRITE) {
  console.log("\nDRY RUN — nothing written. Pass --write.");
  process.exit(0);
}

let ok = 0, failed = 0;
for (const u of updates) {
  const { id, ...fields } = u.patch;
  const { error: e } = await sb.from("local_businesses").update(fields).eq("id", id);
  if (e) { failed++; console.error(`  ${u.name}: ${e.message}`); } else ok++;
}
console.log(`\nupdated: ${ok}, failed: ${failed}`);

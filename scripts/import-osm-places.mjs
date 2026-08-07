/**
 * Seed OpenStreetMap places into the OneShetland directory.
 *
 * Dry run by default — pass --write to actually insert. Everything it creates
 * carries source='openstreetmap' and the OSM id, so a re-run updates rather
 * than duplicates, and one delete on source undoes the whole thing without
 * touching anything a person typed.
 *
 * Only Tier A goes in (see osm_clean.py): named places a visitor would
 * actually be sent to. Field cairns stay out.
 *
 * Opening hours: only the unambiguous weekday patterns are converted. OSM's
 * seasonal syntax ("Apr 01-Sep 30 …; Oct 01-Mar 31 off") can't be expressed in
 * our per-day format, and claiming Jarlshof is open in November is worse than
 * saying nothing — those are left blank for a human.
 */
import fs from "node:fs";
import { createClient } from "@supabase/supabase-js";

const WRITE = process.argv.includes("--write");
const HERE = new URL("./data/", import.meta.url).pathname;

// Reads .env.local for the project URL; the SERVICE ROLE key must be supplied
// on the command line, never committed. RLS refuses these inserts under anon.
const envFile = new URL("../.env.local", import.meta.url).pathname;
if (fs.existsSync(envFile)) {
  for (const line of fs.readFileSync(envFile, "utf8").split("\n")) {
    const m = line.match(/^([A-Z_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}

function client() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error("Need NEXT_PUBLIC_SUPABASE_URL (from .env.local) and SUPABASE_SERVICE_ROLE_KEY (pass it in).");
    process.exit(1);
  }
  return createClient(url, key);
}

const rows = JSON.parse(fs.readFileSync(HERE + "shetland-places-osm.json", "utf8"));

const DAYS = { Mo: "mon", Tu: "tue", We: "wed", Th: "thu", Fr: "fri", Sa: "sat", Su: "sun" };
const ORDER = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];

/** Convert only the clear cases; anything seasonal or odd returns null. */
function convertHours(osm) {
  if (!osm) return null;
  if (/\b(Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec|Jan|Feb|Mar)\b/.test(osm)) return null; // seasonal
  if (osm.trim() === "24/7") return null;                                             // not a shop
  if (osm.includes("PH") || osm.includes("off")) return null;

  const out = {};
  for (const part of osm.split(";")) {
    const m = part.trim().match(/^([A-Za-z,\-]+)\s+(\d{2}:\d{2})-(\d{2}:\d{2})$/);
    if (!m) return null;                       // one unparseable clause → trust none of it
    const [, daySpec, open, close] = m;
    for (const chunk of daySpec.split(",")) {
      const range = chunk.match(/^([A-Za-z]{2})-([A-Za-z]{2})$/);
      if (range) {
        const a = ORDER.indexOf(DAYS[range[1]]), b = ORDER.indexOf(DAYS[range[2]]);
        if (a < 0 || b < 0) return null;
        for (let i = a; i <= b; i++) out[ORDER[i]] = `${open}-${close}`;
      } else {
        const d = DAYS[chunk];
        if (!d) return null;
        out[d] = `${open}-${close}`;
      }
    }
  }
  return Object.keys(out).length ? out : null;
}

const tierA = rows.filter((r) => r.tier === "A" && !r.duplicate_of);

const payload = tierA.map((r) => ({
  name: r.name,
  category: r.category,
  // address is NOT NULL; OSM gives no postal address for a broch in a field,
  // so the kind plus "Shetland" is the honest placeholder until someone claims it.
  address: `${r.kind}, Shetland`,
  description: r.description || null,
  lat: r.lat,
  lng: r.lng,
  website: r.website || null,
  phone: r.phone || null,
  opening_hours: convertHours(r.opening_hours_osm),
  is_active: true,
  is_claimed: false,
  owner_id: null,
  source: "openstreetmap",
  source_ref: r.osm_id,
}));

const withHours = payload.filter((p) => p.opening_hours).length;
console.log(`${payload.length} listings to seed (Tier A, not already in the directory)`);
console.log(`  with opening hours converted: ${withHours}`);
console.log(`  with a website:               ${payload.filter((p) => p.website).length}`);
console.log("\nfirst five:");
for (const p of payload.slice(0, 5)) {
  console.log(`  · ${p.name} — ${p.address}${p.opening_hours ? " — hours ✓" : ""}`);
}

if (!WRITE) {
  console.log("\nDRY RUN — nothing written. Pass --write to insert.");
  process.exit(0);
}

let ok = 0, failed = 0;
for (let i = 0; i < payload.length; i += 50) {
  const batch = payload.slice(i, i + 50);
  const { error } = await client().from("local_businesses").upsert(batch, { onConflict: "source,source_ref" });
  if (error) { console.error("batch failed:", error.message); failed += batch.length; }
  else ok += batch.length;
}
console.log(`\nwritten: ${ok}, failed: ${failed}`);

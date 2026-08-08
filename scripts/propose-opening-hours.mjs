/**
 * Propose opening hours for listings that have none.
 *
 * 325 visitor-ready listings have no hours, so every one of them shows "check
 * opening times" in a plan and can never be scheduled with confidence. This
 * closes the part of that gap which needs no research at all.
 *
 * TWO KINDS OF ROW, and conflating them is the mistake to avoid:
 *
 *   OPEN ACCESS — a broch on open ground, a lighthouse on a headland, a ruined
 *   chapel. Nobody unlocks these in the morning. Their hours aren't unknown,
 *   they're unrestricted, and "check opening times before you go" is not
 *   caution there, it's noise that makes the honest warnings easier to ignore.
 *   Proposed by rule, all seven days.
 *
 *   EVERYTHING ELSE — a museum, a café, a shop. These have real hours that only
 *   the business or its own website can tell us. This script will NOT guess
 *   them: it writes the row out with empty days and a `research` marker so a
 *   person, or a researched CSV, fills them in. A confidently wrong opening
 *   time sends somebody across the island to a locked door, which is worse
 *   than the warning we're trying to remove.
 *
 *   node scripts/propose-opening-hours.mjs            # writes the CSV
 *   node scripts/propose-opening-hours.mjs --summary  # just the counts
 */
import fs from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { csvEscape } from "./lib/csv.mjs";

/**
 * Hours read off each business's own website, keyed by listing name, with the
 * page they came from. Kept in a file rather than typed into the CSV so the
 * research survives a re-run of this script.
 */
const RESEARCHED = JSON.parse(
  fs.readFileSync(new URL("./data/researched-hours.json", import.meta.url).pathname, "utf8"),
);

const envFile = new URL("../.env.local", import.meta.url).pathname;
if (fs.existsSync(envFile)) {
  for (const line of fs.readFileSync(envFile, "utf8").split("\n")) {
    const m = line.match(/^([A-Z_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}
const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
);

const DAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
const ALL_DAY = "00:00-23:59";

/**
 * Names that mean "open ground, no door". Matched as whole words so "Quendale
 * Mill" isn't caught by a "mill" rule and "Broch of Culswick" is.
 */
const OPEN_ACCESS = [
  /\bbroch\b/i, /\bcairn\b/i, /\bstanding stones?\b/i, /\bstone circle\b/i,
  /\bruins?\b/i, /\bchapel ruins?\b/i, /\bkirk ruins?\b/i,
  /\blighthouse\b/i, /\bviewpoint\b/i, /\bheadland\b/i, /\bness\b/i,
  /\bbattery\b/i, /\bwar memorial\b/i, /\bmemorial\b/i,
  /\bburnt mound\b/i, /\bsettlement\b/i, /\bfort\b/i, /\bdun\b/i,
  /\bbeach\b/i, /\bsands\b/i, /\bnature reserve\b/i, /\bnoust\b/i,
  // Added after reading the 44 the first pass missed. Public parks and
  // playparks are open ground; a roofless chapel has no door to lock; the
  // prehistoric sites are fields with stones in them.
  /\bpark\b/i, /\bplaypark\b/i, /\bcommunity garden\b/i,
  /\bchapel\b/i, /\btemple\b/i, /\bstack\b/i, /\bknowe\b/i,
  /\bmonument\b/i, /\bhjaltadans\b/i, /\brounds of\b/i,
];

/**
 * Anything staffed, ticketed or lockable — never proposed by rule even if the
 * name also matches above. "Jarlshof Prehistoric and Norse Settlement" has a
 * visitor centre and a gate; it is not a field with a broch in it.
 */
const STAFFED = [
  /\bmuseum\b/i, /\bcentre\b/i, /\bcenter\b/i, /\bgallery\b/i, /\bshop\b/i,
  /\bcafé\b/i, /\bcafe\b/i, /\bbar\b/i, /\brestaurant\b/i, /\bhotel\b/i,
  /\bdistillery\b/i, /\btheatre\b/i, /\bexhibition\b/i, /\bvisitor\b/i,
  /\bheritage\b/i, /\bhaven\b/i, /\bhaa\b/i, /\bmill\b/i, /\bjarlshof\b/i,
  /\bbooth\b/i, /\bstudio\b/i, /\bgarage\b/i, /\boffice\b/i,
];

const isOpenAccess = (r) =>
  r.planner_setting === "outdoor" &&
  !STAFFED.some((re) => re.test(r.name)) &&
  OPEN_ACCESS.some((re) => re.test(r.name));

const { data, error } = await sb
  .from("local_businesses")
  .select("id, name, category, website, phone, address, opening_hours, planner_setting, planner_visitor_ready, source")
  .eq("is_active", true)
  .eq("planner_visitor_ready", true);
if (error) { console.error(error.message); process.exit(1); }

const missing = data.filter((r) => !r.opening_hours || Object.keys(r.opening_hours).length === 0);

const openAccess = missing.filter(isOpenAccess);
const needsResearch = missing.filter((r) => !isOpenAccess(r));

console.log(`visitor-ready with no hours: ${missing.length}`);
console.log(`  open access (rule):        ${openAccess.length}  ← proposed all-day, seven days`);
console.log(`  needs a real answer:       ${needsResearch.length}`);
console.log(`     already researched:    ${needsResearch.filter((r) => RESEARCHED[r.name]).length}  ← from the business's own site`);
console.log(`     of those, has website:  ${needsResearch.filter((r) => r.website).length}`);

if (process.argv.includes("--summary")) process.exit(0);

const cols = ["id", "name", "category", "basis", "source_url", ...DAYS, "caveat", "until", "website", "phone"];
const rows = [
  ...openAccess.map((r) => ({
    id: r.id, name: r.name, category: r.category,
    basis: "open_access",
    source_url: "",
    ...Object.fromEntries(DAYS.map((d) => [d, ALL_DAY])),
    caveat: "", until: "",
    website: r.website ?? "", phone: r.phone ?? "",
  })),
  ...needsResearch
    .sort((a, b) => {
      // Rows we already have an answer for float to the top, then anything
      // with a website (the next ones worth looking up), then the rest.
      const ra = RESEARCHED[a.name] ? 2 : a.website ? 1 : 0;
      const rb = RESEARCHED[b.name] ? 2 : b.website ? 1 : 0;
      return rb - ra || a.name.localeCompare(b.name);
    })
    .map((r) => {
      const found = RESEARCHED[r.name];
      return {
        id: r.id, name: r.name, category: r.category,
        basis: found ? "researched" : "research",
        source_url: found?.source ?? "",
        ...Object.fromEntries(DAYS.map((d) => [d, found?.hours?.[d] ?? ""])),
        caveat: found?.caveat ?? "", until: found?.until ?? "",
        website: r.website ?? "", phone: r.phone ?? "",
      };
    }),
];

const OUT = new URL("./data/opening-hours-proposals.csv", import.meta.url).pathname;
fs.writeFileSync(OUT, [cols.join(","), ...rows.map((r) => cols.map((c) => csvEscape(r[c])).join(","))].join("\n") + "\n");
console.log(`\nWritten to ${OUT}`);
console.log("Fill the day columns as HH:MM-HH:MM or Closed. Leave a row blank to skip it.");
console.log("Put where you got it in source_url — that's what makes it checkable later.");

/**
 * Propose planner context for the businesses that have none — as a CSV for a
 * human to check before anything touches the database.
 *
 * Two passes:
 *   RULES     — category alone, no invention. A café is an hour indoors; a
 *               hotel is somewhere you sleep, not a stop on a day out.
 *   INFERRED  — with --ai, Peerie Bot reads the business's own description and
 *               proposes a dwell, a setting, chips and one plain line.
 *
 * Nothing is written. It produces scripts/data/planner-context-proposals.csv,
 * which is meant to be opened, corrected and handed back to
 * apply-planner-context.mjs. Darren knows these businesses; the machine
 * doesn't. This file is the point at which that knowledge gets in.
 *
 *   node scripts/propose-planner-context.mjs
 *   ANTHROPIC_API_KEY='sk-…' node scripts/propose-planner-context.mjs --ai
 */
import fs from "node:fs";
import { createClient } from "@supabase/supabase-js";

const USE_AI = process.argv.includes("--ai");
const OUT = new URL("./data/planner-context-proposals.csv", import.meta.url).pathname;

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

/**
 * Category rules. Deliberately dull — every one of these is defensible from
 * the category alone, with nothing invented.
 *
 * Accommodation is visitor_ready FALSE on purpose: you sleep at a hotel, you
 * don't visit one on a day out. It stays in the Directory exactly as now.
 * Services likewise — a parliamentary office and "HyImpulse UK" are both
 * `services`, and neither is a day out.
 */
const RULES = {
  food_drink:    { ready: true,  dwell: 60, setting: "indoor", goodFor: ["food_on_site"] },
  retail:        { ready: true,  dwell: 30, setting: "indoor", goodFor: [] },
  tourism:       { ready: true,  dwell: 60, setting: "both",   goodFor: ["proper_visit"] },
  accommodation: { ready: false },
  services:      { ready: false },
  other:         { ready: false },
};

/**
 * What Peerie Bot may and may not infer.
 *
 * It may judge how long folk spend, indoors or out, and whether somewhere
 * suits families, a wet day, a quick stop or a proper visit — all readable
 * from a description, and all harmless if a little off.
 *
 * It may NOT infer step-free access, free entry, or dogs welcome. Those are
 * checkable promises: a wheelchair user turned away at a step, or someone
 * arriving expecting free entry, is a real harm and not ours to risk on a
 * guess. Only the business gets to say those.
 */
const INFERABLE_CHIPS = ["families", "wet_day", "quick_stop", "proper_visit", "food_on_site"];

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    visitor_ready: { type: "boolean", description: "Would a visitor on a day out go here? False for trade counters, offices, anywhere a visitor turning up is a nuisance." },
    dwell_minutes: { type: "integer", description: "Typical visit in minutes: 15, 30, 45, 60, 90 or 120." },
    setting: { type: "string", enum: ["indoor", "outdoor", "both"] },
    good_for: { type: "array", items: { type: "string", enum: INFERABLE_CHIPS }, description: "Only what the description supports. [] if unsure." },
    note: { type: "string", description: "One plain line, max 140 chars, on what a visitor actually does here. Drawn ONLY from the description given. \"\" if the description doesn't say enough." },
  },
  required: ["visitor_ready", "dwell_minutes", "setting", "good_for", "note"],
};

const SYSTEM =
  `You are Peerie Bot, preparing Shetland business listings for a visitor day planner.\n\n` +
  `You are given a business's own name, category and description. Judge how it would fit into a day out.\n\n` +
  `Rules:\n` +
  `• Use ONLY what the description says. Never invent facilities, prices, opening times or history.\n` +
  `• If the description is too thin to judge, set visitor_ready false and note "".\n` +
  `• The note is plain English, one sentence, no marketing. "Hand-knitted Fair Isle, and a café at the back" — ` +
  `not "a warm Shetland welcome awaits".\n` +
  `• visitor_ready false for offices, trade counters, wholesalers, plant hire, funeral directors, and anything ` +
  `where a visitor turning up would be a nuisance.\n` +
  `• Never claim step-free access, free entry or dogs welcome. You are not given that and must not guess it.`;

async function inferOne(client, b) {
  const resp = await client.messages.create({
    model: "claude-opus-4-8",
    max_tokens: 700,
    output_config: { effort: "low", format: { type: "json_schema", schema: SCHEMA } },
    system: SYSTEM,
    messages: [{
      role: "user",
      content: `Name: ${b.name}\nCategory: ${b.category ?? "unknown"}\nDescription: ${b.description}`,
    }],
  });
  const block = resp.content.find((x) => x.type === "text");
  return block ? JSON.parse(block.text) : null;
}

const { data: all, error } = await sb
  .from("local_businesses")
  .select("id, name, category, description, lat, lng, source")
  .eq("is_active", true)
  .is("planner_visitor_ready", null);

if (error) { console.error(error.message); process.exit(1); }

const rows = [];
let aiUsed = 0, aiFailed = 0;

let anthropic = null;
if (USE_AI) {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error("--ai needs ANTHROPIC_API_KEY. Run without --ai for rules only.");
    process.exit(1);
  }
  const { default: Anthropic } = await import("@anthropic-ai/sdk");
  anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY, timeout: 30000 });
}

for (const b of all) {
  const rule = RULES[b.category ?? "other"] ?? RULES.other;
  let p = {
    visitor_ready: rule.ready,
    dwell_minutes: rule.dwell ?? "",
    setting: rule.setting ?? "",
    good_for: (rule.goodFor ?? []).join("|"),
    note: "",
    proposed_by: "rules",
  };

  const hasDescription = !!b.description && b.description.trim().length > 40;
  if (anthropic && hasDescription) {
    try {
      const out = await inferOne(anthropic, { ...b, description: b.description.slice(0, 600) });
      if (out) {
        p = {
          visitor_ready: out.visitor_ready,
          dwell_minutes: out.dwell_minutes || "",
          setting: out.setting || "",
          good_for: (out.good_for ?? []).filter((c) => INFERABLE_CHIPS.includes(c)).join("|"),
          note: (out.note || "").slice(0, 140),
          proposed_by: "inferred",
        };
        aiUsed++;
      }
    } catch {
      aiFailed++;   // keep the rules proposal
    }
  }

  rows.push({
    id: b.id,
    name: b.name,
    category: b.category ?? "",
    has_coords: b.lat != null ? "yes" : "NO — cannot be planned",
    ...p,
    their_description: (b.description ?? "").replace(/\s+/g, " ").slice(0, 160),
  });
}

const cols = ["id", "name", "category", "has_coords", "visitor_ready", "dwell_minutes", "setting", "good_for", "booking", "note", "proposed_by", "their_description"];
const esc = (v) => {
  const s = String(v ?? "");
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
fs.writeFileSync(
  OUT,
  [cols.join(","), ...rows.map((r) => cols.map((c) => esc(r[c] ?? "")).join(","))].join("\n") + "\n",
);

const ready = rows.filter((r) => r.visitor_ready === true).length;
console.log(`${rows.length} businesses with no context yet`);
console.log(`  proposed visitor-ready:  ${ready}`);
console.log(`  proposed NOT for plans:  ${rows.length - ready}`);
if (USE_AI) console.log(`  read by Peerie Bot:      ${aiUsed}${aiFailed ? ` (${aiFailed} failed, left on rules)` : ""}`);
console.log(`  no coordinates:          ${rows.filter((r) => r.has_coords !== "yes").length}  (can't appear in a plan whatever we say)`);
console.log(`\nwritten to ${OUT}`);
console.log("Open it, correct anything you know better, then run apply-planner-context.mjs.");

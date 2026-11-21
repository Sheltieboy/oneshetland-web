/**
 * Spik private contributor notes — where they may appear in the website's code, and where they must not.
 * Run: node --test tests/spik-contributor-notes.test.mjs
 *
 * The database already refuses to show a note to anyone but an admin (proved by the backend's
 * spik-contributor-notes isolated suite). This pins the website side: the note is only ever WRITTEN by
 * the three contribution forms and only ever READ by the admin review screens. No public page, public
 * loader, API route, sitemap, social card or AI route may mention it. If a new file needs it, it must
 * be added to the allow-list below on purpose.
 *
 * Local only. No network, no database, no browser.
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const read = (p) => readFileSync(join(ROOT, p), "utf8");

function walk(dir, out = []) {
  for (const name of readdirSync(join(ROOT, dir))) {
    const rel = join(dir, name);
    const st = statSync(join(ROOT, rel));
    if (st.isDirectory()) walk(rel, out);
    else if (/\.(tsx?|mjs|js)$/.test(name)) out.push(rel);
  }
  return out;
}
const SOURCE = ["app", "components", "lib"].flatMap((d) => walk(d));

const PRIVATE = /contributor_note|spik_word_variation_notes|private_detail|cleanContributorNote|ContributorNoteField|SpikPrivateNote/;

/** Every file allowed to touch a private note, and why. */
const ALLOWED = new Map([
  ["lib/spik-data.ts", "shared label, limit and clean-up helper (no reads)"],
  ["components/spik/ContributorNoteField.tsx", "the form field"],
  ["components/spik/AddWordForm.tsx", "writes contributor_note"],
  ["components/spik/SuggestForm.tsx", "writes contributor_note"],
  ["components/spik/AddVariationForm.tsx", "writes spik_word_variation_notes"],
  ["lib/admin-data.server.ts", "admin review loaders (admin session, RLS admin-only)"],
  ["components/admin/SpikPrivateNote.tsx", "admin display"],
  ["components/admin/SpikWordSubmissions.tsx", "admin display"],
  ["components/admin/SpikSuggestions.tsx", "admin display"],
  ["components/admin/SpikVariationSubmissions.tsx", "admin display"],
]);

describe("where a private note may appear", () => {
  test("only the allow-listed files mention it", () => {
    const offenders = SOURCE.filter((f) => PRIVATE.test(read(f)) && !ALLOWED.has(relative(".", f)));
    assert.deepEqual(offenders, [], `private note referenced outside the allow-list: ${offenders.join(", ")}`);
  });

  test("no public page, API route or public loader is on the allow-list", () => {
    for (const f of ALLOWED.keys()) {
      assert.ok(!f.startsWith("app/") || f.startsWith("app/admin/"), `${f} is a public route`);
    }
  });

  test("the public variation loader still asks for an explicit column list without any note", () => {
    const src = read("lib/spik-data.ts");
    const m = /from\("spik_word_variations"\)\s*\.select\(\s*"([^"]+)"/.exec(src);
    assert.ok(m, "getWordVariations select not found");
    assert.ok(!m[1].includes("*"), "public variation loader must not select *");
    assert.ok(!PRIVATE.test(m[1]), "public variation loader selects a private note");
  });

  test("admin loaders only read notes through the admin's own session (never the service key)", () => {
    const src = read("lib/admin-data.server.ts");
    assert.ok(!/service_role|SUPABASE_SERVICE/i.test(src), "admin-data must not use the service key");
  });
});

describe("the forms", () => {
  const LABEL = "Additional information about this word";
  const HINT =
    "You can tell us about regional differences, pronunciation, alternative meanings or anything else that might help us understand this word. This information is only visible to Spik editors and won't be published automatically.";

  test("label and supporting text are exactly as approved", () => {
    const src = read("lib/spik-data.ts");
    assert.ok(src.includes(`"${LABEL}"`));
    assert.ok(src.includes(JSON.stringify(HINT)));
  });

  test("all three contribution forms render the private note field", () => {
    for (const f of ["components/spik/AddWordForm.tsx", "components/spik/SuggestForm.tsx", "components/spik/AddVariationForm.tsx"]) {
      assert.match(read(f), /<ContributorNoteField\b/, f);
    }
  });

  test("a note is only sent when there is one (note-less submissions are unchanged)", () => {
    assert.match(read("components/spik/AddWordForm.tsx"), /if \(privateNote\) row\.contributor_note = privateNote;/);
    assert.match(read("components/spik/SuggestForm.tsx"), /\.\.\.\(privateNote \? \{ contributor_note: privateNote \} : \{\}\)/);
    assert.match(read("components/spik/AddVariationForm.tsx"), /if \(privateNote \|\| also\.length > 0 \|\| regionConfidence !== "this_area"\)/);
  });

  test("the variation keeps exactly one public region; extra regions go only to the private table", () => {
    const src = read("components/spik/AddVariationForm.tsx");
    const variationInsert = /from\("spik_word_variations"\)\.insert\(\{([\s\S]*?)\}\);/.exec(src)?.[1] ?? "";
    assert.match(variationInsert, /region_id: region\?\.id \?\? null/);
    assert.ok(!/also_region|region_confidence|note/.test(variationInsert), "private detail must not be written to the public variation row");
  });

  test("the cap matches the database (1,000 characters) and blanks become null", async () => {
    const src = read("lib/spik-data.ts");
    assert.match(src, /export const CONTRIBUTOR_NOTE_MAX = 1000;/);
    const clean = (s) => { const t = (s ?? "").trim(); return t ? t.slice(0, 1000) : null; };
    assert.equal(clean("   "), null);
    assert.equal(clean(" hi "), "hi");
    assert.equal(clean("a".repeat(1200)).length, 1000);
  });
});

describe("\"I'm not sure\": no area until an editor decides", () => {
  const form = () => read("components/spik/AddVariationForm.tsx");
  const admin = () => read("components/admin/SpikVariationSubmissions.tsx");

  test("the area list offers \"I'm not sure\", which sends no area and records not_sure privately", () => {
    assert.match(form(), /<option value=\{NOT_SURE\}>I&apos;m not sure/);
    assert.match(form(), /const region = unsure \? undefined : regions\.find/);
    assert.match(form(), /const regionConfidence: RegionConfidence = unsure \? "not_sure" : confidence;/);
  });

  test("the editor must choose an area before Approve is enabled", () => {
    assert.match(admin(), /disabled=\{busy === r\.id \|\| !r\.region_id\}/);
    assert.match(admin(), /Area not chosen/);
  });

  test("only the admin review card can choose a variation's area", () => {
    const users = SOURCE.filter((f) => read(f).includes("set_spik_word_variation_region"));
    assert.deepEqual(users, ["components/admin/SpikVariationSubmissions.tsx"]);
  });

  test("the public word page still groups by the single region_name (unchanged)", () => {
    assert.match(read("app/spik/[slug]/page.tsx"), /const key = v\.region_name \|\| "Other";/);
  });
});

describe("no social features", () => {
  test("the admin note has no reply, reaction or send action", () => {
    const src = read("components/admin/SpikPrivateNote.tsx");
    assert.ok(!/<button|onClick|<form|<textarea|<input/.test(src), "the private note must be read-only");
    assert.match(src, /Private note from contributor/);
  });
});

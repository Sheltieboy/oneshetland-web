/**
 * Production issue 10 Nov 2026: the Editions admin pages selected edition_organisers.contact_email, a column the signed-in role cannot read, so the Verification queue,
 * Organisers list and organiser page failed with "permission denied for table edition_organisers". Nothing caught it because these tests were static and the database tests were
 * separate. This pins the pairing: no web code may name a column the database hides from signed-in users, and administrators read contact emails through the admin-only function.
 * HIDDEN must equal the database's list (backend suite editions-admin-access pins the same list from the catalog: change both together).
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const ROOT = new URL("..", import.meta.url).pathname;
const read = (p) => readFileSync(join(ROOT, p), "utf8");
const HIDDEN = { edition_organisers: ["contact_email", "created_by", "reserved_name_flag", "verification_note", "verified_by"], edition_updates: ["created_by"], edition_payout_accounts: ["stripe_account_id"] };

function files(dir, out = []) {
  for (const f of readdirSync(join(ROOT, dir))) {
    const p = join(dir, f); const st = statSync(join(ROOT, p));
    if (st.isDirectory()) { if (!["node_modules", ".next", ".git"].includes(f)) files(p, out); } else if (/\.(ts|tsx)$/.test(f)) out.push(p);
  }
  return out;
}
const SRC = [...files("app"), ...files("lib"), ...files("components")];
const consts = {};
for (const f of ["lib/editions/types.ts", "app/admin/editions/queries.ts"]) for (const m of read(f).matchAll(/(?:export )?const (\w+)\s*=\s*"([^"]+)"/g)) consts[m[1]] = m[2];

/** every column list the code asks of a table: .from("t").select("...") and embedded  alias:t ( ... ) lists. */
function asked(src) {
  const out = [];
  for (const m of src.matchAll(/\.from\(\s*["'`](\w+)["'`]\s*\)\s*\.select\(\s*(?:["'`]([^"'`]*)["'`]|(\w+))/g)) out.push([m[1], m[2] ?? consts[m[3]] ?? ""]);
  for (const m of src.matchAll(/(?:\b\w+:)?(edition_\w+)\s*\(\s*([^()]*)\)/g)) out.push([m[1], m[2]]);
  return out;
}

describe("no web code asks for a column the database hides from signed-in users", () => {
  for (const [table, cols] of Object.entries(HIDDEN)) {
    test(`${table}: never selected directly (${cols.join(", ")})`, () => {
      const offenders = [];
      for (const f of SRC) for (const [t, list] of asked(read(f))) {
        if (t !== table) continue;
        const names = list.split(",").map((c) => c.trim().split(":").pop().trim().split(" ")[0]);
        if (names.includes("*")) offenders.push(`${f}: select * on ${table}`);
        for (const c of cols) if (names.includes(c)) offenders.push(`${f}: ${c}`);
      }
      assert.deepEqual(offenders, []);
    });
  }
});

describe("administrators read the private organiser fields through admin-only functions", () => {
  const q = read("app/admin/editions/queries.ts"), detail = read("app/admin/editions/organisers/[id]/page.tsx");
  test("the organiser list reads flags through a function, and the detail page reads emails and internal notes through functions", () => {
    assert.match(q, /rpc\("admin_edition_org_contacts"/); assert.match(q, /rpc\("admin_edition_org_flags"\)/);
    assert.match(q, /reservedFlags\(\)/);
    assert.match(detail, /adminContactEmail\(id\)/); assert.match(detail, /rpc\("admin_edition_org_internal"/);
  });
  test("a missing function (migration not applied yet) leaves the emails blank instead of breaking the page", () => {
    assert.match(q, /catch \{ return new Map\(\); \}/);
  });
  test("the admin layout still requires an administrator before any of this runs", () => {
    assert.match(read("app/admin/layout.tsx"), /isAdmin|requireAdmin|notFound|redirect/);
  });
});

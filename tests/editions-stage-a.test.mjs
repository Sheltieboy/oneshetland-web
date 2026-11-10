// R10 Stage A: consent UI wording, column lists that match the database's column-level grants, and the team-only contact email.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

test("signed-in manage reads never ask for columns the database no longer grants", () => {
  const types = read("lib/editions/types.ts");
  const org = types.match(/ORGANISER_COLUMNS = "([^"]+)"/)[1];
  assert.ok(!/contact_email/.test(org), "the signed-in organiser list must not name contact_email");
  const upd = types.match(/UPDATE_PUBLIC_COLUMNS = "([^"]+)"/)[1];
  assert.ok(!/created_by/.test(upd));
  const data = read("lib/editions/data.server.ts");
  assert.ok(!/from\("edition_updates"\)\.select\("\*"\)/.test(data), "no select(*) on edition_updates (author ids are not readable)");
  assert.ok(!/from\("edition_organisers"\)\.select\("\*"\)/.test(data));
  assert.match(data, /edition_org_contact_email/, "the team reads the contact email through the function");
});

test("an offline offer is shown to the business owner as something to accept, with no payment prompt, and to the organiser as waiting", () => {
  const biz = read("components/editions-commerce/BusinessCommerce.tsx");
  assert.match(biz, /has recorded this membership for you/);
  assert.match(biz, /It only counts once you accept/);
  assert.match(biz, /Accept membership/);
  assert.match(biz, /nothing is recorded against your business/);
  const mgr = read("components/editions-commerce/MembersManager.tsx");
  assert.match(mgr, /Offered, waiting for the business to accept/);
  assert.match(mgr, /confirms this before it counts/);
  assert.match(mgr, /Send for the business to confirm/);
});

/**
 * Fetch: "Email applicant" on the administrator's driver applications screen. Run: node --test tests/fetch-admin-contact.test.mjs
 * A pre-addressed mailto draft for the administrator to write and send themselves. Nothing is sent; the address never leaves the admin screen; Approve stays disabled while paused.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { applicantMailto, firstNameOf, withContactLinks } from "../lib/fetch-admin-contact.ts";

const root = new URL("..", import.meta.url).pathname;
const read = (p) => readFileSync(join(root, p), "utf8");
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\{\/\*[\s\S]*?\*\/\}/g, "").replace(/\/\/.*$/gm, "");

test("the draft is pre-addressed with a subject and a greeting, and nothing else", () => {
  const h = applicantMailto("ryan@example.org", "Ryan Watt");
  assert.match(h, /^mailto:ryan@example\.org\?subject=Your%20OneShetland%20Fetch%20driver%20application&body=Hi%20Ryan%2C%0D%0A%0D%0A$/);
  assert.equal(decodeURIComponent(new URL(h).searchParams.get("body")), "Hi Ryan,\r\n\r\n", "a greeting only: the administrator writes the message");
  assert.match(applicantMailto("a@b.co", null), /body=Hello%2C/, "no name: a plain greeting");
});
test("unsafe or missing addresses give no link (no header injection, no stray parameters)", () => {
  for (const bad of [null, undefined, "", "  ", "no-at-sign", "a@b", "a b@c.co", "x@y.co\r\nBcc: evil@z.co", "a@b.co?cc=evil@z.co", "a@b.co&bcc=evil@z.co", "<a@b.co>", "a@b.co,c@d.co"]) assert.equal(applicantMailto(bad, "Ryan"), null, String(bad));
  assert.equal(applicantMailto("a".repeat(250) + "@b.co", "X"), null, "overlong");
  assert.match(applicantMailto("o'brien+fetch@example.org", "Siobhán Ó Brien"), /^mailto:o'brien\+fetch@example\.org\?/);
  assert.equal(applicantMailto("a%40b@c.co", "X").startsWith("mailto:a%2540b@c.co"), true, "a percent sign in the local part is escaped, not interpreted");
});
test("first names are cleaned: only letters, hyphens and apostrophes, and bounded", () => {
  assert.equal(firstNameOf("Ryan Watt"), "Ryan"); assert.equal(firstNameOf("  Anne-Marie  Smith "), "Anne-Marie"); assert.equal(firstNameOf("Siobhán"), "Siobhán");
  for (const evil of ["<script>alert(1)</script> X", "%0D%0ABcc:evil Z", "Ryan\r\nBcc:x@y.co", "a&b=c?d#e"]) assert.match(firstNameOf(evil), /^[\p{L}'’-]*$/u, `${evil} -> ${firstNameOf(evil)}`);
  assert.ok(firstNameOf("A".repeat(200)).length <= 40);
  assert.equal(firstNameOf(null), ""); assert.equal(firstNameOf("123 456"), "");
});
test("every application row gets its own link from the administrator-only contact list; a row with no contact gets none, and the raw address is not kept on the row", () => {
  const rows = [{ id: "d1", profile: { full_name: "Ryan Watt" } }, { id: "d2", profile: { full_name: "Another Person" } }, { id: "d3", profile: null }];
  const out = withContactLinks(rows, [{ driver_id: "d1", email: "ryan@example.org" }, { driver_id: "d2", email: "other@example.org" }]);
  assert.match(out[0].contactHref, /^mailto:ryan@example\.org/); assert.match(out[1].contactHref, /^mailto:other@example\.org/); assert.equal(out[2].contactHref, null);
  assert.ok(out.every((r) => !("email" in r)), "no email property on the rows");
  assert.deepEqual(withContactLinks(rows, null).map((r) => r.contactHref), [null, null, null], "a failed or refused contact lookup (e.g. a non-administrator) yields no links");
});
test("the loader reads the contact list only through the administrator-only function, on the admin screen only", () => {
  const d = strip(read("lib/admin-data.server.ts"));
  assert.match(d, /sb\.rpc\("admin_driver_applicant_contacts"\)/); assert.match(d, /withContactLinks\(/);
  const users = []; const walk = (dir) => { for (const f of readdirSync(dir)) { if (f === "node_modules" || f === ".next" || f === ".git") continue; const p = join(dir, f); if (statSync(p).isDirectory()) walk(p); else if (/\.(ts|tsx)$/.test(f)) { const t = readFileSync(p, "utf8"); if (t.includes("admin_driver_applicant_contacts") || t.includes("getPendingDrivers")) users.push(p.replace(root, "")); } } };
  walk(join(root, "lib")); walk(join(root, "app")); walk(join(root, "components"));
  assert.deepEqual(users.sort(), ["app/admin/drivers/page.tsx", "lib/admin-data.server.ts", "lib/fetch-admin-contact.ts"], `only the admin screen's loader and page use these: ${users}`);
  assert.ok(!existsAnyRoute(), "no API route under app/api returns applicant contacts");
});
function existsAnyRoute() { const hits = []; const walk = (d) => { for (const f of readdirSync(d)) { const p = join(d, f); if (statSync(p).isDirectory()) walk(p); else if (/route\.(ts|tsx)$/.test(f) && /admin_driver_applicant_contacts|contactHref|applicantMailto/.test(readFileSync(p, "utf8"))) hits.push(p); } }; try { walk(join(root, "app/api")); } catch { /* none */ } return hits.length > 0; }
test("the button is only on the admin screen, opens a draft (a plain link: nothing is sent), and Approve stays disabled while Fetch is paused", () => {
  const c = strip(read("components/admin/DriverApprovals.tsx"));
  assert.match(c, /<a href=\{r\.contactHref\}/); assert.match(c, /Email applicant/); assert.match(c, /nothing is sent/);
  assert.doesNotMatch(c, /fetch\(|functions\.invoke|sendEmail|resend|\.rpc\(|\/api\//i, "the button cannot send anything");
  assert.match(c, /disabled=\{busy === r\.id \|\| approvalsPaused\}/);
  const page = strip(read("app/admin/drivers/page.tsx")); assert.match(page, /approvalsPaused=\{!open\}/);
  assert.match(strip(read("app/admin/layout.tsx")), /requireAdmin\(\)/, "every /admin page is behind the administrator check");
});

import test from "node:test";
import assert from "node:assert/strict";
import {
  organiserProfile, inviteInput, editionFields, editionSlug, pageFields, venueFields, sessionFields, updateFields, sponsorFields,
  londonLocalToIso, isoToLondonLocal, sessionOutsideEdition, imageProblem, mediaPath, shiftYear, isHttpsUrl, isEmail, isUuid,
} from "../lib/editions/validate.ts";

const ED = { starts_on: "2027-05-01", ends_on: "2027-05-03" };
const good = { title: "Spring Weekend", kind: "multi_day", starts_on: "2027-05-01", ends_on: "2027-05-03" };

test("organiser profile enforces https links, hex colours and email", () => {
  const base = { name: "Okay Co" };
  assert.equal(organiserProfile({ ...base, website: "https://example.com", brand_color: "#0b5a73", contact_email: "A@B.co" }).ok, true);
  assert.match(organiserProfile({ ...base, website: "http://example.com" }).error, /https/);
  assert.match(organiserProfile({ ...base, logo_url: "javascript:alert(1)" }).error, /Logo/);
  assert.match(organiserProfile({ ...base, brand_color: "blue" }).error, /colour/);
  assert.match(organiserProfile({ ...base, contact_email: "nope" }).error, /email/);
  assert.equal(organiserProfile({ ...base, contact_email: "A@B.co" }).value.contact_email, "a@b.co");
});


test("invites accept only admin or editor and a real email", () => {
  assert.equal(inviteInput({ email: " Pat@Example.com ", role: "editor" }).value.email, "pat@example.com");
  assert.equal(inviteInput({ email: "pat@example.com", role: "owner" }).ok, false);
  assert.equal(inviteInput({ email: "pat", role: "admin" }).ok, false);
});

test("edition fields apply the date rules for the kind", () => {
  assert.equal(editionFields(good).ok, true);
  assert.match(editionFields({ ...good, kind: "single_day" }).error, /same day/);
  assert.match(editionFields({ ...good, ends_on: "2027-04-01" }).error, /before/);
  assert.match(editionFields({ ...good, title: "A" }).error, /Title/);
  assert.match(editionFields({ ...good, kind: "bogus" }).error, /kind/);
  assert.match(editionFields({ ...good, brand_color: "#fff" }).error, /colour/);
  assert.match(editionFields({ ...good, cover_url: "http://x.test/a.png" }).error, /https/);
  assert.match(editionFields({ ...good, summary: "x".repeat(301) }).error, /Summary/);
  assert.match(editionFields({ ...good, series_id: "not-a-uuid" }).error, /series/);
});

test("edition slug is derived from the title and validated", () => {
  assert.equal(editionSlug("", "Spring Weekend 2027").value, "spring-weekend-2027");
  assert.equal(editionSlug("Custom-Slug", "x").value, "custom-slug");
  assert.equal(editionSlug("a b", "x").ok, false);
});

test("pages: reserved slugs, size limits, markup and defaults", () => {
  assert.equal(pageFields({ title: "Welcome", body: "## Hi" }).value.slug, "welcome");
  for (const s of ["programme", "updates", "partners", "sponsors", "organiser", "preview", "opengraph-image"]) assert.match(pageFields({ title: "X", slug: s }).error, /built-in/, s);
  assert.match(pageFields({ title: "Welcome", body: "x".repeat(20001) }).error, /20,000/);
  assert.match(pageFields({ title: "Welcome", body: "<script>alert(1)</script>" }).error, /script/);
  assert.match(pageFields({ title: "Welcome", body: "ok <IFRAME src=x>" }).error, /iframe/i);
  assert.match(pageFields({ title: "Welcome", nav_label: "x".repeat(31) }).error, /Menu label/);
  assert.match(pageFields({ title: "Welcome", slug: "-bad-" }).error, /address/);
  const v = pageFields({ title: "A long title here", is_home: true, in_nav: false });
  assert.equal(v.value.is_home, true); assert.equal(v.value.nav_label, "A long title here");
});

test("venues: coordinates must come as a valid pair", () => {
  assert.equal(venueFields({ name: "Town Hall" }).ok, true);
  assert.equal(venueFields({ name: "Town Hall", lat: "60.15", lng: "-1.14" }).value.lat, 60.15);
  assert.match(venueFields({ name: "Town Hall", lat: "60" }).error, /both/);
  assert.match(venueFields({ name: "Town Hall", lat: "91", lng: "0" }).error, /Latitude/);
  assert.match(venueFields({ name: "Town Hall", lat: "0", lng: "181" }).error, /Longitude/);
  assert.equal(venueFields({ name: "" }).ok, false);
});

test("London wall-clock times convert correctly across BST and GMT and round-trip", () => {
  assert.equal(londonLocalToIso("2027-07-01T12:00"), "2027-07-01T11:00:00.000Z"); // BST = UTC+1
  assert.equal(londonLocalToIso("2027-01-15T12:00"), "2027-01-15T12:00:00.000Z"); // GMT
  assert.equal(londonLocalToIso("2027-03-28T00:30"), "2027-03-28T00:30:00.000Z"); // before the change
  assert.equal(londonLocalToIso("2027-03-28T03:00"), "2027-03-28T02:00:00.000Z"); // after the change
  assert.equal(londonLocalToIso("garbage"), null);
  assert.equal(londonLocalToIso("2027-02-31T10:00"), null);
  for (const l of ["2027-07-01T12:00", "2027-01-15T09:45", "2027-10-31T23:30"]) assert.equal(isoToLondonLocal(londonLocalToIso(l)), l);
  assert.equal(isoToLondonLocal(null), "");
});

test("session window mirrors the database: edition dates plus or minus one day", () => {
  const at = (l) => londonLocalToIso(l);
  assert.equal(sessionOutsideEdition(at("2027-05-01T10:00"), ED.starts_on, ED.ends_on), false);
  assert.equal(sessionOutsideEdition(at("2027-04-30T23:00"), ED.starts_on, ED.ends_on), false);
  assert.equal(sessionOutsideEdition(at("2027-05-04T01:00"), ED.starts_on, ED.ends_on), false);
  assert.equal(sessionOutsideEdition(at("2027-04-29T12:00"), ED.starts_on, ED.ends_on), true);
  assert.equal(sessionOutsideEdition(at("2027-05-05T12:00"), ED.starts_on, ED.ends_on), true);
});

test("sessions: required fields, ordering, ticket rules", () => {
  const s = { title: "Opening", starts_local: "2027-05-01T10:00", kind: "event" };
  assert.equal(sessionFields(s, ED).ok, true);
  assert.match(sessionFields({ ...s, title: "" }, ED).error, /Title/);
  assert.match(sessionFields({ ...s, starts_local: "" }, ED).error, /start/);
  assert.match(sessionFields({ ...s, ends_local: "2027-05-01T09:00" }, ED).error, /after the start/);
  assert.match(sessionFields({ ...s, starts_local: "2027-06-01T10:00" }, ED).error, /outside/);
  assert.match(sessionFields({ ...s, kind: "party" }, ED).error, /type/);
  assert.match(sessionFields({ ...s, ticket_mode: "external" }, ED).error, /ticket link/);
  assert.match(sessionFields({ ...s, ticket_mode: "external", ticket_url: "http://tickets.test" }, ED).error, /https/);
  const ok = sessionFields({ ...s, ticket_mode: "external", ticket_url: "https://tickets.test/x" }, ED);
  assert.equal(ok.ok, true); assert.equal(ok.value.ticket_url, "https://tickets.test/x");
  // ticket_url is dropped when tickets are "none" so the CHECK (mode='external') = (url is not null) holds
  assert.equal(sessionFields({ ...s, ticket_mode: "none", ticket_url: "https://leftover.test" }, ED).value.ticket_url, null);
  assert.match(sessionFields({ ...s, venue_id: "nope" }, ED).error, /venue/);
});

test("updates: drafts have no published_at, publishing keeps the first date", () => {
  const now = new Date("2027-01-01T00:00:00Z");
  assert.equal(updateFields({ title: "News", body: "Hi", publish: false }, null, now).value.published_at, null);
  assert.equal(updateFields({ title: "News", body: "Hi", publish: true }, null, now).value.published_at, now.toISOString());
  assert.equal(updateFields({ title: "News", body: "Hi", publish: true }, "2026-12-01T00:00:00Z", now).value.published_at, "2026-12-01T00:00:00Z");
  assert.equal(updateFields({ title: "News", body: "Hi", pinned: true }, null).value.pinned, true);
  assert.match(updateFields({ title: "News", body: "<script>" }, null).error, /script/);
  assert.match(updateFields({ title: "", body: "" }, null).error, /Title/);
});

test("sponsors: https links only", () => {
  assert.equal(sponsorFields({ name: "Co-op", url: "https://co.test" }).ok, true);
  assert.match(sponsorFields({ name: "Co-op", url: "ftp://co.test" }).error, /https/);
  assert.match(sponsorFields({ name: "Co-op", logo_url: "//co.test/l.png" }).error, /Logo/);
  assert.equal(sponsorFields({ name: "" }).ok, false);
});

test("images: type, size and storage path (organiser id first)", () => {
  assert.equal(imageProblem({ type: "image/png", size: 1000 }), null);
  assert.ok(imageProblem({ type: "image/gif", size: 1000 }));
  assert.ok(imageProblem({ type: "image/svg+xml", size: 1000 }));
  assert.ok(imageProblem({ type: "image/jpeg", size: 10 * 1024 * 1024 + 1 }));
  assert.ok(imageProblem({ type: "image/jpeg", size: 0 }));
  const org = "11111111-2222-3333-4444-555555555555";
  assert.equal(mediaPath(org, "edition-cover", "abc", "image/webp"), `${org}/edition-cover/abc.webp`);
  assert.ok(mediaPath(org, "../x", "abc", "image/png").startsWith(`${org}/`));
  assert.ok(!mediaPath(org, "../x", "abc", "image/png").includes(".."));
});

test("small helpers", () => {
  assert.equal(shiftYear("2027-02-28"), "2028-02-28");
  assert.equal(shiftYear("2028-02-29"), "2029-02-28");
  assert.ok(isHttpsUrl("https://a.test/x?y=1")); assert.ok(!isHttpsUrl("https://a b")); assert.ok(!isHttpsUrl("http://a.test"));
  assert.ok(isEmail("a@b.co")); assert.ok(!isEmail("a@b"));
  assert.ok(isUuid("11111111-2222-3333-4444-555555555555")); assert.ok(!isUuid("x"));
});

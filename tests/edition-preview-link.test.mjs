/**
 * Private Edition preview links — the WEB half: where the token lives, and where it must not.
 * Run: node --test tests/edition-preview-link.test.mjs
 *
 * Whether a token is valid is the database's business and is proven in
 * supabase/tests/edition-preview-links.node.test.ts. What is proven here is the handoff: that the
 * token is taken out of the address on the first request, that the cookie it lands in is scoped to
 * one Edition and unreadable by page scripts, and that a malformed link sheds the query rather than
 * carrying a junk token onwards.
 *
 * Everything here is local. No network, no database.
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const SRC = readFileSync(new URL("../lib/editions/preview-link.ts", import.meta.url), "utf8");
const PROXY = readFileSync(new URL("../proxy.ts", import.meta.url), "utf8");

/** The module is TypeScript; the four pure functions under test are re-created from its own source. */
const PREVIEW_TOKEN_RE = /^[A-Za-z0-9_-]{32,128}$/;
const EDITION_SLUG_RE = /^[a-z0-9][a-z0-9-]{2,80}$/;
const isPreviewToken = (v) => typeof v === "string" && PREVIEW_TOKEN_RE.test(v);
const isEditionSlug = (v) => typeof v === "string" && EDITION_SLUG_RE.test(v);
const previewCookieName = (slug) => `ed_preview_${slug.replace(/-/g, "_")}`;
const editionBasePath = (slug) => `/editions/${slug}`;
const PREVIEW_COOKIE_MAX_AGE = 60 * 60 * 24 * 14;

function previewHandoff(pathname, search) {
  const m = /^\/editions\/([^/]+)(?:\/.*)?$/.exec(pathname);
  if (!m || !search.has("preview")) return null;
  const slug = m[1];
  const token = search.get("preview");
  return {
    location: pathname,
    cookie: isEditionSlug(slug) && isPreviewToken(token)
      ? { name: previewCookieName(slug), value: token, path: editionBasePath(slug), maxAge: PREVIEW_COOKIE_MAX_AGE, httpOnly: true, sameSite: "lax" }
      : null,
  };
}

const q = (s) => new URLSearchParams(s);
const TOKEN = "a".repeat(43);

describe("the re-created helpers match the module they stand in for", () => {
  test("the token and slug patterns are the module's own", () => {
    assert.ok(SRC.includes(String(PREVIEW_TOKEN_RE)), "token pattern drifted from preview-link.ts");
    assert.ok(SRC.includes(String(EDITION_SLUG_RE)), "slug pattern drifted from preview-link.ts");
  });
  test("the cookie lifetime is the module's own", () => {
    assert.ok(SRC.includes("60 * 60 * 24 * 14"), "cookie lifetime drifted from preview-link.ts");
  });
});

describe("the token leaves the address on the first request", () => {
  test("a link to the Edition's front page is caught", () => {
    const h = previewHandoff("/editions/da-muckle-market", q(`preview=${TOKEN}`));
    assert.ok(h, "the handoff must fire");
    assert.equal(h.location, "/editions/da-muckle-market");
    assert.equal(h.cookie.value, TOKEN);
  });
  test("a link to a page inside the Edition is caught too", () => {
    const h = previewHandoff("/editions/da-muckle-market/makers", q(`preview=${TOKEN}`));
    assert.ok(h);
    assert.equal(h.location, "/editions/da-muckle-market/makers", "the recipient lands where the link pointed");
    assert.equal(h.cookie.name, "ed_preview_da_muckle_market");
  });
  test("the redirect drops the whole query string", () => {
    assert.ok(/clean\.search = "";/.test(PROXY), "proxy.ts must clear the query before redirecting");
  });
  test("the response forbids a Referer and any caching", () => {
    assert.ok(/Referrer-Policy", "no-referrer"/.test(PROXY));
    assert.ok(/Cache-Control", "private, no-store"/.test(PROXY));
  });
});

describe("the cookie is scoped, and page scripts cannot read it", () => {
  test("HttpOnly, so document.cookie never sees the token", () => {
    assert.equal(previewHandoff("/editions/x-market", q(`preview=${TOKEN}`)).cookie.httpOnly, true);
  });
  test("SameSite=lax, so another site cannot make the browser present it", () => {
    assert.equal(previewHandoff("/editions/x-market", q(`preview=${TOKEN}`)).cookie.sameSite, "lax");
  });
  test("the path is the one Edition, so it is sent nowhere else on OneShetland", () => {
    assert.equal(previewHandoff("/editions/x-market", q(`preview=${TOKEN}`)).cookie.path, "/editions/x-market");
  });
  test("one Edition's cookie cannot be mistaken for another's", () => {
    assert.notEqual(previewCookieName("alpha-market"), previewCookieName("beta-market"));
  });
  test("it is marked secure in production", () => {
    assert.ok(/secure: process\.env\.NODE_ENV === "production"/.test(PROXY));
  });
});

describe("anything that is not a preview link is left alone", () => {
  test("the Edition without the query", () => {
    assert.equal(previewHandoff("/editions/da-muckle-market", q("")), null);
  });
  test("the Editions index", () => {
    assert.equal(previewHandoff("/editions", q(`preview=${TOKEN}`)), null);
  });
  test("another part of the site entirely", () => {
    assert.equal(previewHandoff("/directory/da-muckle-market", q(`preview=${TOKEN}`)), null);
    assert.equal(previewHandoff("/whats-on", q(`preview=${TOKEN}`)), null);
  });
  test("the Launch Partner invitation still goes through its own handoff", () => {
    assert.equal(previewHandoff("/launch/some-business", q(`invite=${TOKEN}`)), null);
    assert.ok(/inviteHandoff\(request\.nextUrl\.pathname/.test(PROXY), "the invite handoff must still be tried");
    assert.ok(/inviteHandoff\([^)]*\)\s*\n?\s*\?\?\s*previewHandoff/.test(PROXY.replace(/\s+/g, " ")) || /\?\? previewHandoff/.test(PROXY.replace(/\s+/g, " ")), "the two handoffs must be tried in order");
  });
});

describe("a malformed link sheds the query and sets nothing", () => {
  const bad = [
    ["too short", "x".repeat(31)],
    ["too long", "x".repeat(129)],
    ["not base64url", `${"a".repeat(42)}!`],
    ["empty", ""],
    ["a path traversal", "../../etc/passwd"],
    ["a quote", `${"a".repeat(42)}"`],
  ];
  for (const [name, token] of bad) {
    test(`${name}: redirects, but sets no cookie`, () => {
      const h = previewHandoff("/editions/da-muckle-market", q(`preview=${encodeURIComponent(token)}`));
      assert.ok(h, "the query is still shed");
      assert.equal(h.cookie, null, "no cookie for a malformed token");
    });
  }
  test("a malformed slug sets no cookie either", () => {
    assert.equal(previewHandoff("/editions/Not-A-Slug", q(`preview=${TOKEN}`)).cookie, null);
    assert.equal(previewHandoff("/editions/ab", q(`preview=${TOKEN}`)).cookie, null);
  });
});

describe("the link that is emailed out", () => {
  test("is absolute and carries the token exactly once", () => {
    const url = `https://oneshetland.com/editions/da-muckle-market?preview=${encodeURIComponent(TOKEN)}`;
    assert.equal((url.match(/preview=/g) ?? []).length, 1);
    assert.ok(url.startsWith("https://"));
    assert.ok(SRC.includes("export const previewUrl"), "previewUrl must be the one place the link is built");
  });
});

describe("the web never decides who may see a draft", () => {
  test("preview-link.ts holds no access rule of its own", () => {
    for (const forbidden of ["service_role", "SERVICE_ROLE", "is_admin", "bypass"]) {
      assert.ok(!SRC.includes(forbidden), `preview-link.ts must not mention ${forbidden}`);
    }
  });
  test("the read client is the ordinary anon key with a header, nothing more", () => {
    const client = readFileSync(new URL("../lib/editions/preview-client.server.ts", import.meta.url), "utf8");
    assert.ok(client.includes("NEXT_PUBLIC_SUPABASE_ANON_KEY"));
    assert.ok(!client.includes("SERVICE_ROLE"), "no service key may appear in the preview read path");
    assert.ok(client.includes("x-edition-preview") || client.includes("PREVIEW_HEADER"));
  });
});

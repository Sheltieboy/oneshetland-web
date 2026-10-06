/**
 * Regression: a real site (nginx + a page-cache plugin) sends its page GZIP-compressed even when the client asks for "identity".
 * The fetcher did not decompress, read the compressed bytes as text, and Peerie Bot was handed binary. These tests use the
 * actual failure mode as a fixture and prove every protection is still in force.
 * Run: node --test tests/source-encoding.test.mjs
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import zlib from "node:zlib";
import { randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import { fetchSourceText, fetchRobots, parseEncodings, looksBinary, chooseCharset, decodeText, SourceFetchError, REQUEST_HEADERS, ACCEPT_ENCODING } from "../lib/launch-partners/source-fetch.ts";
import { runEnrichment, isGarbled } from "../lib/launch-partners/enrich-run.ts";
import { fixtureDeps, FIXTURE_HOST } from "../lib/launch-partners/enrich-fixture.ts";

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
const enc = (s) => new TextEncoder().encode(s);
const HTML = `<!DOCTYPE html><html lang="en-GB"><head><meta charset="UTF-8"><title>Home - darren fullerton</title><meta property="og:description" content="SEO, Content & Website Performance for Small Businesses"></head><body><h1>SEO, Content &amp; Website Performance for Small Businesses</h1><p>Practical fixes that improve rankings, speed up your site, and turn visits into enquiries.</p></body></html>`;

/** A fake network: whatever `reply` says. The chunking is deliberately awkward (small slices) so streaming is really exercised. */
const slices = (buf, n = 7) => (async function* () { for (let i = 0; i < buf.length; i += n) yield buf.subarray(i, i + n); })();
const reply = (buf, headers = {}, status = 200) => ({ status, headers: { "content-type": "text/html; charset=UTF-8", ...headers }, body: slices(buf), destroy() {} });
const net = (r, addrs = ["93.184.216.34"]) => ({ resolve: async () => addrs, get: async (u) => (typeof r === "function" ? r(u.toString()) : r) });
const fetchOf = (buf, headers, opts = {}) => fetchSourceText("https://a.example/", { deps: net(reply(buf, headers)), ...opts });

describe("THE ACTUAL FAILURE: a server that compresses whatever the client asked for", () => {
  test("a gzip body (1f8b…) with content-encoding: gzip is DECOMPRESSED and read as the page it is", async () => {
    const gz = zlib.gzipSync(enc(HTML));
    assert.equal(gz[0], 0x1f); assert.equal(gz[1], 0x8b, "the fixture really starts with the gzip signature the live site sent");
    const r = await fetchOf(gz, { "content-encoding": "gzip" });
    assert.equal(r.text, HTML);
    assert.match(r.text, /Website Performance for Small Businesses/); assert.ok(!/[\u0000-\u0008�]/.test(r.text), "no binary noise");
  });
  test("…and WITHOUT the fix the same bytes would have been read as binary: the raw gzip is what looksBinary exists to catch", () => {
    assert.equal(looksBinary(zlib.gzipSync(enc(HTML))), true);
  });
  test("the request now asks for the encodings we can decode (the old 'identity' is gone)", () => {
    assert.equal(ACCEPT_ENCODING, "gzip, deflate, br"); assert.equal(REQUEST_HEADERS["Accept-Encoding"], "gzip, deflate, br");
    const src = read("lib/launch-partners/source-fetch.ts"); assert.doesNotMatch(src, /"Accept-Encoding": "identity"/); assert.match(src, /headers: REQUEST_HEADERS/);
  });
  test("the whole enrichment pipeline works on a compressed site (page → text → evidence), not just the fetcher", async () => {
    const fx = fixtureDeps();
    const deps = { ...fx, fetchPage: async (u) => { const raw = await fx.fetchPage(u); const body = zlib.gzipSync(enc(raw.text)); const r = await fetchSourceText(u, { deps: net(reply(body, { "content-encoding": "gzip" })) }); return { finalUrl: u, text: r.text }; }, claimQuota: async () => {} };
    const out = await runEnrichment({ businessName: "Fixture Studio", startUrl: `https://${FIXTURE_HOST}/`, directory: { description: null, category: "services", locality: "London" } }, deps);
    assert.equal(out.ok, true, JSON.stringify(out)); assert.ok(out.bundle.pages[0].text.length > 200);
  });
});

describe("Unreadable text never reaches the model or spends a quota slot", () => {
  test("text that is mostly 'could not decode' marks is refused as a failed fetch BEFORE the quota claim and the model call", async () => {
    const garbage = "\ufffd".repeat(5000) + " some stray words here";
    assert.equal(isGarbled(garbage), true); assert.equal(isGarbled("Ordinary text with one odd \ufffd mark in it, which is fine."), false); assert.equal(isGarbled(""), false);
    let quota = 0, model = 0; const fx = fixtureDeps();
    const deps = { ...fx, fetchPage: async (u) => ({ finalUrl: u, text: `<html><body>${garbage}</body></html>` }), claimQuota: async () => { quota++; }, propose: async () => { model++; return {}; } };
    const out = await runEnrichment({ businessName: "X", startUrl: `https://${FIXTURE_HOST}/`, directory: { description: null, category: null, locality: null } }, deps);
    assert.equal(out.ok, false); assert.equal(out.code, "fetch_failed"); assert.match(out.message, /unreadable data/); assert.deepEqual([quota, model], [0, 0]);
  });
});

describe("Content encodings", () => {
  test("ordinary HTML (no encoding) is unchanged", async () => { assert.equal((await fetchOf(enc(HTML), {})).text, HTML); });
  test("gzip (and x-gzip), deflate, and Brotli are each decoded", async () => {
    for (const [name, buf] of [["gzip", zlib.gzipSync(enc(HTML))], ["x-gzip", zlib.gzipSync(enc(HTML))], ["deflate", zlib.deflateSync(enc(HTML))], ["br", zlib.brotliCompressSync(enc(HTML))]]) {
      assert.equal((await fetchOf(buf, { "content-encoding": name })).text, HTML, name);
    }
  });
  test("the header is case-insensitive and 'identity' means none; two layers (gzip then br) decode in the right order", async () => {
    assert.equal((await fetchOf(zlib.gzipSync(enc(HTML)), { "content-encoding": "GZip" })).text, HTML);
    assert.equal((await fetchOf(enc(HTML), { "content-encoding": "identity" })).text, HTML);
    const both = zlib.brotliCompressSync(zlib.gzipSync(enc(HTML)));
    assert.equal((await fetchOf(both, { "content-encoding": "gzip, br" })).text, HTML, "applied gzip first, then br → undone br first, then gzip");
  });
  test("an encoding we did not ask for (zstd, compress, nonsense) or too many layers is refused BY NAME, never read as text", async () => {
    for (const bad of ["zstd", "compress", "x-weird", "gzip, gzip, gzip"]) await assert.rejects(fetchOf(enc(HTML), { "content-encoding": bad }), (e) => e instanceof SourceFetchError && e.code === "bad_encoding", bad);
    assert.deepEqual(parseEncodings("gzip, br"), ["gzip", "br"]); assert.deepEqual(parseEncodings(undefined), []); assert.deepEqual(parseEncodings("identity"), []);
  });
  test("corrupt or truncated compressed data is a clear error, not garbage and not a hang", async () => {
    const gz = zlib.gzipSync(enc(HTML));
    await assert.rejects(fetchOf(gz.subarray(0, gz.length - 12), { "content-encoding": "gzip" }), (e) => e.code === "bad_encoding", "truncated");
    const bad = Buffer.from(gz); bad[20] ^= 0xff; bad[21] ^= 0xff;
    await assert.rejects(fetchOf(bad, { "content-encoding": "gzip" }), (e) => e.code === "bad_encoding", "corrupted");
    await assert.rejects(fetchOf(enc("this is not gzip at all, just text"), { "content-encoding": "gzip" }), (e) => e.code === "bad_encoding", "labelled gzip but plain");
    await assert.rejects(fetchOf(enc("not brotli"), { "content-encoding": "br" }), (e) => e.code === "bad_encoding", "labelled br but plain");
  });
});

describe("Charset handling", () => {
  test("the header's charset is used (windows-1252 é is 0xE9, not a replacement character)", async () => {
    const bytes = Uint8Array.from([...enc("<html><body><p>Caf"), 0xe9, ...enc(" au lait</p></body></html>")]);
    assert.match((await fetchOf(bytes, { "content-type": "text/html; charset=windows-1252" })).text, /Café au lait/);
    assert.match((await fetchOf(zlib.gzipSync(bytes), { "content-type": "text/html; charset=iso-8859-1", "content-encoding": "gzip" })).text, /Café au lait/, "decompress first, then decode");
  });
  test("with no header charset, a <meta charset> in the first 2 KB decides; otherwise UTF-8; a BOM is dropped; an unknown label falls back", () => {
    const meta = Uint8Array.from([...enc('<html><head><meta charset="windows-1252"></head><body>Caf'), 0xe9, ...enc("</body></html>")]);
    assert.equal(chooseCharset("text/html", meta), "windows-1252"); assert.match(decodeText(meta, "text/html"), /Café/);
    assert.equal(chooseCharset("text/html", enc("<html>plain</html>")), "utf-8");
    assert.equal(decodeText(Uint8Array.from([0xef, 0xbb, 0xbf, ...enc("<p>Hi ☕</p>")]), "text/html"), "<p>Hi ☕</p>");
    assert.match(decodeText(enc("<p>fine</p>"), "text/html; charset=not-a-charset"), /fine/);
    assert.equal(chooseCharset("text/html; charset=UTF-8", meta), "UTF-8", "the header wins over a meta tag");
  });
});

describe("Binary content is still rejected — whatever it claims to be", () => {
  test("a response labelled text/html that is really binary (PNG, random bytes, NULs) is refused, with or without compression", async () => {
    const png = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, ...Array.from({ length: 200 }, (_, i) => (i * 37) % 256)]);
    const rnd = Uint8Array.from(Array.from({ length: 600 }, (_, i) => (i * 131 + 17) % 256));
    for (const bytes of [png, rnd]) {
      await assert.rejects(fetchOf(bytes, {}), (e) => e.code === "not_html" && /binary/.test(e.message));
      await assert.rejects(fetchOf(zlib.gzipSync(bytes), { "content-encoding": "gzip" }), (e) => e.code === "not_html" && /binary/.test(e.message), "valid gzip of binary");
    }
    assert.equal(looksBinary(enc(HTML)), false); assert.equal(looksBinary(enc("Plain text with\ttabs\nand newlines\r\n")), false); assert.equal(looksBinary(Uint8Array.from([65, 0, 66])), true);
  });
  test("a non-HTML content type (pdf, image, json) is still refused before the body is read", async () => {
    for (const ct of ["application/pdf", "image/png", "application/json", "application/octet-stream"]) await assert.rejects(fetchOf(enc(HTML), { "content-type": ct }), (e) => e.code === "not_html", ct);
  });
});

describe("Size limits still hold — on the wire AND after decompression", () => {
  test("an oversized plain page is refused (while streaming and by Content-Length)", async () => {
    await assert.rejects(fetchOf(enc("x".repeat(600)), {}, { maxBytes: 100 }), (e) => e.code === "too_large");
    await assert.rejects(fetchOf(enc("x"), { "content-length": "999999" }, { maxBytes: 100 }), (e) => e.code === "too_large");
  });
  test("a compressed page that is too big ON THE WIRE is refused", async () => {
    const big = zlib.gzipSync(randomBytes(5000)); // incompressible
    await assert.rejects(fetchOf(big, { "content-encoding": "gzip" }, { maxBytes: 1000 }), (e) => e.code === "too_large");
  });
  test("a DECOMPRESSION BOMB — a few KB that inflates to megabytes — is stopped at the cap, in every encoding, without being held in memory", async () => {
    const zeros = Buffer.alloc(8 * 1024 * 1024, 0x61);   // 8 MB of 'a'
    for (const [name, buf] of [["gzip", zlib.gzipSync(zeros)], ["deflate", zlib.deflateSync(zeros)], ["br", zlib.brotliCompressSync(zeros)]]) {
      assert.ok(buf.length < 100_000, `${name} fixture is tiny on the wire (${buf.length} bytes)`);
      const t0 = Date.now();
      await assert.rejects(fetchOf(buf, { "content-encoding": name }, { maxBytes: 1_500_000 }), (e) => e instanceof SourceFetchError && e.code === "too_large", name);
      assert.ok(Date.now() - t0 < 5000, `${name} stopped promptly`);
    }
  });
  test("the default cap is unchanged (1.5 MB) and applies to the decompressed text too", async () => {
    const { PAGE_MAX_BYTES } = await import("../lib/launch-partners/source-fetch.ts"); assert.equal(PAGE_MAX_BYTES, 1_500_000);
    const justUnder = Buffer.alloc(PAGE_MAX_BYTES - 10, 0x61), justOver = Buffer.alloc(PAGE_MAX_BYTES + 10, 0x61);
    assert.equal((await fetchOf(zlib.gzipSync(justUnder), { "content-encoding": "gzip" })).text.length, PAGE_MAX_BYTES - 10);
    await assert.rejects(fetchOf(zlib.gzipSync(justOver), { "content-encoding": "gzip" }), (e) => e.code === "too_large");
  });
});

describe("Every network protection is exactly as before (encoding changes none of them)", () => {
  test("private, loopback, link-local and metadata addresses are refused before any request — with a compressed reply on offer", async () => {
    const gz = zlib.gzipSync(enc(HTML)); let requested = 0;
    for (const ip of ["10.0.0.1", "127.0.0.1", "169.254.169.254", "192.168.1.1", "::1", "fd00::1", "::ffff:10.0.0.1"]) {
      const d = { resolve: async () => [ip], get: async () => { requested++; return reply(gz, { "content-encoding": "gzip" }); } };
      await assert.rejects(fetchSourceText("https://a.example/", { deps: d }), (e) => e.code === "blocked_address", ip);
    }
    assert.equal(requested, 0, "no connection was ever made");
  });
  test("http, IP literals, credentials, odd ports and internal names are still refused", async () => {
    const d = net(reply(zlib.gzipSync(enc(HTML)), { "content-encoding": "gzip" }));
    for (const u of ["http://a.example/", "https://1.2.3.4/", "https://u:p@a.example/", "https://a.example:8443/", "https://x.internal/", "https://localhost/"]) await assert.rejects(fetchSourceText(u, { deps: d }), SourceFetchError, u);
  });
  test("redirects: same site followed (a compressed body on the redirect is ignored), another site / http / loops / metadata refused", async () => {
    const r = (u) => (u === "https://a.example/" ? reply(zlib.gzipSync(enc("redirecting")), { location: "https://www.a.example/home", "content-encoding": "gzip" }, 301) : reply(zlib.gzipSync(enc(HTML)), { "content-encoding": "gzip" }));
    assert.equal((await fetchSourceText("https://a.example/", { deps: net(r) })).finalUrl, "https://www.a.example/home");
    for (const [loc, code] of [["https://evil.example/", "offsite"], ["http://a.example/x", "bad_url"], ["https://169.254.169.254/", null]]) {
      await assert.rejects(fetchSourceText("https://a.example/", { deps: net(() => reply(enc(""), { location: loc }, 302)) }), (e) => (code ? e.code === code : ["bad_url", "blocked_address"].includes(e.code)), loc);
    }
    await assert.rejects(fetchSourceText("https://a.example/", { deps: net(() => reply(enc(""), { location: "https://a.example/again" }, 302)) }), (e) => e.code === "redirect");
    let n = 0; const d = { resolve: async () => (n++ === 0 ? ["93.184.216.34"] : ["10.0.0.9"]), get: async () => (n === 1 ? reply(enc(""), { location: "https://www.a.example/" }, 301) : reply(zlib.gzipSync(enc(HTML)), { "content-encoding": "gzip" })) };
    await assert.rejects(fetchSourceText("https://a.example/", { deps: d }), (e) => e.code === "blocked_address", "a redirect target that resolves privately is refused on the next hop");
  });
  test("a hung request still times out, and an error status is still an error", async () => {
    const hang = { resolve: async () => ["93.184.216.34"], get: (_u, _a, signal) => new Promise((_r, rej) => signal.addEventListener("abort", () => rej(new Error("aborted")))) };
    await assert.rejects(fetchSourceText("https://a.example/", { timeoutMs: 30, deps: hang }), (e) => e.code === "timeout");
    await assert.rejects(fetchOf(zlib.gzipSync(enc("nope")), { "content-encoding": "gzip" }).then(() => fetchSourceText("https://a.example/", { deps: net(reply(enc("x"), {}, 404)) })), (e) => e.code === "http_status");
  });
  test("robots.txt is still honoured — and a COMPRESSED robots.txt is read, not mistaken for no rules", async () => {
    const robots = zlib.gzipSync(enc("User-agent: *\nDisallow: /private\n"));
    const rules = await fetchRobots("https://a.example", net(reply(robots, { "content-type": "text/plain", "content-encoding": "gzip" })));
    assert.deepEqual(rules.disallow, ["/private"]);
    assert.equal(await fetchRobots("https://a.example", net(reply(enc("nope"), { "content-type": "text/plain" }, 404))), null, "a 404 still means no rules");
    await assert.rejects(fetchRobots("https://a.example", net(reply(enc("oops"), { "content-type": "text/plain" }, 503))), (e) => e.code === "robots", "a server error still means do not read");
  });
  test("no JavaScript, cookies or credentials were introduced; nothing site-specific; decoding is bounded streaming", () => {
    const src = read("lib/launch-partners/source-fetch.ts").replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
    assert.doesNotMatch(src, /Cookie|Authorization|puppeteer|playwright|eval\(|new Function|darrenfullerton|zlib\.(gunzipSync|inflateSync|brotliDecompressSync|unzipSync)\(/, "no whole-body sync decompression (it would hold a bomb in memory)");
    assert.match(src, /createGunzip\(\)/); assert.match(src, /createBrotliDecompress\(\)/); assert.match(src, /createInflate\(\)/);
    assert.match(src, /capped\(stream, maxBytes, tooBig/, "the decompressed side is capped");
  });
});

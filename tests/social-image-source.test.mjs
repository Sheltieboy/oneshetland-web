/**
 * /api/social-image picture trust: URL policy, hardened fetch, bounded decode.
 * Run: node --test tests/social-image-source.test.mjs
 *
 * Everything here is local. A "trusted storage" server stands in for the project's Supabase Storage and an "attacker"
 * server counts every request it receives; for every hostile case the attacker's count must stay at zero.
 * Nothing touches the network beyond 127.0.0.1 / ::1.
 */
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { createRequire } from "node:module";
import { mkdtempSync, symlinkSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import zlib from "node:zlib";
import {
  checkTrustedImageUrl, policyFromSupabaseUrl, fetchImageBytes, decodeToJpegDataUri, loadCover,
  loadSharp, TRUSTED_IMAGE_BUCKETS, SOCIAL_IMAGE_LIMITS,
} from "../lib/social-image-source.ts";

const require = createRequire(import.meta.url);
const sharp = require("sharp");
const LIB_PATH = new URL("../lib/social-image-source.ts", import.meta.url).pathname;

// ── fixtures ────────────────────────────────────────────────────────────────
const solid = (r, g, b, w = 800, h = 600) => sharp({ create: { width: w, height: h, channels: 3, background: { r, g, b } } });
const crcTable = (() => { const t = new Int32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c; } return t; })();
const crc = (b) => { let c = -1; for (const x of b) c = crcTable[(c ^ x) & 0xff] ^ (c >>> 8); return (c ^ -1) >>> 0; };
const chunk = (type, data) => { const len = Buffer.alloc(4); len.writeUInt32BE(data.length); const td = Buffer.concat([Buffer.from(type), data]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([len, td, c]); };
/** A valid PNG of zero bytes: tiny on the wire, w x h when decoded. 8-bit greyscale keeps the big ones quick to build. */
const pngZeros = async (w, h, { gray = false } = {}) => {
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = gray ? 0 : 2;
  const row = Buffer.alloc(1 + w * (gray ? 1 : 3));
  const def = zlib.createDeflate({ level: 9 }); const parts = []; def.on("data", (d) => parts.push(d));
  for (let y = 0; y < h; y++) { if (!def.write(row)) await new Promise((r) => def.once("drain", r)); }
  def.end(); await new Promise((r) => def.on("end", r));
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", ihdr), chunk("IDAT", Buffer.concat(parts)), chunk("IEND", Buffer.alloc(0))]);
};

let F; // fixtures, built once
before(async () => {
  F = {
    jpg: await solid(20, 180, 40).jpeg().toBuffer(),
    png: await solid(20, 40, 220).png().toBuffer(),
    webp: await solid(220, 20, 20).webp().toBuffer(),
    svg: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="600" height="400"><rect width="600" height="400" fill="#d01010"/></svg>'),
    avif: await solid(220, 20, 20, 400, 300).avif({ quality: 40, effort: 0 }).toBuffer(),
    gif: await solid(10, 10, 10, 50, 50).gif().toBuffer(),
    tiff: await solid(10, 10, 10, 50, 50).tiff().toBuffer(),
    html: Buffer.from("<html><body>not an image</body></html>"),
    corrupt: Buffer.concat([(await solid(1, 1, 1).jpeg().toBuffer()).subarray(0, 40), Buffer.from("garbage".repeat(60))]),
    big: await solid(20, 180, 40, 4000, 3000).jpeg({ quality: 70 }).toBuffer(),   // 12 Mpx, legitimate phone-sized photo
    animated: await sharp(await Promise.all([40, 120, 200].map((r) => sharp({ create: { width: 60, height: 40, channels: 3, background: { r, g: 50, b: 50 } } }).png().toBuffer())), { join: { animated: true } }).webp({ loop: 0, delay: [100, 100, 100] }).toBuffer(),
  };
});

// ── two local servers: trusted storage, and an attacker that must never be reached ──
let T, A, A6; let aHits = [];
const listen = (server, port, host) => new Promise((res, rej) => { server.once("error", rej); server.listen(port, host, () => res(server.address().port)); });
const seen = [];
let tHandler = null;

before(async () => {
  T = http.createServer((req, res) => { seen.push({ url: req.url, auth: req.headers.authorization, cookie: req.headers.cookie }); tHandler(req, res); });
  A = http.createServer((req, res) => { aHits.push(req.url); res.writeHead(200, { "content-type": "image/jpeg" }); res.end(F.jpg); });
  A.on("connection", () => {});
  await listen(T, 0, "127.0.0.1");
  await listen(A, 0, "127.0.0.1");
  try { A6 = http.createServer((req, res) => { aHits.push("v6" + req.url); res.writeHead(200, { "content-type": "image/jpeg" }); res.end(F.jpg); }); await listen(A6, A.address().port, "::1"); } catch { A6 = null; }
});
after(() => { T?.closeAllConnections?.(); for (const s of [T, A, A6]) s?.close(); });

const P = "/storage/v1/object/public/";
const tOrigin = () => `http://127.0.0.1:${T.address().port}`;
const aPort = () => A.address().port;
const policy = () => policyFromSupabaseUrl(tOrigin());
const url = (path) => tOrigin() + P + path;
const serve = (fn) => { tHandler = fn; aHits = []; seen.length = 0; };
const ok = (ct, body) => (req, res) => { res.writeHead(200, { "content-type": ct, "content-length": body.length }); res.end(body); };

// ═══════════════════════════ 1. the URL policy ═══════════════════════════
test("policy: built from the project's Supabase URL; unset or unusable means nothing is trusted", () => {
  assert.equal(policyFromSupabaseUrl(undefined), null);
  assert.equal(policyFromSupabaseUrl(""), null);
  assert.equal(policyFromSupabaseUrl("not a url"), null);
  assert.equal(policyFromSupabaseUrl("file:///etc/passwd"), null);
  assert.equal(policyFromSupabaseUrl("https://abcd.supabase.co/").trustedOrigin, "https://abcd.supabase.co");
  assert.deepEqual(checkTrustedImageUrl("https://abcd.supabase.co" + P + "event-media/x.jpg", null), { reason: "no-policy" });
});

const HTTPS = policyFromSupabaseUrl("https://abcd.supabase.co");
const bad = (raw, reason, pol = HTTPS) => assert.deepEqual(checkTrustedImageUrl(raw, pol), { reason }, `should refuse: ${String(raw).slice(0, 90)}`);

test("policy: accepts only this project's public image objects, rebuilt without query or fragment", () => {
  for (const b of TRUSTED_IMAGE_BUCKETS) {
    const r = checkTrustedImageUrl(`https://abcd.supabase.co${P}${b}/user-1/events/cover 1.jpg`.replace(" ", "%20"), HTTPS);
    assert.ok("url" in r, b);
  }
  const r = checkTrustedImageUrl(`HTTPS://ABCD.SUPABASE.CO:443${P}event-media/u/c.webp?t=123&download=1#frag`, HTTPS);
  assert.equal(r.url.href, `https://abcd.supabase.co${P}event-media/u/c.webp`, "query/fragment dropped, case and default port normalised");
});

test("policy: localhost, IPv4/IPv6 loopback, RFC1918, link-local, metadata and mapped addresses are refused (never the trusted origin)", () => {
  const hosts = [
    "localhost", "127.0.0.1", "127.1", "2130706433", "0x7f000001", "017700000001", "0.0.0.0",
    "[::1]", "[::]", "[::ffff:127.0.0.1]", "[::ffff:7f00:1]",
    "10.0.0.5", "172.16.0.9", "172.31.255.255", "192.168.1.1", "100.64.0.1",
    "169.254.169.254", "169.254.170.2", "[fe80::1]", "[fd00::1]", "[fc00::1]", "metadata.google.internal",
  ];
  for (const h of hosts) bad(`https://${h}${P}event-media/x.jpg`, "untrusted-origin");
  for (const h of hosts) bad(`http://${h}:8080${P}event-media/x.jpg`, "untrusted-origin");
});

test("policy: scheme, port, credentials and look-alike hosts must match the trusted origin exactly", () => {
  bad("http://abcd.supabase.co" + P + "event-media/x.jpg", "untrusted-origin");                    // http when https is trusted
  bad("https://abcd.supabase.co:8443" + P + "event-media/x.jpg", "untrusted-origin");              // unusual port
  bad("https://abcd.supabase.co:22" + P + "event-media/x.jpg", "untrusted-origin");
  bad("https://user:pw@abcd.supabase.co" + P + "event-media/x.jpg", "untrusted-origin");           // userinfo on the right host
  bad("https://abcd.supabase.co@evil.example" + P + "event-media/x.jpg", "untrusted-origin");      // right host in the userinfo slot
  bad("https://abcd.supabase.co.evil.example" + P + "event-media/x.jpg", "untrusted-origin");
  bad("https://evilabcd.supabase.co" + P + "event-media/x.jpg", "untrusted-origin");
  bad("https://other.supabase.co" + P + "event-media/x.jpg", "untrusted-origin");                  // another Supabase project
  bad("https://abcd.supabase.co." + P.slice(0) + "event-media/x.jpg", "untrusted-origin");         // trailing-dot host
  for (const s of ["ftp://abcd.supabase.co/x.jpg", "file:///etc/hosts", "data:image/jpeg;base64,AAAA", "javascript:alert(1)", "blob:https://abcd.supabase.co/x", "gopher://abcd.supabase.co/"])
    bad(s, "untrusted-origin");
});

test("policy: only /storage/v1/object/public/<image bucket>/<object>; nothing else on the trusted host is reachable", () => {
  const h = "https://abcd.supabase.co";
  for (const p of ["/rest/v1/events", "/functions/v1/some-cron", "/auth/v1/user", "/storage/v1/object/sign/event-media/x.jpg", "/storage/v1/object/authenticated/event-media/x.jpg",
    "/storage/v1/render/image/public/event-media/x.jpg", "/storage/v1/bucket", "/", ""]) bad(h + p, "untrusted-path");
  bad(h + P, "untrusted-path");                                  // no bucket
  bad(h + P + "event-media", "untrusted-path");                  // no object
  bad(h + P + "event-media/", "untrusted-path");
  for (const b of ["memories-media", "avatars", "boat-comment-media", "spik-audio", "employer-logos", "EVENT-MEDIA", "event-media2"]) bad(`${h}${P}${b}/x.jpg`, "untrusted-path");
});

test("policy: traversal, encoded separators, control characters and oversize input are refused", () => {
  const h = "https://abcd.supabase.co";
  bad(h + P + "../../../functions/v1/some-cron", "untrusted-path");                  // resolved by the parser, lands outside the prefix
  bad(h + P + "event-media/../../../../functions/v1/x", "untrusted-path");
  bad(h + P + "event-media/%2e%2e/%2e%2e/functions/v1/x", "untrusted-path");
  bad(h + P + "event-media/u%2f..%2fx.jpg", "untrusted-path");
  bad(h + P + "event-media/u%5cx.jpg", "untrusted-path");
  bad(h + P + "event-media/x.jpg%00.png", "untrusted-path");
  bad(h + P + "event-media\\x.jpg", "bad-url");
  bad(h + P + "event-media/x.jpg\n", "bad-url");
  bad(" " + h + P + "event-media/x.jpg", "bad-url");
  bad(h + P + "event-media/" + "a".repeat(2100), "bad-url");
  for (const v of [null, undefined, 42, {}, [], true, ""]) bad(v, "bad-url");
});

// ═══════════════════════════ 2. no internal fetch, ever ═══════════════════════════
test("SSRF: a cover pointing at an attacker/internal server is never requested (localhost, 127.x, ::1, short and decimal forms)", async () => {
  serve(ok("image/jpeg", F.jpg));
  const port = aPort();
  const targets = [`http://127.0.0.1:${port}/x.jpg`, `http://localhost:${port}/x.jpg`, `http://127.1:${port}/x.jpg`, `http://2130706433:${port}/x.jpg`,
    `http://[::1]:${port}/x.jpg`, `http://user:pw@127.0.0.1:${port}/x.jpg`, `http://0.0.0.0:${port}/x.jpg`, `http://[::ffff:127.0.0.1]:${port}/x.jpg`];
  for (const t of targets) assert.deepEqual(await loadCover(t, policy()), { reason: "untrusted-origin" }, t);
  assert.equal(aHits.length, 0, `attacker server must never be contacted, saw ${JSON.stringify(aHits)}`);
  assert.equal(seen.length, 0, "and nothing was requested from storage either");
});

test("SSRF: the trusted host's own non-storage paths are never requested", async () => {
  serve(ok("image/jpeg", F.jpg));
  for (const p of ["/functions/v1/some-cron", "/rest/v1/events", "/storage/v1/object/public/../../../functions/v1/x", "/storage/v1/object/public/memories-media/x.jpg"])
    assert.ok("reason" in (await loadCover(tOrigin() + p, policy())), p);
  assert.equal(seen.length, 0);
});

test("SSRF: a redirect from trusted storage to an internal address is not followed (and no redirect is, at all)", async () => {
  serve((req, res) => { res.writeHead(302, { location: `http://127.0.0.1:${aPort()}/internal.jpg` }); res.end(); });
  assert.deepEqual(await loadCover(url("event-media/u/redir.jpg"), policy()), { reason: "redirect" });
  for (const code of [301, 303, 307, 308]) {
    serve((req, res) => { res.writeHead(code, { location: `http://[::1]:${aPort()}/internal.jpg` }); res.end(); });
    assert.deepEqual(await loadCover(url("event-media/u/redir.jpg"), policy()), { reason: "redirect" }, String(code));
  }
  assert.equal(aHits.length, 0, "the redirect target must never be contacted");
});

test("redirect loop fails safely after exactly one request", async () => {
  let n = 0;
  serve((req, res) => { n++; res.writeHead(302, { location: req.url }); res.end(); });
  assert.deepEqual(await loadCover(url("event-media/u/loop.jpg"), policy()), { reason: "redirect" });
  assert.equal(n, 1);
});

test("fetch sends no credentials and no cookies, and requests exactly the validated path (query and fragment dropped)", async () => {
  serve(ok("image/jpeg", F.jpg));
  const r = await loadCover(url("event-media/u/c.jpg") + "?token=secret&x=1#frag", policy());
  assert.ok("dataUri" in r);
  assert.equal(seen.length, 1);
  assert.equal(seen[0].url, P + "event-media/u/c.jpg");
  assert.equal(seen[0].auth, undefined);
  assert.equal(seen[0].cookie, undefined);
});

// ═══════════════════════════ 3. what a response must look like ═══════════════════════════
test("legitimate trusted images render: JPEG, PNG and WebP, from every image bucket, as a 1080x1080 JPEG", async () => {
  for (const [name, ct, body] of [["a.jpg", "image/jpeg", F.jpg], ["a.png", "image/png", F.png], ["a.webp", "image/webp", F.webp], ["a.jpg", "image/jpg", F.jpg], ["a.jpg", "IMAGE/JPEG; charset=binary", F.jpg]]) {
    for (const bucket of ["event-media", "business-media", "hub-media"]) {
      serve(ok(ct, body));
      const r = await loadCover(url(`${bucket}/u/${name}`), policy());
      assert.ok("dataUri" in r, `${bucket}/${name} ${ct}: ${JSON.stringify(r)}`);
      assert.ok(r.dataUri.startsWith("data:image/jpeg;base64,"));
      const m = await sharp(Buffer.from(r.dataUri.split(",")[1], "base64")).metadata();
      assert.equal(m.format, "jpeg"); assert.equal(m.width, 1080); assert.equal(m.height, 1080);
    }
  }
});

test("a large legitimate photo (12 Mpx) still renders", async () => {
  serve(ok("image/jpeg", F.big));
  const r = await loadCover(url("event-media/u/big.jpg"), policy());
  assert.ok("dataUri" in r, JSON.stringify(r));
});

test("wrong content-type and HTML are refused; HTML or junk labelled as an image is refused by decode", async () => {
  for (const ct of ["text/html", "text/plain", "application/json", "image/svg+xml", "image/gif", "image/avif", "image/tiff", "application/octet-stream", ""]) {
    serve((req, res) => { res.writeHead(200, ct ? { "content-type": ct } : {}); res.end(F.jpg); });
    assert.deepEqual(await loadCover(url("event-media/u/x.jpg"), policy()), { reason: "content-type" }, `content-type ${JSON.stringify(ct)}`);
  }
  serve(ok("image/jpeg", F.html));
  assert.deepEqual(await loadCover(url("event-media/u/x.jpg"), policy()), { reason: "decode-failed" });
});

test("a corrupt image is handled safely", async () => {
  serve(ok("image/jpeg", F.corrupt));
  const r = await loadCover(url("event-media/u/corrupt.jpg"), policy());
  assert.deepEqual(r, { reason: "decode-failed" });
});

test("non-200 responses are refused", async () => {
  for (const code of [204, 206, 400, 401, 403, 404, 429, 500, 503]) {
    serve((req, res) => { res.writeHead(code, { "content-type": "image/jpeg" }); res.end(F.jpg); });
    assert.deepEqual(await loadCover(url("event-media/u/x.jpg"), policy()), { reason: "status" }, String(code));
  }
});

// ═══════════════════════════ 4. size, time and pixel limits ═══════════════════════════
test("oversize body is refused: by Content-Length without reading it, and by streaming cap when the length is absent or a lie", async () => {
  serve((req, res) => { res.writeHead(200, { "content-type": "image/jpeg", "content-length": String(SOCIAL_IMAGE_LIMITS.maxBytes + 1) }); res.end(Buffer.alloc(64)); res.destroy(); });
  assert.deepEqual(await loadCover(url("event-media/u/x.jpg"), policy()), { reason: "too-large" }, "declared length over the default cap");

  let sent = 0;
  serve((req, res) => { // chunked, never declares a length
    res.writeHead(200, { "content-type": "image/jpeg" });
    const chunk = Buffer.alloc(16 * 1024);
    const pump = () => { while (sent < 400 * 1024) { sent += chunk.length; if (!res.write(chunk)) return res.once("drain", pump); } res.end(); };
    res.on("close", () => (sent = Infinity)); pump();
  });
  assert.deepEqual(await loadCover(url("event-media/u/x.jpg"), policy(), { maxBytes: 100_000 }), { reason: "too-large" }, "streamed past a 100 kB cap");
  assert.ok(sent < 400 * 1024 + 1 || sent === Infinity, "the reader stopped pulling");
});

test("a slow response times out (stalled body, and no headers at all) and releases the connection", async () => {
  serve((req, res) => { res.writeHead(200, { "content-type": "image/jpeg" }); res.write(Buffer.from([0xff])); /* then nothing */ });
  let t0 = Date.now();
  assert.deepEqual(await loadCover(url("event-media/u/slow.jpg"), policy(), { timeoutMs: 300 }), { reason: "timeout" });
  assert.ok(Date.now() - t0 < 2500, `took ${Date.now() - t0}ms`);

  serve(() => { /* accept the connection, never answer */ });
  t0 = Date.now();
  assert.deepEqual(await loadCover(url("event-media/u/silent.jpg"), policy(), { timeoutMs: 300 }), { reason: "timeout" });
  assert.ok(Date.now() - t0 < 2500, `took ${Date.now() - t0}ms`);
});

test("a fetch implementation that ignores the abort signal still cannot hold the render past the deadline", async () => {
  const never = () => new Promise(() => {});
  const t0 = Date.now();
  const r = await fetchImageBytes(new URL(url("event-media/u/x.jpg")), { fetchImpl: never, timeoutMs: 200 });
  assert.deepEqual(r, { reason: "timeout" });
  assert.ok(Date.now() - t0 < 1500);
});

test("pixel limits: over-cap images are refused from the header, before any decode (400 Mpx, 64 Mpx, just over 48 Mpx, one over-long side)", async () => {
  for (const [w, h, gray, why] of [
    [20000, 20000, true, "400 Mpx, over sharp's own 268 Mpx default"],
    [8000, 8000, false, "64 Mpx, over our cap but under sharp's default"],
    [7000, 7000, true, "49 Mpx, just over the cap"],
    [17000, 10, false, "one side over the 16384 maximum"],
  ]) {
    serve(ok("image/png", await pngZeros(w, h, { gray })));
    const r = await loadCover(url("event-media/u/bomb.png"), policy());
    assert.deepEqual(r, { reason: "pixels" }, `${w}x${h} (${why}): ${JSON.stringify(r)}`);
  }
});

test("pixel limits: an image just under the cap still renders (no false positive for a large phone photo)", async () => {
  serve(ok("image/png", await pngZeros(6900, 6900, { gray: true })));      // 47.6 Mpx
  const r = await loadCover(url("event-media/u/large.png"), policy());
  assert.ok("dataUri" in r, JSON.stringify(r));
});

test("a bomb is small on the wire: the fixtures prove the cap is what protects us, not the byte limit", async () => {
  const b = await pngZeros(8000, 8000);
  assert.ok(b.length < 400_000, `${b.length} bytes for 64 Mpx`);
});

// ═══════════════════════════ 5. decoders: only JPEG/PNG/WebP ═══════════════════════════
test("SVG, AVIF/HEIF, GIF, TIFF and animated images are refused whatever Content-Type they claim", async () => {
  for (const [what, body] of [["svg", F.svg], ["avif", F.avif], ["gif", F.gif], ["tiff", F.tiff], ["animated webp", F.animated]]) {
    serve(ok("image/png", body));                                    // an attacker can declare anything at upload
    const r = await loadCover(url(`event-media/u/${what.replace(/\W+/g, "-")}.png`), policy());
    assert.ok(["format", "decode-failed"].includes(r.reason), `${what}: ${JSON.stringify(r)}`);
  }
});

test("libvips has the HEIF/AVIF loader switched off (second line of defence), while JPEG/PNG/WebP still load", async () => {
  const s = await loadSharp();
  await assert.rejects(() => s(F.avif).metadata(), "HEIF/AVIF loader is blocked");
  for (const b of [F.jpg, F.png, F.webp]) assert.ok((await s(b).metadata()).format);
});

test("loading our sharp must not break Next's ImageResponse, which rasterises its generated SVG through sharp", async () => {
  // Found by running the real route: blocking the SVG loader process-wide made every card fail with
  // "Input buffer contains unsupported image format" once the first cover had been processed.
  const s = await loadSharp();
  const out = await s(F.svg).png().toBuffer();
  assert.ok(out.length > 50, "SVG -> PNG rasterisation still works in this process");
  // ...and that is safe because attacker SVG never gets that far: the format gate refuses it first.
  assert.equal((await decodeToJpegDataUri(F.svg, { getSharp: loadSharp })).reason, "format");
});

// ═══════════════════════════ 6. advisory regression ═══════════════════════════
const ver = (v) => v.split(".").slice(0, 3).map((n) => parseInt(n, 10));
const atLeast = (have, want) => { const a = ver(have), b = ver(want); for (let i = 0; i < 3; i++) { if (a[i] !== b[i]) return a[i] > b[i]; } return true; };
const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
const lock = JSON.parse(readFileSync(new URL("../package-lock.json", import.meta.url), "utf8"));

test("advisory regression: patched Next.js (>=16.3.6 next/og RCE, >=16.3.3 AVIF optimizer) and patched sharp/libvips natives are installed", () => {
  const next = require("next/package.json").version;
  assert.ok(atLeast(next, "16.3.6"), `next ${next} is below 16.3.6 (GHSA-vcvr-r3jv-pc5j, next/og ImageResponse RCE)`);
  assert.ok(atLeast(sharp.versions.sharp, "0.35.5"), `sharp ${sharp.versions.sharp} is below 0.35.5 (GHSA-wq5f-xc86-pv6w librsvg; GHSA-rgj7-g3m4-5g8c libheif <0.35.4)`);
  assert.ok(atLeast(sharp.versions.heif, "1.23.2"), `libheif ${sharp.versions.heif} is below 1.23.2`);
  assert.ok(atLeast(sharp.versions.rsvg, "2.63.2"), `librsvg ${sharp.versions.rsvg} is below 2.63.2`);
});

test("advisory regression: package.json pins next and declares sharp directly, and the lockfile resolves the same versions", () => {
  assert.ok(atLeast(pkg.dependencies.next.replace(/^[^\d]*/, ""), "16.3.6"), `package.json next = ${pkg.dependencies.next}`);
  assert.ok(pkg.dependencies.sharp, "sharp is imported by lib/social-image-source.ts, so it must be a declared dependency");
  assert.ok(atLeast(pkg.dependencies.sharp.replace(/^[^\d]*/, ""), "0.35.5"), `package.json sharp = ${pkg.dependencies.sharp}`);
  assert.ok(atLeast(lock.packages["node_modules/next"].version, "16.3.6"));
  assert.ok(atLeast(lock.packages["node_modules/sharp"].version, "0.35.5"));
  assert.ok(lock.packages["node_modules/@img/sharp-linux-x64"], "the Netlify (linux-x64) sharp binary is in the lockfile");
  assert.ok(lock.packages["node_modules/@next/swc-linux-x64-gnu"], "the linux-x64 SWC binary is in the lockfile");
});

// ═══════════════════════════ 7. mutation: each guard is load-bearing ═══════════════════════════
// Mutants live in a temp dir (Node will not strip types under node_modules) with a node_modules symlink so `sharp` still resolves.
const mutantDir = mkdtempSync(join(tmpdir(), "social-image-mutants-"));
symlinkSync(new URL("../node_modules", import.meta.url).pathname, join(mutantDir, "node_modules"), "dir");
after(() => rmSync(mutantDir, { recursive: true, force: true }));
const source = readFileSync(LIB_PATH, "utf8");
const mutate = async (name, ...pairs) => {
  let src = source;
  for (let i = 0; i < pairs.length; i += 2) {
    assert.ok(src.includes(pairs[i]), `mutation target for "${name}" no longer exists in the source: ${pairs[i]}`);
    src = src.replaceAll(pairs[i], pairs[i + 1]);
  }
  const file = join(mutantDir, `${name}.ts`);
  writeFileSync(file, src);
  return import(`file://${file}`);
};

test("mutation: dropping the origin check lets the attacker server be fetched (the SSRF tests are load-bearing)", async () => {
  const m = await mutate("no-origin", 'if (u.origin !== policy.trustedOrigin) return { reason: "untrusted-origin" };', "");
  serve(ok("image/jpeg", F.jpg));
  const pol = m.policyFromSupabaseUrl(tOrigin());
  const r = await m.loadCover(`http://127.0.0.1:${aPort()}${P}event-media/x.jpg`, pol);
  assert.ok("dataUri" in r && aHits.length === 1, "without the origin check the attacker server is fetched and its image used");
});

test("mutation: dropping the path gate lets a trusted-host function endpoint through", async () => {
  const m = await mutate("no-path",
    'if (!u.pathname.startsWith(STORAGE_PREFIX)) return { reason: "untrusted-path" };', "",
    'if (!bucket || !object || !policy.buckets.includes(bucket)) return { reason: "untrusted-path" };', "");
  const r = m.checkTrustedImageUrl(tOrigin() + "/functions/v1/some-cron", m.policyFromSupabaseUrl(tOrigin()));
  assert.equal(r.url?.pathname, "/functions/v1/some-cron", "with the path gate gone a non-storage path would be fetched");
  assert.ok("reason" in checkTrustedImageUrl(tOrigin() + "/functions/v1/some-cron", policy()), "and with it, refused");
});

test("mutation: dropping the scheme check lets blob: ride on the trusted origin", async () => {
  const m = await mutate("no-scheme", 'if (u.protocol !== "https:" && u.protocol !== "http:") return { reason: "untrusted-origin" };', "");
  const blob = "blob:" + tOrigin() + "/x";
  assert.equal(checkTrustedImageUrl(blob, policy()).reason, "untrusted-origin");
  assert.notEqual(m.checkTrustedImageUrl(blob, m.policyFromSupabaseUrl(tOrigin())).reason, "untrusted-origin", "without the scheme check the origin comparison alone accepts it");
});

test("mutation: following redirects lets a trusted-host redirect reach the internal server", async () => {
  const m = await mutate("follow", 'redirect: "manual",', 'redirect: "follow",');
  serve((req, res) => { res.writeHead(302, { location: `http://127.0.0.1:${aPort()}/internal.jpg` }); res.end(); });
  const r = await m.loadCover(url("event-media/u/redir.jpg"), m.policyFromSupabaseUrl(tOrigin()));
  assert.ok(aHits.length === 1 && "dataUri" in r, "redirect followed to the attacker server");
});

test("mutation: removing the byte caps lets an oversize body through", async () => {
  const m = await mutate("no-cap", "if (total > maxBytes)", "if (false)", "if (Number.isFinite(declared) && declared > maxBytes)", "if (false)");
  serve(ok("image/jpeg", F.big));
  const r = await m.fetchImageBytes(new URL(url("event-media/u/big.jpg")), { maxBytes: 1000 });
  assert.ok("bytes" in r && r.bytes.length > 1000, "caps removed: a body over the cap is returned");
  assert.deepEqual(await fetchImageBytes(new URL(url("event-media/u/big.jpg")), { maxBytes: 1000 }), { reason: "too-large" });
});

test("mutation: removing both pixel guards lets the over-cap image decode", async () => {
  const m = await mutate("no-pixels",
    "if (!w || !h || w > maxSide || h > maxSide || w * h > maxPixels) return", "if (false) return",
    "limitInputPixels: maxPixels", "limitInputPixels: false");
  const big = await pngZeros(7000, 7000, { gray: true });                       // 49 Mpx, over the 48 Mpx cap
  const r = await m.decodeToJpegDataUri(big, { getSharp: async () => sharp });
  assert.ok("dataUri" in r, "with both guards removed the over-cap image decodes");
  assert.deepEqual(await decodeToJpegDataUri(big, { getSharp: async () => sharp }), { reason: "pixels" }, "with them it is refused");
});

test("mutation: removing the format gate lets SVG decode, and AVIF too once libvips' own block is lifted", async () => {
  const m = await mutate("no-format", "if (!meta.format || !ALLOWED_FORMATS.has(meta.format)) return", "if (false) return");
  const s = await loadSharp();
  const svg = await m.decodeToJpegDataUri(F.svg, { getSharp: async () => s });
  assert.ok("dataUri" in svg, "without the gate an SVG is decoded: it is the gate, not libvips, that keeps SVG out");
  assert.equal((await decodeToJpegDataUri(F.svg, { getSharp: async () => s })).reason, "format", "with the gate it is refused");
  s.unblock({ operation: ["VipsForeignLoadHeif"] });
  try {
    const avif = await m.decodeToJpegDataUri(F.avif, { getSharp: async () => s });
    assert.ok("dataUri" in avif, "without the gate and the block an AVIF is decoded");
    assert.equal((await decodeToJpegDataUri(F.avif, { getSharp: async () => s })).reason, "format");
  } finally {
    s.block({ operation: ["VipsForeignLoadHeif"] });
  }
});

test("mutation: removing the deadline lets a stalled response hold the render", async () => {
  const m = await mutate("no-deadline", "}, timeoutMs); });", "}, 1e9); });");
  serve((req, res) => { res.writeHead(200, { "content-type": "image/jpeg" }); res.write(Buffer.from([0xff])); });
  const outcome = await Promise.race([
    m.loadCover(url("event-media/u/slow.jpg"), m.policyFromSupabaseUrl(tOrigin()), { timeoutMs: 200 }).then(() => "finished"),
    new Promise((r) => setTimeout(() => r("still waiting"), 1200)),
  ]);
  assert.equal(outcome, "still waiting");
  T.closeAllConnections?.();
});

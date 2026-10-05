/**
 * Product import — safe image fetching. Every network edge is injected, so each SSRF rule is proved without a
 * network. Run: node --test tests/product-import-images.test.mjs
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { isBlockedAddress, checkFetchUrl, sniffImage, fetchImage, ImageFetchError } from "../lib/product-import/image-fetch.ts";

const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 16, 0x4a, 0x46, 0x49, 0x46, 0, 1, 1, 0, 0, 1, 0, 1, 0, 0]);
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 73, 72, 68, 82]);
const WEBP = new Uint8Array([0x52, 0x49, 0x46, 0x46, 4, 0, 0, 0, 0x57, 0x45, 0x42, 0x50, 0x56, 0x50, 0x38, 0x20]);
const SVG = new TextEncoder().encode('<?xml version="1.0"?><svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>');
const HTML = new TextEncoder().encode("<!doctype html><html><body>login</body></html>");
const code = async (p) => { try { await p; return "none"; } catch (e) { return e instanceof ImageFetchError ? e.code : `other:${e.message}`; } };

async function* chunks(...parts) { for (const p of parts) yield p; }
const reply = (status, headers, body, extra = {}) => ({ status, headers, body: body ?? chunks(), destroy: () => { extra.destroyed = true; } });
/** A fake network: `routes` maps host → addresses, `pages` maps url → reply. Records which address each request was pinned to. */
function fake(routes, pages, log = []) {
  return {
    resolve: async (host) => { if (!(host in routes)) throw new Error("ENOTFOUND"); return routes[host]; },
    get: async (url, address) => { log.push([url.toString(), address]); const p = pages[url.toString()]; if (!p) throw new Error("no page"); return typeof p === "function" ? p() : p; },
  };
}

describe("address policy", () => {
  test("every private, loopback, link-local, metadata, CGNAT, multicast and reserved IPv4 is blocked", () => {
    for (const ip of ["127.0.0.1", "127.255.255.254", "10.0.0.1", "10.255.255.255", "172.16.0.1", "172.31.255.255", "192.168.1.1", "169.254.169.254", "169.254.0.1",
      "100.64.0.1", "100.127.255.255", "0.0.0.0", "0.1.2.3", "224.0.0.1", "239.255.255.255", "240.0.0.1", "255.255.255.255", "198.18.0.1", "192.0.2.1", "198.51.100.5", "203.0.113.9"]) {
      assert.equal(isBlockedAddress(ip), true, ip);
    }
  });
  test("public IPv4 addresses and the edges of the private ranges are allowed", () => {
    for (const ip of ["8.8.8.8", "1.1.1.1", "93.184.216.34", "172.15.255.255", "172.32.0.1", "11.0.0.1", "100.63.255.255", "100.128.0.1", "169.253.1.1", "192.169.0.1", "223.255.255.255"]) {
      assert.equal(isBlockedAddress(ip), false, ip);
    }
  });
  test("IPv6: loopback, unspecified, unique-local, link-local, multicast, documentation and every embedded private IPv4 form are blocked", () => {
    for (const ip of ["::", "::1", "fc00::1", "fd12:3456::1", "fe80::1", "fe80::abcd%eth0", "ff02::1", "2001:db8::1", "::ffff:127.0.0.1", "::ffff:10.0.0.1", "::ffff:169.254.169.254",
      "::ffff:7f00:1", "64:ff9b::a00:1", "64:ff9b::7f00:1", "2002:7f00:1::1", "2002:a9fe:a9fe::1", "::127.0.0.1", "0:0:0:0:0:0:0:1", "100::1"]) {
      assert.equal(isBlockedAddress(ip), true, ip);
    }
  });
  test("public IPv6 and v4-mapped public addresses are allowed; garbage is blocked", () => {
    for (const ip of ["2606:4700:4700::1111", "2a00:1450:4009:81f::200e", "::ffff:8.8.8.8", "64:ff9b::808:808"]) assert.equal(isBlockedAddress(ip), false, ip);
    for (const ip of ["", "not-an-ip", "1.2.3", "::g", "999.1.1.1"]) assert.equal(isBlockedAddress(ip), true, ip);
  });
});

describe("URL policy", () => {
  test("only plain https on the standard port, with a real public host name", () => {
    assert.equal(checkFetchUrl("https://cdn.example.com/a.jpg?x=1").hostname, "cdn.example.com");
    for (const bad of ["http://a.example.com/x.jpg", "ftp://a.example.com/x", "file:///etc/passwd", "gopher://a.example.com", "javascript:alert(1)", "data:image/png;base64,AAAA",
      "https://user:pw@a.example.com/x.jpg", "https://a.example.com:8443/x.jpg", "https://a.example.com:22/x", "https://127.0.0.1/x.jpg", "https://[::1]/x.jpg", "https://169.254.169.254/latest/meta-data",
      "https://2130706433/x.jpg", "https://0x7f000001/x.jpg", "https://localhost/x.jpg", "https://printer.local/x.jpg", "https://db.internal/x.jpg", "https://intranet/x.jpg", "not a url", ""]) {
      assert.throws(() => checkFetchUrl(bad), ImageFetchError, bad);
    }
  });
});

describe("content sniffing", () => {
  test("JPEG, PNG and WebP are recognised by their bytes", () => {
    assert.deepEqual(sniffImage(JPEG), { mime: "image/jpeg", ext: "jpg" });
    assert.deepEqual(sniffImage(PNG), { mime: "image/png", ext: "png" });
    assert.deepEqual(sniffImage(WEBP), { mime: "image/webp", ext: "webp" });
  });
  test("SVG, HTML, GIF, PDF, tiny and empty files are refused — whatever the server claimed", () => {
    assert.throws(() => sniffImage(SVG), (e) => e.code === "svg");
    assert.throws(() => sniffImage(new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"></svg>')), (e) => e.code === "svg");
    assert.throws(() => sniffImage(HTML), (e) => e.code === "not_image");
    assert.throws(() => sniffImage(new TextEncoder().encode("GIF89a\x01\x00\x01\x00\x80\x00\x00")), (e) => e.code === "not_image");
    assert.throws(() => sniffImage(new TextEncoder().encode("%PDF-1.7\n1 0 obj << >>")), (e) => e.code === "not_image");
    assert.throws(() => sniffImage(new Uint8Array([0xff, 0xd8])), (e) => e.code === "empty");
  });
});

describe("the fetch", () => {
  test("a good image: bytes returned, type from the bytes, connection pinned to the checked address", async () => {
    const log = [];
    const d = fake({ "cdn.example.com": ["93.184.216.34"] }, { "https://cdn.example.com/a.jpg": reply(200, { "content-type": "text/plain" }, chunks(JPEG.subarray(0, 10), JPEG.subarray(10))) }, log);
    const r = await fetchImage("https://cdn.example.com/a.jpg", { deps: d });
    assert.equal(r.mime, "image/jpeg"); assert.equal(r.ext, "jpg"); assert.equal(r.bytes.length, JPEG.length); assert.equal(r.sha256.length, 64);
    assert.deepEqual(log, [["https://cdn.example.com/a.jpg", "93.184.216.34"]]);
  });

  test("a name that resolves to a private address is refused before any connection", async () => {
    const log = [];
    for (const addr of ["127.0.0.1", "10.1.2.3", "169.254.169.254", "::1", "fd00::5", "::ffff:192.168.0.1"]) {
      const d = fake({ "evil.example.com": [addr] }, {}, log);
      assert.equal(await code(fetchImage("https://evil.example.com/a.jpg", { deps: d })), "blocked_address", addr);
    }
    assert.deepEqual(log, [], "no request was ever made");
  });

  test("DNS answering with one public and one private address is refused (no choosing the good one)", async () => {
    const d = fake({ "mixed.example.com": ["93.184.216.34", "10.0.0.5"] }, {});
    assert.equal(await code(fetchImage("https://mixed.example.com/a.jpg", { deps: d })), "blocked_address");
  });

  test("unresolvable name", async () => {
    assert.equal(await code(fetchImage("https://nowhere.example.com/a.jpg", { deps: fake({}, {}) })), "resolve_failed");
  });

  test("redirects: followed (re-resolved, re-pinned) up to three hops; fourth refused", async () => {
    const log = [];
    const d = fake({ "a.example.com": ["93.184.216.34"], "b.example.com": ["93.184.216.35"] }, {
      "https://a.example.com/1": reply(302, { location: "https://b.example.com/2" }),
      "https://b.example.com/2": reply(301, { location: "/3" }),
      "https://b.example.com/3": reply(200, {}, chunks(PNG)),
    }, log);
    const r = await fetchImage("https://a.example.com/1", { deps: d });
    assert.equal(r.mime, "image/png"); assert.equal(r.finalUrl, "https://b.example.com/3");
    assert.deepEqual(log.map((l) => l[1]), ["93.184.216.34", "93.184.216.35", "93.184.216.35"]);
    const loop = fake({ "a.example.com": ["93.184.216.34"] }, { "https://a.example.com/1": reply(302, { location: "/1" }) });
    assert.equal(await code(fetchImage("https://a.example.com/1", { deps: loop })), "redirect");
  });

  test("a redirect to http, to a private host, to an IP literal, to the metadata address, or to nowhere is refused", async () => {
    for (const loc of ["http://b.example.com/x.jpg", "https://127.0.0.1/x.jpg", "https://169.254.169.254/latest/meta-data/", "https://localhost/x", "https://internal.corp/x", "ftp://b.example.com/x", ""]) {
      const d = fake({ "a.example.com": ["93.184.216.34"] }, { "https://a.example.com/1": reply(302, loc ? { location: loc } : {}) });
      const c = await code(fetchImage("https://a.example.com/1", { deps: d }));
      assert.ok(["bad_url", "blocked_address", "redirect"].includes(c), `${loc} → ${c}`);
    }
    // a redirect target whose NAME resolves privately
    const d = fake({ "a.example.com": ["93.184.216.34"], "sneaky.example.com": ["192.168.0.10"] }, { "https://a.example.com/1": reply(302, { location: "https://sneaky.example.com/x" }) });
    assert.equal(await code(fetchImage("https://a.example.com/1", { deps: d })), "blocked_address");
  });

  test("size: Content-Length over the cap is refused early; a body that outgrows the cap is cut off while streaming", async () => {
    const early = { destroyed: false };
    let d = fake({ "a.example.com": ["93.184.216.34"] }, { "https://a.example.com/b": reply(200, { "content-length": "99999999" }, chunks(JPEG), early) });
    assert.equal(await code(fetchImage("https://a.example.com/b", { deps: d, maxBytes: 1000 })), "too_large");
    assert.equal(early.destroyed, true);
    const streamed = { destroyed: false };
    async function* big() { yield JPEG; for (let i = 0; i < 100; i++) yield new Uint8Array(100); }
    d = fake({ "a.example.com": ["93.184.216.34"] }, { "https://a.example.com/b": reply(200, {}, big(), streamed) });
    assert.equal(await code(fetchImage("https://a.example.com/b", { deps: d, maxBytes: 1000 })), "too_large");
  });

  test("an SVG or an HTML page served as an image is refused; non-200 is refused", async () => {
    let d = fake({ "a.example.com": ["93.184.216.34"] }, { "https://a.example.com/s": reply(200, { "content-type": "image/jpeg" }, chunks(SVG)) });
    assert.equal(await code(fetchImage("https://a.example.com/s", { deps: d })), "svg");
    d = fake({ "a.example.com": ["93.184.216.34"] }, { "https://a.example.com/h": reply(200, { "content-type": "image/png" }, chunks(HTML)) });
    assert.equal(await code(fetchImage("https://a.example.com/h", { deps: d })), "not_image");
    d = fake({ "a.example.com": ["93.184.216.34"] }, { "https://a.example.com/n": reply(404, {}) });
    assert.equal(await code(fetchImage("https://a.example.com/n", { deps: d })), "http_status");
  });

  test("a slow server is cut off by the timeout", async () => {
    const d = {
      resolve: async () => ["93.184.216.34"],
      get: (_u, _a, signal) => new Promise((_, rej) => signal.addEventListener("abort", () => rej(new Error("aborted")))),
    };
    assert.equal(await code(fetchImage("https://a.example.com/slow", { deps: d, timeoutMs: 50 })), "timeout");
  });

  test("a failed fetch of one image never throws anything but ImageFetchError (so it can be reported, not crash a batch)", async () => {
    const d = fake({ "a.example.com": ["93.184.216.34"] }, {});
    assert.equal(await code(fetchImage("https://a.example.com/x", { deps: d })), "network");
  });
});

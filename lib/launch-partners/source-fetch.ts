/**
 * source-fetch.ts — read a business's OWN public web pages, server-side, safely.
 *
 * The address is administrator-supplied (or the Directory's website field) and the response is attacker-controlled, so
 * the fetch is built on the same rules as the product importer's image fetcher (image-fetch.ts), which it reuses:
 *
 *   · https only, port 443, a NAMED host (no IP literals, no internal names), no credentials
 *   · EVERY address the name resolves to is checked; the connection is PINNED to the checked address (no DNS rebinding)
 *   · redirects are followed by hand (≤3), each hop re-validated, and may only stay on the SAME site (with or without www)
 *   · robots.txt is honoured: a path it disallows for us (or for everyone) is not fetched; a server error on robots.txt
 *     is treated as "do not fetch"
 *   · a small byte cap enforced while streaming, a hard timeout, text/html only, no cookies sent, no JavaScript run
 *   · it identifies itself plainly (OneShetlandPreviewBot, with our address)
 *
 * It reads pages. It writes nothing and follows no form. The network edges are injected so every rule is tested offline.
 */
import https from "node:https";
import net from "node:net";
import dns from "node:dns";
import zlib from "node:zlib";
import { Readable, pipeline, type Transform } from "node:stream";
import { checkFetchUrl, isBlockedAddress, ImageFetchError, type GetResult } from "../product-import/image-fetch.ts";

export type SourceErrorCode = "bad_url" | "blocked_address" | "resolve_failed" | "redirect" | "offsite" | "http_status" | "timeout" | "network" | "too_large" | "not_html" | "bad_encoding" | "robots";
export class SourceFetchError extends Error {
  code: SourceErrorCode;
  constructor(code: SourceErrorCode, message: string) { super(message); this.code = code; this.name = "SourceFetchError"; }
}

export const PAGE_MAX_BYTES = 1_500_000;
export const PAGE_TIMEOUT_MS = 7_000;
export const BOT_TOKEN = "OneShetlandPreviewBot";
export const USER_AGENT = `${BOT_TOKEN}/1.0 (+https://oneshetland.com)`;
const MAX_REDIRECTS = 3;

/**
 * The encodings we ASK for and can decode. The request must say so honestly: some servers (a page-cache plugin in front of
 * nginx, a CDN) send a pre-compressed copy whatever the client asked for, and Node does not decompress for us. Anything else
 * a server sends is refused by name, never read as text.
 */
export const ACCEPT_ENCODING = "gzip, deflate, br";
export const REQUEST_HEADERS: Record<string, string> = {
  Accept: "text/html,application/xhtml+xml;q=0.9,text/plain;q=0.5,*/*;q=0.1",
  "User-Agent": USER_AGENT,
  "Accept-Encoding": ACCEPT_ENCODING,
  "Accept-Language": "en-GB,en;q=0.8",
};
const SUPPORTED_ENCODINGS = new Set(["gzip", "x-gzip", "deflate", "br"]);
/** More layers than this is not a web server being helpful. */
const MAX_ENCODING_LAYERS = 2;

export interface SourceDeps {
  resolve: (host: string) => Promise<string[]>;
  get: (url: URL, address: string, signal: AbortSignal) => Promise<GetResult>;
}

export const defaultSourceDeps: SourceDeps = {
  resolve: (host) => new Promise((res, rej) => {
    dns.lookup(host, { all: true, verbatim: true }, (err, addrs) => (err ? rej(err) : res(addrs.map((a) => a.address))));
  }),
  get: (url, address, signal) => new Promise<GetResult>((resolve, reject) => {
    const req = https.request({
      protocol: "https:", hostname: url.hostname, port: 443, path: `${url.pathname}${url.search}`, method: "GET",
      servername: url.hostname,
      lookup: ((_h: string, o: { all?: boolean } | undefined, cb: (...a: unknown[]) => void) => {
        const family = net.isIPv6(address) ? 6 : 4;
        if (o && o.all) cb(null, [{ address, family }]); else cb(null, address, family);
      }) as unknown as https.RequestOptions["lookup"],
      headers: REQUEST_HEADERS,
      signal,
    }, (r) => {
      const headers: Record<string, string | undefined> = {};
      for (const [k, v] of Object.entries(r.headers)) headers[k.toLowerCase()] = Array.isArray(v) ? v[0] : v;
      resolve({ status: r.statusCode ?? 0, headers, body: r, destroy: () => r.destroy() });
    });
    req.on("error", reject);
    req.end();
  }),
};

const siteOf = (u: URL) => u.hostname.toLowerCase().replace(/^www\./, "");

function checkUrl(raw: string): URL {
  try { return checkFetchUrl(raw); } catch (e) {
    const code = (e as ImageFetchError).code;
    throw new SourceFetchError(code === "blocked_address" ? "blocked_address" : "bad_url", code === "blocked_address" ? "That address points inside a private network." : "That is not an https website address.");
  }
}

/* ── robots.txt (pure) ───────────────────────────────────────────────────── */

export interface RobotsRules { allow: string[]; disallow: string[] }

/** The rules that apply to us: the group naming our bot if there is one, otherwise the `*` group. */
export function parseRobots(text: string): RobotsRules {
  const groups: { agents: string[]; allow: string[]; disallow: string[] }[] = [];
  let cur: { agents: string[]; allow: string[]; disallow: string[]; sawRule: boolean } | null = null;
  for (const lineRaw of text.split(/\r?\n/)) {
    const line = lineRaw.replace(/#.*/, "").trim();
    const m = /^([A-Za-z-]+)\s*:\s*(.*)$/.exec(line);
    if (!m) continue;
    const key = m[1].toLowerCase(), val = m[2].trim();
    if (key === "user-agent") {
      if (!cur || cur.sawRule) { cur = { agents: [], allow: [], disallow: [], sawRule: false }; groups.push(cur); }
      cur.agents.push(val.toLowerCase());
    } else if (cur && (key === "allow" || key === "disallow")) {
      cur.sawRule = true;
      if (val) (key === "allow" ? cur.allow : cur.disallow).push(val);
    }
  }
  const pick = groups.filter((g) => g.agents.includes(BOT_TOKEN.toLowerCase()));
  const use = pick.length ? pick : groups.filter((g) => g.agents.includes("*"));
  return { allow: use.flatMap((g) => g.allow), disallow: use.flatMap((g) => g.disallow) };
}

function robotsMatch(rule: string, path: string): number {
  // longest-prefix semantics with * and $ support; returns the matched length or -1
  const anchored = rule.endsWith("$");
  const body = anchored ? rule.slice(0, -1) : rule;
  const re = new RegExp(`^${body.split("*").map((p) => p.replace(/[.+?^${}()|[\]\\]/g, "\\$&")).join(".*")}${anchored ? "$" : ""}`);
  return re.test(path) ? body.length : -1;
}

export function robotsAllows(rules: RobotsRules | null, pathAndQuery: string): boolean {
  if (!rules) return true;
  let bestAllow = -1, bestDisallow = -1;
  for (const r of rules.allow) bestAllow = Math.max(bestAllow, robotsMatch(r, pathAndQuery));
  for (const r of rules.disallow) bestDisallow = Math.max(bestDisallow, robotsMatch(r, pathAndQuery));
  return bestDisallow < 0 || bestAllow >= bestDisallow;
}

/* ── the fetch ───────────────────────────────────────────────────────────── */

/* ── decoding what the server sent ──────────────────────────────────────── */

/** The content-encoding layers, in the order the server applied them, minus "identity". Throws for anything we cannot decode. */
export function parseEncodings(header: string | undefined): string[] {
  const layers = (header ?? "").toLowerCase().split(",").map((x) => x.trim()).filter((x) => x && x !== "identity");
  if (layers.length > MAX_ENCODING_LAYERS) throw new SourceFetchError("bad_encoding", "The page was wrapped in too many layers of compression to read.");
  for (const l of layers) if (!SUPPORTED_ENCODINGS.has(l)) throw new SourceFetchError("bad_encoding", `The site sent its page in an encoding we can't read (${l.slice(0, 20)}).`);
  return layers;
}

const decoderFor = (enc: string): Transform => (enc === "br" ? zlib.createBrotliDecompress() : enc === "deflate" ? zlib.createInflate() : zlib.createGunzip());

/** Mark errors that came from the NETWORK side, so a corrupt-compression error is never mistaken for one (and vice versa). */
async function* tagWire(src: AsyncIterable<Uint8Array>): AsyncGenerator<Uint8Array> {
  try { yield* src; } catch (e) { (e as { wire?: boolean }).wire = true; throw e; }
}

/** Pass chunks through, refusing to go past `max` bytes. */
async function* capped(src: AsyncIterable<Uint8Array>, max: number, onOver: () => Error, onStop?: () => void): AsyncGenerator<Uint8Array> {
  let n = 0;
  try {
    for await (const c of src) { n += c.byteLength; if (n > max) throw onOver(); yield c; }
  } finally { onStop?.(); }
}

/**
 * The page's bytes, decompressed, with BOTH sizes bounded: what crosses the wire (so a slow giant is refused early) and what comes
 * out the other end (so a tiny file that inflates to gigabytes — a "zip bomb" — is stopped as soon as it passes the cap, never held in
 * memory). Decoding is streamed; nothing is decoded that is not within the cap.
 */
async function readBody(body: AsyncIterable<Uint8Array>, layers: string[], maxBytes: number): Promise<Uint8Array> {
  const tooBig = () => new SourceFetchError("too_large", "The page is too large to read.");
  let stream: AsyncIterable<Uint8Array> = capped(tagWire(body), maxBytes, tooBig);
  const decoders: Transform[] = [];
  for (const enc of [...layers].reverse()) {
    const d = decoderFor(enc); decoders.push(d);
    pipeline(Readable.from(stream), d, (err) => { if (err) d.destroy(err); });
    stream = d;
  }
  const chunks: Uint8Array[] = []; let size = 0;
  try {
    for await (const c of capped(stream, maxBytes, tooBig, () => decoders.forEach((d) => d.destroy()))) { chunks.push(c); size += c.byteLength; }
  } catch (e) {
    if (e instanceof SourceFetchError || (e as { wire?: boolean }).wire || !layers.length) throw e;
    throw new SourceFetchError("bad_encoding", "The page's compressed content could not be decoded.");
  }
  const out = new Uint8Array(size); let off = 0; for (const c of chunks) { out.set(c, off); off += c.byteLength; }
  return out;
}

/** True when the bytes are not text: NUL bytes, or a large share of control / non-character bytes, in the first few KB. */
export function looksBinary(bytes: Uint8Array): boolean {
  const n = Math.min(bytes.length, 4096);
  if (n === 0) return false;
  let bad = 0;
  for (let i = 0; i < n; i++) {
    const b = bytes[i];
    if (b === 0) return true;
    if (b < 9 || (b > 13 && b < 32) || b === 127) bad++;
  }
  return bad / n > 0.1;
}

/** The charset to decode with: the header's, else a <meta> in the first 2 KB, else UTF-8. An unknown label falls back to UTF-8. */
export function chooseCharset(contentType: string, head: Uint8Array): string {
  const fromHeader = /charset=["']?([a-z0-9_.:-]+)/i.exec(contentType)?.[1];
  if (fromHeader) return fromHeader;
  const first = new TextDecoder("latin1").decode(head.subarray(0, 2048));
  return /<meta[^>]+charset\s*=\s*["']?\s*([a-z0-9_.:-]+)/i.exec(first)?.[1] ?? "utf-8";
}

export function decodeText(bytes: Uint8Array, contentType: string): string {
  const charset = chooseCharset(contentType, bytes);
  try { return new TextDecoder(charset, { fatal: false }).decode(bytes); } catch { return new TextDecoder("utf-8", { fatal: false }).decode(bytes); }
}

export interface FetchedText { finalUrl: string; status: number; text: string; contentType: string }

/** GET one same-site page as text. Throws SourceFetchError; never returns a non-200 body. */
export async function fetchSourceText(
  rawUrl: string,
  opts: { maxBytes?: number; timeoutMs?: number; deps?: SourceDeps; accept?: "html" | "text"; allowStatus?: number[] } = {},
): Promise<FetchedText> {
  const deps = opts.deps ?? defaultSourceDeps;
  const maxBytes = opts.maxBytes ?? PAGE_MAX_BYTES;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), opts.timeoutMs ?? PAGE_TIMEOUT_MS);
  try {
    const first = checkUrl(rawUrl);
    let url = first;
    for (let hop = 0; ; hop++) {
      let addrs: string[];
      try { addrs = await deps.resolve(url.hostname); } catch { throw new SourceFetchError("resolve_failed", `Could not find "${url.hostname}".`); }
      if (!addrs.length) throw new SourceFetchError("resolve_failed", `Could not find "${url.hostname}".`);
      if (addrs.some(isBlockedAddress)) throw new SourceFetchError("blocked_address", "That address points inside a private network.");

      let r: GetResult;
      try { r = await deps.get(url, addrs[0], ctrl.signal); } catch (e) {
        if (ctrl.signal.aborted) throw new SourceFetchError("timeout", "The page took too long to answer.");
        throw new SourceFetchError("network", `Could not reach the site (${((e as Error).message || "network error").replace(/\.+$/, "")}).`);
      }
      if (r.status >= 300 && r.status < 400) {
        r.destroy();
        if (hop >= MAX_REDIRECTS) throw new SourceFetchError("redirect", "The address redirects too many times.");
        const loc = r.headers.location;
        if (!loc) throw new SourceFetchError("redirect", "The address redirects nowhere.");
        let next: URL;
        try { next = new URL(loc, url); } catch { throw new SourceFetchError("redirect", "The address redirects somewhere invalid."); }
        const checked = checkUrl(next.toString());
        if (siteOf(checked) !== siteOf(first)) throw new SourceFetchError("offsite", "The address redirects to a different website, so it was not followed.");
        url = checked;
        continue;
      }
      if (r.status !== 200 && !(opts.allowStatus ?? []).includes(r.status)) { r.destroy(); throw new SourceFetchError("http_status", `The site answered ${r.status}.`); }
      const contentType = (r.headers["content-type"] ?? "").toLowerCase();
      if (r.status === 200) {
        if ((opts.accept ?? "html") === "html" ? !/(text\/html|application\/xhtml\+xml)/.test(contentType) : !/text\/plain|text\/html|^$/.test(contentType)) {
          r.destroy(); throw new SourceFetchError("not_html", "That address is not a web page.");
        }
      }
      // What crosses the wire is limited first (a Content-Length over the cap is refused outright)…
      const declared = Number(r.headers["content-length"]);
      if (Number.isFinite(declared) && declared > maxBytes) { r.destroy(); throw new SourceFetchError("too_large", "The page is too large to read."); }
      let layers: string[];
      try { layers = parseEncodings(r.headers["content-encoding"]); } catch (e) { r.destroy(); throw e; }
      // …then the body is read and DECOMPRESSED under the same cap, so the cap means the same thing for a plain page and a squeezed one.
      let bytes: Uint8Array;
      try { bytes = await readBody(r.body, layers, maxBytes); }
      catch (e) {
        r.destroy();
        if (e instanceof SourceFetchError) throw e;
        if (ctrl.signal.aborted) throw new SourceFetchError("timeout", "The page took too long to download.");
        throw new SourceFetchError("network", "The download was interrupted.");
      }
      // Whatever the headers claimed, a page of text is text: binary data is refused here, before anything reads it as a page.
      if (r.status === 200 && looksBinary(bytes)) throw new SourceFetchError("not_html", "That address returned binary data, not a web page.");
      const text = decodeText(bytes, contentType);
      return { finalUrl: url.toString(), status: r.status, text, contentType };
    }
  } finally { clearTimeout(timer); }
}

/**
 * The site's robots rules, or null when there are none to obey. A 404/410 (or any other 4xx) means "no restrictions"; a
 * 5xx means we cannot tell, so we do not read the site; an unreachable robots.txt is left to the page fetch to report.
 */
export async function fetchRobots(origin: string, deps?: SourceDeps): Promise<RobotsRules | null> {
  const robotsUrl = new URL("/robots.txt", origin).toString();
  try {
    const r = await fetchSourceText(robotsUrl, { deps, accept: "text", maxBytes: 200_000, timeoutMs: 4_000, allowStatus: Array.from({ length: 100 }, (_, i) => 400 + i) });
    return r.status === 200 ? parseRobots(r.text) : null;
  } catch (e) {
    if (e instanceof SourceFetchError && e.code === "http_status") throw new SourceFetchError("robots", "The website's robots.txt could not be read (server error), so it was not read.");
    return null;
  }
}

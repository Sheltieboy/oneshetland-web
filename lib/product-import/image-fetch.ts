/**
 * image-fetch.ts — fetch ONE merchant-supplied image URL safely, server-side.
 *
 * The URL is attacker-controlled input to a server that sits inside a hosting
 * network, so the fetch is built to be unable to reach anything but the public
 * internet, and unable to be talked into returning anything but a raster image:
 *
 *   · https only, no credentials, port 443 only, no IP-literal or internal host names
 *   · EVERY address the name resolves to is checked; if any is private, loopback,
 *     link-local (169.254.169.254 — cloud metadata), CGNAT, multicast, reserved,
 *     documentation or an IPv6 form that embeds one, the fetch is refused
 *   · the connection is PINNED to the address that was checked, so a second DNS
 *     answer cannot redirect it (rebinding)
 *   · redirects are followed by hand, at most three, and every hop is re-validated
 *     the same way (a redirect to http:// or to a private address is refused)
 *   · overall timeout and a hard byte cap enforced while streaming, plus an early
 *     refusal on Content-Length
 *   · the bytes decide the type, not the server: JPEG, PNG or WebP by magic
 *     number. SVG, HTML, GIF, PDF and everything else are refused.
 *
 * The network edges (resolve, get) are injected so every rule above is tested
 * without a network; the defaults use node:dns and node:https.
 */
import dns from 'node:dns';
import https from 'node:https';
import net from 'node:net';
import { createHash } from 'node:crypto';

export type ImageErrorCode =
  | 'bad_url' | 'blocked_address' | 'resolve_failed' | 'redirect' | 'http_status' | 'timeout' | 'network' | 'too_large' | 'empty' | 'svg' | 'not_image';

export class ImageFetchError extends Error {
  code: ImageErrorCode;
  constructor(code: ImageErrorCode, message: string) { super(message); this.code = code; this.name = 'ImageFetchError'; }
}

export const IMAGE_MAX_BYTES = 5 * 1024 * 1024;
export const IMAGE_TIMEOUT_MS = 10_000;
const MAX_REDIRECTS = 3;

/* ── Address policy (pure) ───────────────────────────────────────────────── */

function v4ToInt(ip: string): number {
  return ip.split('.').reduce((a, o) => (a << 8) + Number(o), 0) >>> 0;
}
const V4_BLOCKS: [string, number][] = [
  ['0.0.0.0', 8], ['10.0.0.0', 8], ['100.64.0.0', 10], ['127.0.0.0', 8], ['169.254.0.0', 16], ['172.16.0.0', 12],
  ['192.0.0.0', 24], ['192.0.2.0', 24], ['192.88.99.0', 24], ['192.168.0.0', 16], ['198.18.0.0', 15], ['198.51.100.0', 24],
  ['203.0.113.0', 24], ['224.0.0.0', 4], ['240.0.0.0', 4],
];
function v4Blocked(ip: string): boolean {
  const n = v4ToInt(ip);
  return V4_BLOCKS.some(([base, bits]) => {
    const mask = bits === 0 ? 0 : (~0 << (32 - bits)) >>> 0;
    return (n & mask) >>> 0 === (v4ToInt(base) & mask) >>> 0;
  });
}

/** Expand an IPv6 literal into 8 16-bit groups; null if it is not valid. */
function v6Groups(ip: string): number[] | null {
  let s = ip.split('%')[0].toLowerCase();
  // dotted-quad tail
  const m = /^(.*:)(\d+\.\d+\.\d+\.\d+)$/.exec(s);
  if (m) {
    if (!net.isIPv4(m[2])) return null;
    const n = v4ToInt(m[2]);
    s = `${m[1]}${((n >>> 16) & 0xffff).toString(16)}:${(n & 0xffff).toString(16)}`;
  }
  const halves = s.split('::');
  if (halves.length > 2) return null;
  const parse = (h: string) => (h === '' ? [] : h.split(':'));
  const head = parse(halves[0]);
  const tail = halves.length === 2 ? parse(halves[1]) : [];
  const fill = 8 - head.length - tail.length;
  if ((halves.length === 1 && head.length !== 8) || fill < (halves.length === 2 ? 1 : 0)) return null;
  const groups = [...head, ...Array(halves.length === 2 ? fill : 0).fill('0'), ...tail].map((g) => parseInt(g, 16));
  return groups.length === 8 && groups.every((g) => Number.isInteger(g) && g >= 0 && g <= 0xffff) ? groups : null;
}

/** True if the address must never be fetched. Unparseable input counts as blocked. */
export function isBlockedAddress(ip: string): boolean {
  if (net.isIPv4(ip)) return v4Blocked(ip);
  if (net.isIPv6(ip)) {
    const g = v6Groups(ip);
    if (!g) return true;
    const v4 = (hi: number, lo: number) => `${hi >> 8}.${hi & 255}.${lo >> 8}.${lo & 255}`;
    if (g.every((x) => x === 0)) return true;                                 // ::
    if (g.slice(0, 7).every((x) => x === 0) && g[7] === 1) return true;       // ::1
    if (g.slice(0, 5).every((x) => x === 0) && g[5] === 0xffff) return v4Blocked(v4(g[6], g[7]));   // ::ffff:a.b.c.d
    if (g.slice(0, 6).every((x) => x === 0)) return true;                       // ::a.b.c.d (deprecated IPv4-compatible form)
    if (g[0] === 0x64 && g[1] === 0xff9b && g.slice(2, 6).every((x) => x === 0)) return v4Blocked(v4(g[6], g[7])); // NAT64
    if (g[0] === 0x2002) return v4Blocked(v4(g[1], g[2]));                    // 6to4
    if ((g[0] & 0xfe00) === 0xfc00) return true;                              // fc00::/7 unique local
    if ((g[0] & 0xffc0) === 0xfe80) return true;                              // fe80::/10 link-local
    if ((g[0] & 0xffc0) === 0xfec0) return true;                              // fec0::/10 site-local
    if ((g[0] & 0xff00) === 0xff00) return true;                              // multicast
    if (g[0] === 0x2001 && g[1] === 0x0db8) return true;                      // documentation
    if (g[0] === 0x0100 && g.slice(1, 4).every((x) => x === 0)) return true;  // discard 100::/64
    return false;
  }
  return true;
}

const INTERNAL_NAME = /(^|\.)(localhost|local|internal|intranet|lan|home|corp|localdomain)$/i;

/** Validate a URL string; returns the URL to fetch or throws. */
export function checkFetchUrl(raw: string): URL {
  let u: URL;
  try { u = new URL(raw); } catch { throw new ImageFetchError('bad_url', 'That is not a valid web address.'); }
  if (u.protocol !== 'https:') throw new ImageFetchError('bad_url', 'Only https:// image addresses are accepted.');
  if (u.username || u.password) throw new ImageFetchError('bad_url', 'Addresses with a username or password are not accepted.');
  if (u.port && u.port !== '443') throw new ImageFetchError('bad_url', 'Only the standard https port is accepted.');
  const host = u.hostname.replace(/^\[|\]$/g, '');
  if (net.isIP(host)) throw new ImageFetchError('blocked_address', 'Images must come from a named website, not an IP address.');
  if (!host.includes('.') || INTERNAL_NAME.test(host)) {
    throw new ImageFetchError('blocked_address', 'That address points inside a private network.');
  }
  return u;
}

/* ── Content sniffing (pure) ─────────────────────────────────────────────── */

export type Sniffed = { mime: 'image/jpeg' | 'image/png' | 'image/webp'; ext: 'jpg' | 'png' | 'webp' };

export function sniffImage(b: Uint8Array): Sniffed {
  if (b.length < 12) throw new ImageFetchError('empty', 'The file is too small to be an image.');
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return { mime: 'image/jpeg', ext: 'jpg' };
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 && b[4] === 0x0d && b[5] === 0x0a && b[6] === 0x1a && b[7] === 0x0a) return { mime: 'image/png', ext: 'png' };
  if (b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 && b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50) return { mime: 'image/webp', ext: 'webp' };
  const head = new TextDecoder('utf-8', { fatal: false }).decode(b.subarray(0, 512)).trimStart().toLowerCase();
  if (head.startsWith('<svg') || (head.startsWith('<?xml') && head.includes('<svg')) || head.includes('<svg ')) {
    throw new ImageFetchError('svg', 'SVG images are not accepted — use JPEG, PNG or WebP.');
  }
  throw new ImageFetchError('not_image', 'That address does not return a JPEG, PNG or WebP image.');
}

/* ── Network edges (injectable) ──────────────────────────────────────────── */

export interface GetResult { status: number; headers: Record<string, string | undefined>; body: AsyncIterable<Uint8Array>; destroy: () => void }
export interface Deps {
  resolve: (host: string) => Promise<string[]>;
  /** Connect to `address` (already validated) and request `url`. Must not resolve names again. */
  get: (url: URL, address: string, signal: AbortSignal) => Promise<GetResult>;
}

export const defaultDeps: Deps = {
  resolve: (host) => new Promise((res, rej) => {
    dns.lookup(host, { all: true, verbatim: true }, (err, addrs) => (err ? rej(err) : res(addrs.map((a) => a.address))));
  }),
  get: (url, address, signal) => new Promise<GetResult>((resolve, reject) => {
    const req = https.request({
      protocol: 'https:', hostname: url.hostname, port: 443, path: `${url.pathname}${url.search}`, method: 'GET',
      servername: url.hostname,                                   // SNI and certificate checks use the NAME…
      lookup: (_h, _o, cb) => { const fam = net.isIPv6(address) ? 6 : 4; (cb as unknown as (e: null, a: string, f: number) => void)(null, address, fam); },   // …the socket uses the CHECKED address
      headers: { Accept: 'image/jpeg,image/png,image/webp,*/*;q=0.1', 'User-Agent': 'OneShetlandImport/1.0 (+https://oneshetland.com)', 'Accept-Encoding': 'identity' },
      signal,
    }, (r) => {
      const headers: Record<string, string | undefined> = {};
      for (const [k, v] of Object.entries(r.headers)) headers[k.toLowerCase()] = Array.isArray(v) ? v[0] : v;
      resolve({ status: r.statusCode ?? 0, headers, body: r, destroy: () => r.destroy() });
    });
    req.on('error', reject);
    req.end();
  }),
};

/* ── The fetch ───────────────────────────────────────────────────────────── */

export interface FetchedImage { bytes: Uint8Array; mime: Sniffed['mime']; ext: Sniffed['ext']; sha256: string; finalUrl: string }

export async function fetchImage(
  rawUrl: string,
  opts: { maxBytes?: number; timeoutMs?: number; deps?: Deps } = {},
): Promise<FetchedImage> {
  const deps = opts.deps ?? defaultDeps;
  const maxBytes = opts.maxBytes ?? IMAGE_MAX_BYTES;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), opts.timeoutMs ?? IMAGE_TIMEOUT_MS);
  try {
    let url = checkFetchUrl(rawUrl);
    for (let hop = 0; ; hop++) {
      let addrs: string[];
      try { addrs = await deps.resolve(url.hostname); }
      catch { throw new ImageFetchError('resolve_failed', `Could not find "${url.hostname}".`); }
      if (!addrs.length) throw new ImageFetchError('resolve_failed', `Could not find "${url.hostname}".`);
      if (addrs.some(isBlockedAddress)) throw new ImageFetchError('blocked_address', 'That address points inside a private network.');

      let r: GetResult;
      try { r = await deps.get(url, addrs[0], ctrl.signal); }
      catch (e) {
        if (ctrl.signal.aborted) throw new ImageFetchError('timeout', 'The image took too long to download.');
        throw new ImageFetchError('network', `Could not download the image (${(e as Error).message || 'network error'}).`);
      }

      if (r.status >= 300 && r.status < 400) {
        r.destroy();
        if (hop >= MAX_REDIRECTS) throw new ImageFetchError('redirect', 'The image address redirects too many times.');
        const loc = r.headers.location;
        if (!loc) throw new ImageFetchError('redirect', 'The image address redirects nowhere.');
        let next: URL;
        try { next = new URL(loc, url); } catch { throw new ImageFetchError('redirect', 'The image address redirects somewhere invalid.'); }
        url = checkFetchUrl(next.toString());   // https only, named host, no credentials — re-resolved and re-checked next loop
        continue;
      }
      if (r.status !== 200) { r.destroy(); throw new ImageFetchError('http_status', `The image address answered ${r.status}.`); }

      const declared = Number(r.headers['content-length']);
      if (Number.isFinite(declared) && declared > maxBytes) { r.destroy(); throw new ImageFetchError('too_large', `The image is larger than ${Math.round(maxBytes / 1048576)} MB.`); }

      const chunks: Uint8Array[] = [];
      let size = 0;
      try {
        for await (const c of r.body) {
          size += c.byteLength;
          if (size > maxBytes) { r.destroy(); throw new ImageFetchError('too_large', `The image is larger than ${Math.round(maxBytes / 1048576)} MB.`); }
          chunks.push(c);
        }
      } catch (e) {
        if (e instanceof ImageFetchError) throw e;
        if (ctrl.signal.aborted) throw new ImageFetchError('timeout', 'The image took too long to download.');
        throw new ImageFetchError('network', 'The download was interrupted.');
      }
      const bytes = new Uint8Array(size);
      let off = 0;
      for (const c of chunks) { bytes.set(c, off); off += c.byteLength; }
      const kind = sniffImage(bytes);
      return { bytes, ...kind, sha256: createHash('sha256').update(bytes).digest('hex'), finalUrl: url.toString() };
    }
  } finally {
    clearTimeout(timer);
  }
}

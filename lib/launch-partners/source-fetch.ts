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
import { checkFetchUrl, isBlockedAddress, ImageFetchError, type GetResult } from "../product-import/image-fetch.ts";

export type SourceErrorCode = "bad_url" | "blocked_address" | "resolve_failed" | "redirect" | "offsite" | "http_status" | "timeout" | "network" | "too_large" | "not_html" | "robots";
export class SourceFetchError extends Error {
  code: SourceErrorCode;
  constructor(code: SourceErrorCode, message: string) { super(message); this.code = code; this.name = "SourceFetchError"; }
}

export const PAGE_MAX_BYTES = 1_500_000;
export const PAGE_TIMEOUT_MS = 7_000;
export const BOT_TOKEN = "OneShetlandPreviewBot";
export const USER_AGENT = `${BOT_TOKEN}/1.0 (+https://oneshetland.com)`;
const MAX_REDIRECTS = 3;

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
      headers: { Accept: "text/html,application/xhtml+xml;q=0.9,text/plain;q=0.5,*/*;q=0.1", "User-Agent": USER_AGENT, "Accept-Encoding": "identity", "Accept-Language": "en-GB,en;q=0.8" },
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
      const declared = Number(r.headers["content-length"]);
      if (Number.isFinite(declared) && declared > maxBytes) { r.destroy(); throw new SourceFetchError("too_large", "The page is too large to read."); }
      const chunks: Uint8Array[] = []; let size = 0;
      try {
        for await (const c of r.body) {
          size += c.byteLength;
          if (size > maxBytes) { r.destroy(); throw new SourceFetchError("too_large", "The page is too large to read."); }
          chunks.push(c);
        }
      } catch (e) {
        if (e instanceof SourceFetchError) throw e;
        if (ctrl.signal.aborted) throw new SourceFetchError("timeout", "The page took too long to download.");
        throw new SourceFetchError("network", "The download was interrupted.");
      }
      const bytes = new Uint8Array(size); let off = 0; for (const c of chunks) { bytes.set(c, off); off += c.byteLength; }
      const charset = /charset=([a-z0-9_-]+)/.exec(contentType)?.[1] ?? "utf-8";
      let text: string;
      try { text = new TextDecoder(charset, { fatal: false }).decode(bytes); } catch { text = new TextDecoder("utf-8", { fatal: false }).decode(bytes); }
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

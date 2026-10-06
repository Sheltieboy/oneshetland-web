/**
 * source-extract.ts — turn one fetched web page into what a draft can be built from. Pure: HTML text in, plain data out.
 *
 * No JavaScript is run and nothing is "rendered": this reads the HTML the site serves. A site that builds its whole page in
 * the browser therefore yields little text, and the caller treats thin text as "not enough source information" rather
 * than guessing. Everything here is untrusted input: it is cut down to plain text and a short list of absolute https
 * addresses, never passed on as markup.
 */

export interface ExtractedImage { url: string; alt: string; width: number | null; height: number | null; from: "og" | "jsonld" | "img" }
export interface ExtractedProduct { name: string; price: number | null; currency: string | null; image: string | null; url: string | null }
/**
 * A web page is untrusted. Lines that read like instructions to an AI system, or that try to close the fence the prompt puts
 * around page text, are removed BEFORE the text becomes evidence or prompt — so they cannot be quoted back as "what the business says".
 */
export const INJECTION = /\b(ignore|disregard|forget|override)\b.{0,50}\b(previous|prior|above|earlier|all|any|these)\b.{0,50}\b(instructions?|prompts?|rules?|guidelines?)\b|\b(system prompt|developer message|you are now|act as an? |as an ai (language )?model|new instructions)\b|\b(source_page|candidate_pictures|propose_launch_draft)\b/i;

export interface ExtractedPage {
  url: string;
  title: string;
  description: string;
  headings: string[];
  /** Visible text, de-duplicated line by line, capped. */
  text: string;
  images: ExtractedImage[];
  links: { url: string; text: string }[];
  products: ExtractedProduct[];
  /** How many lines were removed for reading like instructions to an AI (0 for a normal site). */
  stripped: number;
}

const ENT: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", pound: "£", euro: "€", ndash: "–", mdash: "—", lsquo: "‘", rsquo: "’", ldquo: "“", rdquo: "”", hellip: "…", copy: "©", eacute: "é", egrave: "è", ouml: "ö", uuml: "ü" };
export function decodeEntities(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e: string) => {
    if (e[0] === "#") {
      const n = e[1].toLowerCase() === "x" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return Number.isFinite(n) && n > 0 && n < 0x110000 ? String.fromCodePoint(n) : "";
    }
    return ENT[e.toLowerCase()] ?? m;
  });
}

const clean = (s: string) => decodeEntities(s).replace(/\s+/g, " ").trim();
const attr = (tag: string, name: string): string | null => {
  const m = new RegExp(`\\s${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, "i").exec(tag);
  return m ? decodeEntities(m[1] ?? m[2] ?? m[3] ?? "") : null;
};

/** An absolute https address, or null. http:// and protocol-relative forms are upgraded; data:, javascript:, mailto: are refused. */
export function absoluteHttps(raw: string | null | undefined, base: string): string | null {
  if (!raw) return null;
  const t = raw.trim();
  if (!t || /^(data|javascript|mailto|tel|blob|about):/i.test(t)) return null;
  try {
    const u = new URL(t.startsWith("//") ? `https:${t}` : t, base);
    if (u.protocol === "http:") u.protocol = "https:";
    if (u.protocol !== "https:" || u.username || u.password) return null;
    u.hash = "";
    return u.toString().length <= 2048 ? u.toString() : null;
  } catch { return null; }
}

const SKIP_IMAGE = /(sprite|favicon|pixel|spacer|tracking|badge|payment|paypal|visa|mastercard|stripe|flag|avatar|emoji|placeholder|blank|loader|spinner|arrow|facebook|instagram|twitter|youtube|tiktok|pinterest|social)/i;
const IMAGE_EXT = /\.(jpe?g|png|webp)(\?|$)/i;

function largestFromSrcset(srcset: string): string | null {
  let best: { url: string; w: number } | null = null;
  for (const part of srcset.split(",")) {
    const [u, d] = part.trim().split(/\s+/);
    if (!u) continue;
    const w = d && /w$/.test(d) ? parseInt(d, 10) : d && /x$/.test(d) ? parseFloat(d) * 1000 : 0;
    if (!best || w > best.w) best = { url: u, w };
  }
  return best?.url ?? null;
}

function metaContent(html: string, key: string): string {
  const re = new RegExp(`<meta\\b[^>]*(?:property|name)\\s*=\\s*["']${key}["'][^>]*>`, "i");
  const tag = re.exec(html)?.[0];
  return tag ? clean(attr(tag, "content") ?? "") : "";
}

function jsonLdBlocks(html: string): unknown[] {
  const out: unknown[] = [];
  for (const m of html.matchAll(/<script\b[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    try { out.push(JSON.parse(m[1].trim())); } catch { /* ignore malformed blocks */ }
  }
  return out;
}
function* walkLd(node: unknown, depth = 0): Generator<Record<string, unknown>> {
  if (depth > 6 || node == null) return;
  if (Array.isArray(node)) { for (const n of node) yield* walkLd(n, depth + 1); return; }
  if (typeof node === "object") {
    const o = node as Record<string, unknown>;
    yield o;
    for (const v of Object.values(o)) if (v && typeof v === "object") yield* walkLd(v, depth + 1);
  }
}
const asStr = (v: unknown): string => (typeof v === "string" ? v : typeof v === "number" ? String(v) : "");
const typeOf = (o: Record<string, unknown>): string[] => (Array.isArray(o["@type"]) ? (o["@type"] as unknown[]).map(asStr) : [asStr(o["@type"])]);
const firstImage = (v: unknown): string | null => (typeof v === "string" ? v : Array.isArray(v) ? firstImage(v[0]) : v && typeof v === "object" ? asStr((v as Record<string, unknown>).url) || null : null);

export function extractPage(html: string, pageUrl: string): ExtractedPage {
  const head = html.slice(0, 400_000);
  const title = clean(/<title[^>]*>([\s\S]*?)<\/title>/i.exec(head)?.[1] ?? "") || metaContent(head, "og:title");
  const description = metaContent(head, "description") || metaContent(head, "og:description");

  // JSON-LD: products and the business's own image
  const products: ExtractedProduct[] = [];
  const images: ExtractedImage[] = [];
  const ld = jsonLdBlocks(html);
  for (const o of walkLd(ld)) {
    const types = typeOf(o);
    if (types.includes("Product")) {
      const offer = Array.isArray(o.offers) ? (o.offers[0] as Record<string, unknown>) : (o.offers as Record<string, unknown> | undefined);
      const price = Number(asStr(offer?.price ?? (offer as Record<string, unknown> | undefined)?.lowPrice));
      const img = absoluteHttps(firstImage(o.image), pageUrl);
      products.push({ name: clean(asStr(o.name)).slice(0, 200), price: Number.isFinite(price) && price > 0 ? price : null, currency: asStr(offer?.priceCurrency) || null, image: img, url: absoluteHttps(asStr(o.url) || asStr(offer?.url), pageUrl) });
      if (img) images.push({ url: img, alt: clean(asStr(o.name)), width: null, height: null, from: "jsonld" });
    } else if (types.some((t) => /LocalBusiness|Organization|Store|Artist|Person/.test(t))) {
      const img = absoluteHttps(firstImage(o.image), pageUrl);
      if (img) images.push({ url: img, alt: clean(asStr(o.name)), width: null, height: null, from: "jsonld" });
    }
  }
  const og = absoluteHttps(metaContent(head, "og:image") || metaContent(head, "twitter:image"), pageUrl);
  if (og) images.unshift({ url: og, alt: title, width: null, height: null, from: "og" });

  // Body: drop what is not visible content, keep structure as line breaks
  let body = html.replace(/<!--[\s\S]*?-->/g, " ");
  body = body.replace(/<(script|style|noscript|template|svg|head|iframe|canvas|select|option|button|form)\b[\s\S]*?<\/\1>/gi, " ");
  body = body.replace(/<(nav|footer|aside)\b[\s\S]*?<\/\1>/gi, " ");
  const headings: string[] = [];
  for (const m of body.matchAll(/<h([1-3])\b[^>]*>([\s\S]*?)<\/h\1>/gi)) { const h = clean(m[2].replace(/<[^>]+>/g, " ")); if (h && h.length <= 160 && headings.length < 30) headings.push(h); }

  // images from the visible body
  for (const m of body.matchAll(/<img\b[^>]*>/gi)) {
    const tag = m[0];
    const src = attr(tag, "src") ?? attr(tag, "data-src") ?? attr(tag, "data-lazy-src") ?? attr(tag, "data-original");
    const srcset = attr(tag, "srcset") ?? attr(tag, "data-srcset");
    const u = absoluteHttps(srcset ? largestFromSrcset(srcset) ?? src : src, pageUrl);
    if (!u) continue;
    const w = parseInt(attr(tag, "width") ?? "", 10), h = parseInt(attr(tag, "height") ?? "", 10);
    images.push({ url: u, alt: clean(attr(tag, "alt") ?? "").slice(0, 200), width: Number.isFinite(w) ? w : null, height: Number.isFinite(h) ? h : null, from: "img" });
  }
  const seen = new Set<string>();
  const keptImages = images.filter((i) => {
    const key = i.url.split("?")[0];
    if (seen.has(key)) return false;
    seen.add(key);
    if (SKIP_IMAGE.test(i.url) || /\.(svg|gif|ico)(\?|$)/i.test(i.url)) return false;
    if ((i.width !== null && i.width < 120) || (i.height !== null && i.height < 120)) return false;
    // A URL with no recognisable extension is allowed (CDNs often have none); the byte check decides later.
    return IMAGE_EXT.test(i.url) || !/\.[a-z0-9]{2,5}(\?|$)/i.test(new URL(i.url).pathname);
  }).slice(0, 40);

  const links: { url: string; text: string }[] = [];
  const seenLink = new Set<string>();
  for (const m of body.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi)) {
    const u = absoluteHttps(attr(`<a ${m[1]}>`, "href"), pageUrl);
    if (!u || seenLink.has(u)) continue;
    seenLink.add(u);
    links.push({ url: u, text: clean(m[2].replace(/<[^>]+>/g, " ")).slice(0, 120) });
    if (links.length >= 120) break;
  }

  const text = body
    .replace(/<(br|\/p|\/div|\/li|\/h[1-6]|\/tr|\/section|\/article|\/figcaption|\/blockquote)\b[^>]*>/gi, "\n")
    .replace(/<[^>]+>/g, " ");
  const lines: string[] = []; const seenLines = new Set<string>(); let stripped = 0;
  for (const l of decodeEntities(text).split(/\n+/)) {
    const t = l.replace(/[<>]/g, " ").replace(/\s+/g, " ").trim();
    if (t.length < 2 || seenLines.has(t)) continue;
    if (INJECTION.test(t)) { stripped++; continue; }
    seenLines.add(t); lines.push(t);
  }
  return { url: pageUrl, title, description, headings, text: lines.join("\n").slice(0, 6000), images: keptImages, links, products: products.filter((p) => p.name).slice(0, 12), stripped };
}

const PAGE_HINT = /(about|story|shop|store|product|collection|print|original|commission|gallery|portfolio|work|service|treatment|menu|book|workshop|class|course|visit|contact|stay|room|cottage|tour|experience|offer)/i;
const PAGE_AVOID = /(cart|checkout|basket|login|account|register|privacy|terms|cookie|policy|returns|refund|shipping|delivery|faq|blog|news|wp-admin|wp-json|feed|\.pdf|\.zip|tag\/|category\/|page\/\d)/i;

/** Up to `max` further pages of the SAME site worth reading, best first. */
export function chooseLinks(page: ExtractedPage, startUrl: string, max = 4): string[] {
  const start = new URL(startUrl);
  const site = start.hostname.replace(/^www\./, "");
  const scored: { url: string; score: number }[] = [];
  for (const l of page.links) {
    let u: URL; try { u = new URL(l.url); } catch { continue; }
    if (u.hostname.replace(/^www\./, "") !== site) continue;
    if (u.pathname === "/" || u.pathname === start.pathname) continue;
    if (PAGE_AVOID.test(u.pathname) || /\.(jpe?g|png|gif|webp|svg|css|js|ico|mp4)$/i.test(u.pathname)) continue;
    if (u.pathname.split("/").filter(Boolean).length > 3) continue;
    const hint = `${u.pathname} ${l.text}`;
    const score = (PAGE_HINT.test(hint) ? 10 : 0) - u.pathname.split("/").length + (/(about|story)/i.test(hint) ? 3 : 0) + (/(shop|store|product|print|original|service|menu|book)/i.test(hint) ? 2 : 0);
    if (score > 0) { u.search = ""; scored.push({ url: u.toString(), score }); }
  }
  const out: string[] = [];
  for (const s of scored.sort((a, b) => b.score - a.score)) { if (!out.includes(s.url)) out.push(s.url); if (out.length >= max) break; }
  return out;
}

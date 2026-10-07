/**
 * Where a social card may get a picture from, how it is fetched, and how it is decoded.
 *
 * /api/social-image is public and unauthenticated, and the picture on an event or product card comes from a
 * database column (events.cover_url, products.photos) that an ordinary signed-in user can write. So the URL is
 * untrusted at render time, however it got there. This module is the whole trust decision for that URL:
 *
 *   1. WHERE   Only this project's own Supabase Storage public-object URLs. The origin must equal the project's
 *              origin exactly (scheme, host and port), the path must sit under /storage/v1/object/public/<bucket>/ in
 *              a bucket we publish images from, and nothing else on that host (REST, functions, auth) is reachable.
 *              There is no allow-list of "external" hosts: nothing in production uses one, and an allow-list that
 *              needs DNS and IP reasoning is exactly the thing this avoids. A cover on any other host falls back to
 *              the branded card.
 *   2. FETCH   No redirect is ever followed (a 3xx is a failure), no credentials are sent, the whole fetch including
 *              reading the body has one deadline, and the body is read with a hard byte cap.
 *   3. DECODE  The bytes must be a JPEG, PNG or WebP *by what sharp finds in them*, not by what the server said, within
 *              a pixel cap that is far below sharp's own default, and single-frame. SVG, HEIF/AVIF and the rest are
 *              refused before decoding, and the HEIF/AVIF loader is also blocked inside libvips as a second line.
 *              The SVG loader is deliberately NOT blocked: Next's own ImageResponse rasterises the SVG it generates
 *              through sharp, so blocking it process-wide breaks every card. SVG is kept out by the format gate alone.
 *
 * Every failure collapses to `null` so the card is drawn without a picture; the reason is a short fixed code and is
 * logged without the URL, the response, or anything else an attacker chose.
 */

/** Public buckets that images for events, businesses/products and hubs are published to. */
export const TRUSTED_IMAGE_BUCKETS: readonly string[] = ["event-media", "business-media", "hub-media", "site-media"];

export const SOCIAL_IMAGE_LIMITS = {
  /** Largest body we will read. The buckets themselves cap uploads at 10 MiB. */
  maxBytes: 10 * 1024 * 1024,
  /** One deadline for the whole fetch, headers and body. */
  timeoutMs: 6_000,
  /** 48 megapixels covers a modern phone camera; sharp's own default (268 Mpx) would let a tiny file expand to ~800 MB. */
  maxPixels: 48_000_000,
  maxSide: 16_384,
  size: 1080,
  jpegQuality: 82,
} as const;

const ALLOWED_CONTENT_TYPES = new Set(["image/jpeg", "image/jpg", "image/png", "image/webp"]);
const ALLOWED_FORMATS = new Set(["jpeg", "png", "webp"]);
const STORAGE_PREFIX = "/storage/v1/object/public/";

export type ImagePolicy = {
  /** Exact origin of the project's Supabase API, e.g. https://abcd.supabase.co */
  trustedOrigin: string;
  buckets: readonly string[];
};

export type CoverFailure =
  | "no-policy" | "bad-url" | "untrusted-origin" | "untrusted-path"
  | "redirect" | "status" | "content-type" | "too-large" | "timeout" | "fetch-failed"
  | "format" | "pixels" | "decode-failed";

/** Build the policy from NEXT_PUBLIC_SUPABASE_URL. Unset or unparseable means NO image is trusted (fail closed). */
export function policyFromSupabaseUrl(supabaseUrl: string | undefined | null): ImagePolicy | null {
  if (!supabaseUrl) return null;
  try {
    const origin = new URL(supabaseUrl).origin;
    return origin === "null" ? null : { trustedOrigin: origin, buckets: TRUSTED_IMAGE_BUCKETS };
  } catch {
    return null;
  }
}

/**
 * Returns the URL to fetch, rebuilt from the parsed parts so that what we checked is exactly what we fetch,
 * or a failure code. Query string and fragment are dropped.
 */
export function checkTrustedImageUrl(raw: unknown, policy: ImagePolicy | null): { url: URL } | { reason: CoverFailure } {
  if (!policy) return { reason: "no-policy" };
  if (typeof raw !== "string" || raw.length === 0 || raw.length > 2048) return { reason: "bad-url" };
  // Control characters, whitespace and backslashes are normalised away by the URL parser in ways a different
  // reader of the same string may not agree with. Refuse them rather than reason about them.
  if (/[\u0000- \u007f\\]/.test(raw)) return { reason: "bad-url" };
  let u: URL;
  try { u = new URL(raw); } catch { return { reason: "bad-url" }; }

  // blob: URLs report the origin of whatever they wrap, so the origin comparison alone would accept blob:https://<project>/…
  if (u.protocol !== "https:" && u.protocol !== "http:") return { reason: "untrusted-origin" };
  if (u.origin !== policy.trustedOrigin) return { reason: "untrusted-origin" }; // scheme + host + port, exactly
  if (u.username || u.password) return { reason: "untrusted-origin" };
  if (!u.pathname.startsWith(STORAGE_PREFIX)) return { reason: "untrusted-path" };
  // The parser resolves literal dot-segments, but not encoded slashes; a server further down might decode them.
  if (/%2f|%5c|%2e|%00/i.test(u.pathname)) return { reason: "untrusted-path" };

  const rest = u.pathname.slice(STORAGE_PREFIX.length);
  const slash = rest.indexOf("/");
  const bucket = slash > 0 ? rest.slice(0, slash) : "";
  const object = slash > 0 ? rest.slice(slash + 1) : "";
  if (!bucket || !object || !policy.buckets.includes(bucket)) return { reason: "untrusted-path" };

  return { url: new URL(u.origin + u.pathname) };
}

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

/** Fetch the bytes under the rules above. Never follows a redirect. */
export async function fetchImageBytes(
  url: URL,
  o: { fetchImpl?: FetchLike; maxBytes?: number; timeoutMs?: number } = {},
): Promise<{ bytes: Uint8Array } | { reason: CoverFailure }> {
  const fetchImpl: FetchLike = o.fetchImpl ?? ((i, init) => fetch(i, init));
  const maxBytes = o.maxBytes ?? SOCIAL_IMAGE_LIMITS.maxBytes;
  const timeoutMs = o.timeoutMs ?? SOCIAL_IMAGE_LIMITS.timeoutMs;

  const ac = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  // A deadline that wins even if something below ignores the abort signal.
  const deadline = new Promise<"timeout">((resolve) => { timer = setTimeout(() => { ac.abort(); resolve("timeout"); }, timeoutMs); });
  const within = <T,>(p: Promise<T>) => Promise.race([p, deadline]);

  try {
    const res = await within(fetchImpl(url.href, {
      method: "GET",
      redirect: "manual",          // a redirect is a failure, never a hop we follow
      credentials: "omit",
      cache: "no-store",
      signal: ac.signal,
      headers: { accept: "image/jpeg,image/png,image/webp" },
    }));
    if (res === "timeout") return { reason: "timeout" };

    const drop = () => { try { void res.body?.cancel(); } catch { /* nothing to release */ } };
    if (res.status >= 300 && res.status < 400) { drop(); return { reason: "redirect" }; }
    if (res.type === "opaqueredirect") { drop(); return { reason: "redirect" }; }
    if (res.status !== 200) { drop(); return { reason: "status" }; }

    const ct = (res.headers.get("content-type") ?? "").split(";")[0].trim().toLowerCase();
    if (!ALLOWED_CONTENT_TYPES.has(ct)) { drop(); return { reason: "content-type" }; }
    const declared = Number(res.headers.get("content-length"));
    if (Number.isFinite(declared) && declared > maxBytes) { drop(); return { reason: "too-large" }; }

    const reader = res.body?.getReader();
    if (!reader) return { reason: "fetch-failed" };
    const chunks: Uint8Array[] = [];
    let total = 0;
    for (;;) {
      const next = await within(reader.read());
      if (next === "timeout") { void reader.cancel().catch(() => {}); return { reason: "timeout" }; }
      if (next.done) break;
      total += next.value.byteLength;
      if (total > maxBytes) { void reader.cancel().catch(() => {}); return { reason: "too-large" }; }
      chunks.push(next.value);
    }
    const bytes = new Uint8Array(total);
    let at = 0;
    for (const c of chunks) { bytes.set(c, at); at += c.byteLength; }
    return { bytes };
  } catch {
    return { reason: ac.signal.aborted ? "timeout" : "fetch-failed" };
  } finally {
    if (timer) clearTimeout(timer);
  }
}

type SharpModule = typeof import("sharp").default;
let sharpReady: Promise<SharpModule> | null = null;

/**
 * sharp, with the HEIF/AVIF loader (libheif) switched off inside libvips; nothing here or in Next's ImageResponse reads them.
 * Do NOT add VipsForeignLoadSvg: block() is process-wide and ImageResponse needs it to turn its SVG into a PNG.
 */
export function loadSharp(): Promise<SharpModule> {
  sharpReady ??= import("sharp").then((m) => {
    const sharp: SharpModule = m.default ?? (m as unknown as SharpModule);
    try { sharp.block({ operation: ["VipsForeignLoadHeif"] }); } catch { /* older libvips: the format gate below still applies */ }
    return sharp;
  });
  return sharpReady;
}

/** Decode, bounded, and re-encode to a JPEG (satori/resvg can only take PNG/JPEG). */
export async function decodeToJpegDataUri(
  bytes: Uint8Array,
  o: { maxPixels?: number; maxSide?: number; size?: number; quality?: number; getSharp?: () => Promise<SharpModule> } = {},
): Promise<{ dataUri: string } | { reason: CoverFailure }> {
  const maxPixels = o.maxPixels ?? SOCIAL_IMAGE_LIMITS.maxPixels;
  const maxSide = o.maxSide ?? SOCIAL_IMAGE_LIMITS.maxSide;
  const size = o.size ?? SOCIAL_IMAGE_LIMITS.size;
  const sharp = await (o.getSharp ?? loadSharp)();
  const buf = Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength);

  let meta;
  try {
    meta = await sharp(buf, { limitInputPixels: maxPixels, failOn: "error" }).metadata();
  } catch (e) {
    // sharp reports an over-limit image as an error from metadata() too
    return { reason: /pixel limit|exceeds/i.test(String((e as Error)?.message)) ? "pixels" : "decode-failed" };
  }
  // What sharp finds in the bytes decides the format, whatever the server claimed.
  if (!meta.format || !ALLOWED_FORMATS.has(meta.format)) return { reason: "format" };
  if ((meta.pages ?? 1) > 1) return { reason: "format" };               // animated
  const w = meta.width ?? 0, h = meta.height ?? 0;
  if (!w || !h || w > maxSide || h > maxSide || w * h > maxPixels) return { reason: "pixels" };

  try {
    const jpeg = await sharp(buf, { limitInputPixels: maxPixels, failOn: "error", sequentialRead: true })
      .resize({ width: size, height: size, fit: "cover" })
      .jpeg({ quality: o.quality ?? SOCIAL_IMAGE_LIMITS.jpegQuality })
      .toBuffer();
    return { dataUri: `data:image/jpeg;base64,${jpeg.toString("base64")}` };
  } catch {
    return { reason: "decode-failed" };
  }
}

/** The full path: check the URL, fetch, decode. Returns the reason on failure so tests can assert the cause. */
export async function loadCover(
  raw: unknown,
  policy: ImagePolicy | null,
  deps: { fetchImpl?: FetchLike; maxBytes?: number; timeoutMs?: number; maxPixels?: number; getSharp?: () => Promise<SharpModule> } = {},
): Promise<{ dataUri: string } | { reason: CoverFailure }> {
  const checked = checkTrustedImageUrl(raw, policy);
  if ("reason" in checked) return checked;
  const got = await fetchImageBytes(checked.url, deps);
  if ("reason" in got) return got;
  return decodeToJpegDataUri(got.bytes, deps);
}

/** What the route calls. null means "draw the card without a picture". */
export async function coverAsJpegDataUri(raw: unknown, policy: ImagePolicy | null): Promise<string | null> {
  const r = await loadCover(raw, policy);
  if ("dataUri" in r) return r.dataUri;
  // Fixed code only: never the URL, the response, or the error text, all of which an attacker can shape.
  console.warn(`[social-image] cover skipped: ${r.reason}`);
  return null;
}

/**
 * Open-redirect guard for `?next=` return-to-after-sign-in params.
 *
 * A browser does not read a URL the way a string-prefix check does. Before it parses a reference it DELETES every tab,
 * carriage return and line feed, and it treats a backslash as a slash. So "/<TAB>/evil.example" starts with a single
 * "/" and passes a `startsWith("//")` test, yet the browser reads it as "//evil.example": a link to another site, and
 * client-side `router.replace(next)` follows it after the person has just signed in on OneShetland.
 *
 * So a value is accepted only when ALL of these hold:
 *   - it is a string, 1–2048 characters, starting with exactly one "/" (not "//", not "/\");
 *   - it contains no control, format or invisible character (tab, CR, LF, NUL, bidi marks, zero-width space, BOM…),
 *     no backslash, and no space character other than a plain U+0020 (which arrives legitimately when a decoded query
 *     value contains one);
 *   - the same holds at every percent-decoding level (up to three), because consumers such as the mobile app decode
 *     `next` again: "/%2F/evil" and "/%09/evil" must not turn dangerous on the second read;
 *   - resolved against a fixed yardstick origin it stays on that origin and its path does not collapse to "//…"
 *     ("/.//evil" and "/..//evil" do).
 * A value that fails any of these is not an error: it is replaced by the fallback ("/account").
 *
 * The yardstick origin is never used for a redirect: a relative reference can only change origin if it smuggles in its
 * own authority, so any fixed origin is a valid ruler. Using it means the check is identical in production, preview
 * and local development, and does not depend on a configured site URL.
 */
const YARDSTICK = new URL("http://local.invalid");
const MAX_LENGTH = 2048;
const MAX_DECODE_DEPTH = 3;
/** Never legitimate in a return path, at any decoding level: control, format/invisible, surrogate, backslash. */
const UNSAFE_CHAR = /[\p{Cc}\p{Cf}\p{Cs}\\]/u;
/** Space separators (NBSP, ideographic space…) and line/paragraph separators, but NOT a plain U+0020. */
const UNSAFE_SPACE = /(?! )[\p{Zs}\p{Zl}\p{Zp}]/u;

const looksLocal = (s: string) =>
  s.startsWith("/") && !s.startsWith("//") && !s.startsWith("/\\") && !UNSAFE_CHAR.test(s);

export function isLocalPath(value: unknown): value is string {
  if (typeof value !== "string" || value.length === 0 || value.length > MAX_LENGTH) return false;
  if (UNSAFE_SPACE.test(value)) return false;

  // Every layer of percent-encoding must also look local.
  let level = value;
  for (let depth = 0; ; depth++) {
    if (!looksLocal(level)) return false;
    let decoded: string;
    try { decoded = decodeURIComponent(level); } catch { break; }   // malformed escape: nothing further to decode
    if (decoded === level) break;
    if (depth >= MAX_DECODE_DEPTH) return false;                    // more layers than anything we ever generate
    level = decoded;
  }

  let resolved: URL;
  try { resolved = new URL(value, YARDSTICK); } catch { return false; }
  if (resolved.origin !== YARDSTICK.origin) return false;
  if (resolved.pathname.startsWith("//")) return false;
  return true;
}

export function safeNext(next: string | null | undefined): string {
  return isLocalPath(next) ? next : "/account";
}

/**
 * Where a signed-out owner should land after signing in, for any /business/{id}/manage/* page.
 *
 * `returnPath` is the page that was actually asked for. It is honoured only if it is a safe internal path AND it
 * stays inside this business's own manage area, so a crafted value can neither leave the site nor wander into
 * another business. Anything else falls back to the manage dashboard — which is where every page used to send you.
 */
export function manageReturnPath(idOrSlug: string, returnPath?: string | null): string {
  const root = `/business/${idOrSlug}/manage`;
  if (!returnPath) return root;
  if (!returnPath.startsWith("/")) return root;
  const safe = safeNext(returnPath);
  if (safe === "/account" && returnPath !== "/account") return root;   // safeNext refused it
  if (safe === root || safe.startsWith(`${root}/`) || safe.startsWith(`${root}?`)) return safe;
  return root;
}

/** The sign-in URL for a manage page. The destination is encoded so a query string survives the round trip. */
export function manageSignInUrl(idOrSlug: string, returnPath?: string | null): string {
  return `/sign-in?next=${encodeURIComponent(manageReturnPath(idOrSlug, returnPath))}`;
}
